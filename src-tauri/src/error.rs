//! Error types for Waldiez Player

use thiserror::Error;

/// Main error type for the application
#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("FFmpeg error: {0}")]
    FFmpeg(String),

    #[error("Media error: {0}")]
    Media(String),

    #[error("Project error: {0}")]
    Project(String),

    #[error("Render error: {0}")]
    Render(String),

    #[error("Effect error: {0}")]
    Effect(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid format: {0}")]
    InvalidFormat(String),

    #[error("Cancelled")]
    Cancelled,

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<ffmpeg_next::Error> for Error {
    fn from(err: ffmpeg_next::Error) -> Self {
        Error::FFmpeg(err.to_string())
    }
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Result type alias for the application
pub type Result<T> = std::result::Result<T, Error>;
