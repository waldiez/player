//! Media handling module
//!
//! This module provides functionality for analyzing and processing media files
//! using FFmpeg.

mod analyzer;
mod info;
mod waveform;

pub use analyzer::MediaAnalyzer;
pub use info::MediaInfo;
pub use waveform::WaveformData;
