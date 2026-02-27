//! mpv integration — a full-featured media player controlled via IPC.
//!
//! mpv is started as a background daemon (`--idle --no-video`) with a Unix
//! socket IPC server.  Rust reads mpv's JSON event stream and re-emits the
//! relevant events to the Tauri window so the React frontend can stay in sync.
//!
//! mpv accepts anything it can play: YouTube URLs (via its built-in yt-dlp
//! support), local files, HLS/RTSP/DASH streams, FLAC, etc.
//!
//! Platform notes
//! ──────────────
//! IPC uses a Unix domain socket on macOS/Linux.  Windows support would
//! require a named-pipe implementation and is left as a future addition.

use crate::error::{Error, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

// ── State managed by Tauri ─────────────────────────────────────────────────

/// Tauri-managed state for the singleton mpv daemon.
pub struct MpvState(pub Arc<Mutex<Option<MpvInner>>>);

pub struct MpvInner {
    _child: tokio::process::Child,
    socket_path: PathBuf,
    cmd_tx: tokio::sync::mpsc::Sender<String>,
}

// ── Events emitted to the frontend ────────────────────────────────────────

/// Events forwarded from the mpv IPC socket to the Tauri window as "mpv-event".
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "value")]
pub enum MpvEvent {
    /// Current playback position in seconds.
    Time(f64),
    /// Track duration in seconds.
    Duration(f64),
    /// `true` = paused, `false` = playing.
    Paused(bool),
    /// Volume, 0.0–1.0.
    Volume(f64),
    /// Playback reached the end of the current file.
    Ended,
}

// ── Internal helpers (Unix only) ──────────────────────────────────────────

#[cfg(unix)]
async fn start_mpv_impl(app: &tauri::AppHandle, arc: &Arc<Mutex<Option<MpvInner>>>) -> Result<()> {
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::UnixStream,
    };

    // Another concurrent call may have already started mpv.
    if arc.lock().await.is_some() {
        return Ok(());
    }

    let socket_path =
        std::env::temp_dir().join(format!("waldiez-mpv-{}.sock", std::process::id()));

    // Remove stale socket from a previous run.
    let _ = std::fs::remove_file(&socket_path);

    let child = tokio::process::Command::new("mpv")
        .args([
            "--no-video",
            "--idle=yes",
            "--keep-open=yes",
            "--no-terminal",
            "--really-quiet",
            "--pause", // start paused; the frontend drives play/pause
            &format!("--input-ipc-server={}", socket_path.display()),
        ])
        .spawn()
        .map_err(|e| Error::Internal(format!("mpv not found: {e}")))?;

    // Wait up to 2.5 s for the socket to appear.
    let mut connected = false;
    for _ in 0..25 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if socket_path.exists() {
            connected = true;
            break;
        }
    }
    if !connected {
        return Err(Error::Internal("mpv did not start in time".into()));
    }

    let stream = UnixStream::connect(&socket_path)
        .await
        .map_err(|e| Error::Internal(format!("mpv IPC connect: {e}")))?;

    let (reader, mut writer) = stream.into_split();
    let (cmd_tx, mut cmd_rx) = tokio::sync::mpsc::channel::<String>(64);

    // Writer task: drain the channel into the socket.
    tokio::spawn(async move {
        while let Some(mut line) = cmd_rx.recv().await {
            line.push('\n');
            if writer.write_all(line.as_bytes()).await.is_err() {
                break;
            }
        }
    });

    // Subscribe to the properties we care about.
    for (id, prop) in ["time-pos", "duration", "pause", "volume", "eof-reached"]
        .iter()
        .enumerate()
    {
        let _ = cmd_tx
            .send(format!(
                r#"{{"command":["observe_property",{},"{}"]}}"#,
                id + 1,
                prop
            ))
            .await;
    }

    // Reader task: parse mpv events and emit to the Tauri window.
    let app2 = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(evt) = parse_mpv_event(&v) {
                    let _ = app2.emit("mpv-event", evt);
                }
            }
        }
    });

    // Store the handle — re-check to avoid overwriting a concurrent start.
    let mut lock = arc.lock().await;
    if lock.is_none() {
        *lock = Some(MpvInner {
            _child: child,
            socket_path,
            cmd_tx,
        });
    }
    Ok(())
}

#[cfg(not(unix))]
async fn start_mpv_impl(_app: &tauri::AppHandle, _arc: &Arc<Mutex<Option<MpvInner>>>) -> Result<()> {
    Err(Error::Internal(
        "mpv IPC is not yet supported on Windows".into(),
    ))
}

async fn ensure_running(app: &tauri::AppHandle, state: &MpvState) -> Result<()> {
    // Fast path — already running.
    if state.0.lock().await.is_some() {
        return Ok(());
    }
    start_mpv_impl(app, &state.0).await
}

async fn send_cmd(state: &MpvState, cmd: String) -> Result<()> {
    let lock = state.0.lock().await;
    match lock.as_ref() {
        Some(inner) => inner
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|e| Error::Internal(format!("mpv send: {e}"))),
        None => Err(Error::Internal("mpv not running — call mpv_load first".into())),
    }
}

fn json_str(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s.replace('"', "\\\"")))
}

fn parse_mpv_event(v: &serde_json::Value) -> Option<MpvEvent> {
    let event = v.get("event")?.as_str()?;
    if event != "property-change" {
        return None;
    }
    let name = v.get("name")?.as_str()?;
    let data = v.get("data")?;
    match name {
        "time-pos" => data.as_f64().map(MpvEvent::Time),
        "duration" => data.as_f64().map(MpvEvent::Duration),
        "pause" => data.as_bool().map(MpvEvent::Paused),
        // mpv volume is 0–100; we normalise to 0–1 for the frontend.
        "volume" => data.as_f64().map(|v| MpvEvent::Volume(v / 100.0)),
        "eof-reached" => {
            if data.as_bool() == Some(true) {
                Some(MpvEvent::Ended)
            } else {
                None
            }
        }
        _ => None,
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────

/// Returns `true` if `mpv` is installed and reachable on PATH.
#[tauri::command]
pub async fn mpv_check() -> bool {
    tokio::process::Command::new("mpv")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Load a URL or file path into mpv and start playing.
///
/// Accepts anything mpv understands:
///   - `https://www.youtube.com/watch?v=...`  (via mpv's built-in yt-dlp)
///   - Local file paths
///   - HLS/RTSP/RTMP streams
///
/// Auto-starts the mpv daemon if it is not already running.
#[tauri::command]
pub async fn mpv_load(
    app: tauri::AppHandle,
    state: tauri::State<'_, MpvState>,
    url: String,
) -> Result<()> {
    ensure_running(&app, &state).await?;
    send_cmd(
        &state,
        format!(r#"{{"command":["loadfile",{},"replace"]}}"#, json_str(&url)),
    )
    .await
}

/// Pause playback.
#[tauri::command]
pub async fn mpv_pause(state: tauri::State<'_, MpvState>) -> Result<()> {
    send_cmd(&state, r#"{"command":["set_property","pause",true]}"#.into()).await
}

/// Resume playback.
#[tauri::command]
pub async fn mpv_resume(state: tauri::State<'_, MpvState>) -> Result<()> {
    send_cmd(&state, r#"{"command":["set_property","pause",false]}"#.into()).await
}

/// Seek to an absolute position (seconds).
#[tauri::command]
pub async fn mpv_seek(state: tauri::State<'_, MpvState>, seconds: f64) -> Result<()> {
    send_cmd(
        &state,
        format!(r#"{{"command":["seek",{},"absolute"]}}"#, seconds),
    )
    .await
}

/// Set volume.  `volume` is 0.0–1.0 on the frontend, mapped to 0–100 for mpv.
#[tauri::command]
pub async fn mpv_set_volume(state: tauri::State<'_, MpvState>, volume: f64) -> Result<()> {
    let v = (volume * 100.0).clamp(0.0, 100.0);
    send_cmd(
        &state,
        format!(r#"{{"command":["set_property","volume",{}]}}"#, v),
    )
    .await
}

/// Set playback speed (e.g. 1.5 for 1.5×).
#[tauri::command]
pub async fn mpv_set_speed(state: tauri::State<'_, MpvState>, rate: f64) -> Result<()> {
    send_cmd(
        &state,
        format!(r#"{{"command":["set_property","speed",{}]}}"#, rate),
    )
    .await
}

/// Stop playback (keeps mpv daemon alive).
#[tauri::command]
pub async fn mpv_stop(state: tauri::State<'_, MpvState>) -> Result<()> {
    send_cmd(&state, r#"{"command":["stop"]}"#.into()).await
}

/// Quit the mpv daemon entirely and clean up the socket.
#[tauri::command]
pub async fn mpv_quit(state: tauri::State<'_, MpvState>) -> Result<()> {
    let mut lock = state.0.lock().await;
    if let Some(mut inner) = lock.take() {
        let _ = inner.cmd_tx.try_send(r#"{"command":["quit"]}"#.into());
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        let _ = inner._child.kill().await;
        let _ = tokio::fs::remove_file(&inner.socket_path).await;
    }
    Ok(())
}
