//! Media handling module
//!
//! This module provides functionality for analyzing and processing media files
//! using FFmpeg.

#[cfg(feature = "ffmpeg-media")]
mod analyzer;
mod info;
mod waveform;

#[cfg(not(feature = "ffmpeg-media"))]
use crate::{Error, Result};
#[cfg(not(feature = "ffmpeg-media"))]
use std::path::{Path, PathBuf};

#[cfg(feature = "ffmpeg-media")]
pub use analyzer::MediaAnalyzer;
pub use info::MediaInfo;
pub use waveform::WaveformData;

#[cfg(not(feature = "ffmpeg-media"))]
pub struct MediaAnalyzer {
    _path: PathBuf,
}

#[cfg(not(feature = "ffmpeg-media"))]
impl MediaAnalyzer {
    pub fn new(path: &Path) -> Result<Self> {
        Ok(Self {
            _path: path.to_path_buf(),
        })
    }

    pub fn get_info(&self) -> Result<MediaInfo> {
        Err(Error::Media(
            "Media analysis is disabled in this build (ffmpeg-media feature off).".into(),
        ))
    }

    pub fn extract_thumbnail(&self, _timestamp: f64, _width: u32, _height: u32) -> Result<String> {
        Err(Error::Media(
            "Thumbnail extraction is disabled in this build (ffmpeg-media feature off).".into(),
        ))
    }

    pub fn extract_waveform(&self, _samples: usize) -> Result<WaveformData> {
        Err(Error::Media(
            "Waveform extraction is disabled in this build (ffmpeg-media feature off).".into(),
        ))
    }
}
