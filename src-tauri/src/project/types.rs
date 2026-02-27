//! Project data types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// A Waldiez Player project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Unique project identifier
    pub id: Uuid,
    /// Project name
    pub name: String,
    /// Schema version
    pub version: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last modification timestamp
    pub updated_at: DateTime<Utc>,
    /// Project settings
    pub settings: ProjectSettings,
    /// Asset library
    pub assets: AssetLibrary,
    /// Composition timeline
    pub composition: Composition,
    /// File path (if saved)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Project settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    /// Output resolution
    pub resolution: Resolution,
    /// Frame rate
    pub frame_rate: f64,
    /// Background color (hex)
    pub background_color: String,
    /// Duration ("auto" or seconds)
    pub duration: DurationSetting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DurationSetting {
    Auto(String),
    Fixed(f64),
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            resolution: Resolution {
                width: 1920,
                height: 1080,
            },
            frame_rate: 30.0,
            background_color: "#000000".to_string(),
            duration: DurationSetting::Auto("auto".to_string()),
        }
    }
}

/// Asset library containing all imported media
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetLibrary {
    pub images: Vec<ImageAsset>,
    pub audio: Vec<AudioAsset>,
    pub video: Vec<VideoAsset>,
    pub captions: Vec<CaptionSource>,
    pub fonts: Vec<FontAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAsset {
    pub id: String,
    pub name: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioAsset {
    pub id: String,
    pub name: String,
    pub path: String,
    pub duration: f64,
    pub sample_rate: u32,
    pub channels: u32,
    pub format: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoAsset {
    pub id: String,
    pub name: String,
    pub path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub frame_rate: f64,
    pub codec: String,
    pub format: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionSource {
    pub id: String,
    pub name: String,
    pub path: String,
    pub format: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontAsset {
    pub id: String,
    pub name: String,
    pub path: String,
    pub family: String,
    pub style: String,
    pub weight: u32,
}

/// Composition timeline
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Composition {
    pub tracks: Vec<Track>,
    pub markers: Vec<Marker>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub track_type: TrackType,
    pub items: Vec<TrackItem>,
    pub is_visible: bool,
    pub is_muted: bool,
    pub is_locked: bool,
    pub opacity: f64,
    pub blend_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrackType {
    Video,
    Image,
    Audio,
    Caption,
    Effect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackItem {
    pub id: String,
    pub asset_id: String,
    pub start_time: f64,
    pub duration: f64,
    pub in_point: f64,
    pub out_point: f64,
    pub transform: Transform,
    pub effects: Vec<Effect>,
    pub transitions: Vec<Transition>,
    pub keyframes: Vec<KeyframeGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transform {
    pub position: Position,
    pub scale: Scale,
    pub rotation: f64,
    pub anchor: Position,
    pub opacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scale {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Effect {
    pub id: String,
    #[serde(rename = "type")]
    pub effect_type: String,
    pub enabled: bool,
    pub parameters: HashMap<String, serde_json::Value>,
    pub keyframes: Vec<KeyframeGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transition {
    pub id: String,
    #[serde(rename = "type")]
    pub transition_type: String,
    pub duration: f64,
    pub position: String,
    pub easing: String,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyframeGroup {
    pub property: String,
    pub keyframes: Vec<Keyframe>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe {
    pub id: String,
    pub time: f64,
    pub value: serde_json::Value,
    pub easing: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub id: String,
    pub time: f64,
    pub label: String,
    pub color: String,
    #[serde(rename = "type")]
    pub marker_type: String,
}
