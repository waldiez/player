//! Waldiez Player - A video player and editor with an impressive UI
//!
//! This is the main library crate that exposes all functionality.

pub mod commands;
pub mod effects;
pub mod error;
pub mod media;
pub mod project;
pub mod render;

pub use error::{Error, Result};
