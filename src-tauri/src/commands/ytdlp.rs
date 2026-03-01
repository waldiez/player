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

/// Search result item returned by `yt_search_videos`.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct YtSearchVideo {
    pub video_id: String,
    pub title: String,
    pub author: String,
    pub duration: f64,
    pub thumbnail: String,
}

fn value_to_f64(v: &serde_json::Value) -> f64 {
    if let Some(n) = v.as_f64() {
        return n;
    }
    if let Some(s) = v.as_str() {
        return s.trim().parse::<f64>().unwrap_or(0.0);
    }
    0.0
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

/// Search YouTube videos using yt-dlp's extractor backend.
///
/// This runs server-side in Tauri, so browser CORS restrictions do not apply.
#[tauri::command]
pub async fn yt_search_videos(query: String, limit: Option<u32>) -> Result<Vec<YtSearchVideo>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }

    let count = limit.unwrap_or(12).clamp(1, 30);
    let search_expr = format!("ytsearch{count}:{q}");
    let output = Command::new("yt-dlp")
        .args([
            "--flat-playlist",
            "--skip-download",
            "--no-warnings",
            "--dump-single-json",
            "--",
            &search_expr,
        ])
        .output()
        .await
        .map_err(|e| Error::Internal(format!("yt-dlp not found: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(Error::Internal(format!("yt-dlp: {stderr}")));
    }

    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| Error::Internal(format!("yt-dlp JSON: {e}")))?;

    let mut out = Vec::new();
    for entry in value
        .get("entries")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
    {
        let id = entry
            .get("id")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
            .trim();
        if id.is_empty() {
            continue;
        }

        let title = entry
            .get("title")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("Unknown")
            .to_string();
        let author = entry
            .get("channel")
            .and_then(serde_json::Value::as_str)
            .or_else(|| entry.get("uploader").and_then(serde_json::Value::as_str))
            .unwrap_or("")
            .to_string();
        let duration = entry.get("duration").map(value_to_f64).unwrap_or(0.0);

        let thumbnail = entry
            .get("thumbnails")
            .and_then(serde_json::Value::as_array)
            .and_then(|arr| arr.last())
            .and_then(|v| v.get("url"))
            .and_then(serde_json::Value::as_str)
            .filter(|s| !s.trim().is_empty())
            .map(ToString::to_string)
            .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"));

        out.push(YtSearchVideo {
            video_id: id.to_string(),
            title,
            author,
            duration,
            thumbnail,
        });
    }

    Ok(out)
}
