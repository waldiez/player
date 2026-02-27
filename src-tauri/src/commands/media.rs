//! Media-related Tauri commands

use crate::media::{MediaAnalyzer, MediaInfo, WaveformData};
use crate::Result;
use std::path::PathBuf;
use tauri::command;

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
