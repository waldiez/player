//! Media-related Tauri commands

use crate::media::{MediaAnalyzer, MediaInfo, WaveformData};
use crate::Result;
use base64::Engine;
use std::path::PathBuf;
use tauri::command;
use tokio::process::Command;

#[derive(serde::Serialize)]
pub struct PdfInfo {
    pub page_count: u32,
}

async fn run_mutool(args: &[&str]) -> Result<Vec<u8>> {
    let output = Command::new("mutool")
        .args(args)
        .output()
        .await
        .map_err(|err| crate::Error::Media(format!("Failed to execute mutool: {err}")))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(crate::Error::Media(if detail.is_empty() {
            "mutool command failed".to_string()
        } else {
            format!("mutool command failed: {detail}")
        }));
    }

    Ok(output.stdout)
}

/// Get detailed information about a media file
#[command]
pub async fn get_media_info(path: String) -> Result<MediaInfo> {
    let path = PathBuf::from(&path);
    let analyzer = MediaAnalyzer::new(&path)?;
    analyzer.get_info()
}

/// Extract a thumbnail from a video at a specific timestamp
#[command]
pub async fn extract_thumbnail(
    path: String,
    timestamp: f64,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<String> {
    let path = PathBuf::from(&path);
    let analyzer = MediaAnalyzer::new(&path)?;

    // Default to 320x180 if not specified
    let width = width.unwrap_or(320);
    let height = height.unwrap_or(180);

    analyzer.extract_thumbnail(timestamp, width, height)
}

/// Extract audio waveform data for visualization
#[command]
pub async fn extract_audio_waveform(path: String, samples: Option<usize>) -> Result<WaveformData> {
    let path = PathBuf::from(&path);
    let analyzer = MediaAnalyzer::new(&path)?;

    // Default to 1000 samples if not specified
    let samples = samples.unwrap_or(1000);

    analyzer.extract_waveform(samples)
}

#[command]
pub async fn pdf_check() -> bool {
    Command::new("mutool")
        .arg("-v")
        .output()
        .await
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[command]
pub async fn pdf_get_info(path: String) -> Result<PdfInfo> {
    let output = run_mutool(&["pages", &path]).await?;
    let text = String::from_utf8_lossy(&output);
    let page_count = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count()
        .max(1) as u32;
    Ok(PdfInfo { page_count })
}

#[command]
pub async fn pdf_extract_text(path: String, page: Option<u32>) -> Result<String> {
    let mut command = Command::new("mutool");
    command.args(["draw", "-q", "-F", "txt", "-o", "-", &path]);
    if let Some(page) = page {
        command.arg(page.to_string());
    }
    let output = command
        .output()
        .await
        .map_err(|err| crate::Error::Media(format!("Failed to execute mutool: {err}")))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(crate::Error::Media(if detail.is_empty() {
            "mutool command failed".to_string()
        } else {
            format!("mutool command failed: {detail}")
        }));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
pub async fn pdf_render_page(path: String, page: u32, width: Option<u32>) -> Result<String> {
    let dir = tempfile::tempdir().map_err(|err| crate::Error::Media(err.to_string()))?;
    let out_path = dir.path().join("page.png");
    let width_value = width.unwrap_or(1400).max(320).to_string();
    let out_path_string = out_path.to_string_lossy().to_string();
    let page_value = page.to_string();
    let output = Command::new("mutool")
        .args([
            "draw",
            "-q",
            "-F",
            "png",
            "-w",
            &width_value,
            "-o",
            &out_path_string,
            &path,
            &page_value,
        ])
        .output()
        .await
        .map_err(|err| crate::Error::Media(format!("Failed to execute mutool: {err}")))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(crate::Error::Media(if detail.is_empty() {
            "mutool command failed".to_string()
        } else {
            format!("mutool command failed: {detail}")
        }));
    }
    let bytes = tokio::fs::read(&out_path)
        .await
        .map_err(|err| crate::Error::Media(format!("Failed to read rendered PDF page: {err}")))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:image/png;base64,{encoded}"))
}
