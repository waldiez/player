//! yt-dlp integration — extract direct audio stream URLs from YouTube.
//!
//! All commands run `yt-dlp` as a subprocess (must be on PATH).
//! The caller is responsible for falling back to the IFrame API if yt-dlp is
//! unavailable or returns an error.

use crate::error::{Error, Result};
use tokio::process::Command;

/// Information about a YouTube video, retrieved without downloading.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct YtVideoInfo {
    pub title: String,
    pub duration: f64,
}

/// Returns `true` if `yt-dlp` is installed and reachable on PATH.
#[tauri::command]
pub async fn yt_check() -> bool {
    Command::new("yt-dlp")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Returns the best-audio direct CDN URL for the given YouTube video ID.
///
/// The returned URL is a time-limited `googlevideo.com` link (~6 h) that can
/// be used directly as `<audio src>` to play without ads and with the full
/// Web Audio chain (EQ / FX / visualiser) intact.
///
/// For DASH streams yt-dlp may print multiple lines; we take the first one
/// which corresponds to the primary audio track.
#[tauri::command]
pub async fn yt_get_audio_url(video_id: String) -> Result<String> {
    let yt_url = format!("https://www.youtube.com/watch?v={video_id}");
    let output = Command::new("yt-dlp")
        .args([
            "--format",
            // Prefer m4a (native browser support) → webm/opus → best available audio
            "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
            "--get-url",
            "--no-playlist",
            "--no-warnings",
            "--",
            &yt_url,
        ])
        .output()
        .await
        .map_err(|e| Error::Internal(format!("yt-dlp not found: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Internal(format!("yt-dlp: {stderr}")));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Take the first non-empty line (DASH gives multiple URLs)
    let url = stdout
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("")
        .to_string();

    if url.is_empty() {
        return Err(Error::Internal("yt-dlp returned no URL".into()));
    }
    Ok(url)
}

/// Fetches the title and duration of a YouTube video without downloading it.
#[tauri::command]
pub async fn yt_get_video_info(video_id: String) -> Result<YtVideoInfo> {
    let yt_url = format!("https://www.youtube.com/watch?v={video_id}");
    let output = Command::new("yt-dlp")
        .args([
            "--print",
            "%(title)s\n%(duration)s",
            "--no-playlist",
            "--no-warnings",
            "--skip-download",
            "--",
            &yt_url,
        ])
        .output()
        .await
        .map_err(|e| Error::Internal(format!("yt-dlp not found: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Internal(format!("yt-dlp: {stderr}")));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines();
    let title = lines.next().unwrap_or("Unknown").trim().to_string();
    let duration = lines
        .next()
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap_or(0.0);

    Ok(YtVideoInfo { title, duration })
}
