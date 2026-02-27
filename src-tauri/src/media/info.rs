//! Media information structures

use serde::{Deserialize, Serialize};

/// Comprehensive information about a media file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    /// File path
    pub path: String,
    /// File name
    pub name: String,
    /// File size in bytes
    pub size: u64,
    /// Total duration in seconds
    pub duration: f64,
    /// Container format (e.g., "mp4", "mkv")
    pub format: String,
    /// Video stream information (if present)
    pub video: Option<VideoInfo>,
    /// Audio stream information (if present)
    pub audio: Option<AudioInfo>,
    /// Subtitle streams
    pub subtitles: Vec<SubtitleInfo>,
    /// Chapter markers
    pub chapters: Vec<ChapterInfo>,
    /// File metadata
    pub metadata: std::collections::HashMap<String, String>,
}

/// Video stream information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    /// Video codec (e.g., "h264", "hevc")
    pub codec: String,
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Frame rate (frames per second)
    pub frame_rate: f64,
    /// Bit rate in bits per second
    pub bit_rate: Option<u64>,
    /// Pixel format (e.g., "yuv420p")
    pub pixel_format: String,
    /// Color space
    pub color_space: Option<String>,
    /// Total number of frames
    pub frame_count: Option<u64>,
}

/// Audio stream information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    /// Audio codec (e.g., "aac", "mp3")
    pub codec: String,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u32,
    /// Channel layout (e.g., "stereo", "5.1")
    pub channel_layout: String,
    /// Bit rate in bits per second
    pub bit_rate: Option<u64>,
    /// Bits per sample
    pub bits_per_sample: Option<u32>,
}

/// Subtitle stream information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleInfo {
    /// Stream index
    pub index: usize,
    /// Subtitle codec
    pub codec: String,
    /// Language code (e.g., "eng", "spa")
    pub language: Option<String>,
    /// Title/description
    pub title: Option<String>,
}

/// Chapter marker information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterInfo {
    /// Chapter index
    pub index: usize,
    /// Start time in seconds
    pub start: f64,
    /// End time in seconds
    pub end: f64,
    /// Chapter title
    pub title: Option<String>,
}
