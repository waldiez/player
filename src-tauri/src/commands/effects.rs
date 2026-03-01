//! Effect-related Tauri commands
use crate::effects;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;
use tempfile::Builder;

/// Effect definition for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: EffectCategory,
    pub parameters: Vec<EffectParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EffectCategory {
    Color,
    Blur,
    Stylize,
    Transform,
    Audio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectParameter {
    pub name: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub param_type: ParameterType,
    pub default_value: serde_json::Value,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ParameterType {
    Number,
    Boolean,
    Color,
    Select,
}

/// Apply an effect to a media file (preview or render)
#[command]
pub async fn apply_effect(
    input_path: String,
    effect_id: String,
    parameters: serde_json::Value,
    output_path: Option<String>,
) -> Result<String> {
    let output = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let temp_dir = Builder::new().prefix("waldiez_").tempdir()?;
            temp_dir.path().join(format!("effect_{}.mp4", effect_id))
        }
    };

    let filter_str = effects::get_ffmpeg_filter(&effect_id, &parameters)?;
    let status = std::process::Command::new("ffmpeg")
        .arg("-i")
        .arg(&input_path)
        .arg("-vf")
        .arg(filter_str)
        .arg("-y")
        .arg(&output)
        .status()?;

    if !status.success() {
        return Err(Error::FFmpeg("Failed to apply effect".into()));
    }

    Ok(output.to_string_lossy().to_string())
}

/// Get all available effects
#[command]
pub fn get_available_effects() -> Vec<EffectDefinition> {
    vec![
        // Color effects
        EffectDefinition {
            id: "brightness".to_string(),
            name: "Brightness".to_string(),
            description: "Adjust the overall brightness of the image".to_string(),
            category: EffectCategory::Color,
            parameters: vec![EffectParameter {
                name: "value".to_string(),
                display_name: "Brightness".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(1.0),
                min: Some(0.0),
                max: Some(2.0),
                step: Some(0.01),
            }],
        },
        EffectDefinition {
            id: "contrast".to_string(),
            name: "Contrast".to_string(),
            description: "Adjust the contrast level".to_string(),
            category: EffectCategory::Color,
            parameters: vec![EffectParameter {
                name: "value".to_string(),
                display_name: "Contrast".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(1.0),
                min: Some(0.0),
                max: Some(2.0),
                step: Some(0.01),
            }],
        },
        EffectDefinition {
            id: "saturation".to_string(),
            name: "Saturation".to_string(),
            description: "Adjust color saturation".to_string(),
            category: EffectCategory::Color,
            parameters: vec![EffectParameter {
                name: "value".to_string(),
                display_name: "Saturation".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(1.0),
                min: Some(0.0),
                max: Some(2.0),
                step: Some(0.01),
            }],
        },
        EffectDefinition {
            id: "hue".to_string(),
            name: "Hue Rotation".to_string(),
            description: "Rotate the color hue".to_string(),
            category: EffectCategory::Color,
            parameters: vec![EffectParameter {
                name: "value".to_string(),
                display_name: "Hue".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(0.0),
                min: Some(-180.0),
                max: Some(180.0),
                step: Some(1.0),
            }],
        },
        // Blur effects
        EffectDefinition {
            id: "blur".to_string(),
            name: "Gaussian Blur".to_string(),
            description: "Apply gaussian blur".to_string(),
            category: EffectCategory::Blur,
            parameters: vec![EffectParameter {
                name: "radius".to_string(),
                display_name: "Radius".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(0.0),
                min: Some(0.0),
                max: Some(50.0),
                step: Some(0.1),
            }],
        },
        EffectDefinition {
            id: "sharpen".to_string(),
            name: "Sharpen".to_string(),
            description: "Sharpen the image".to_string(),
            category: EffectCategory::Blur,
            parameters: vec![EffectParameter {
                name: "amount".to_string(),
                display_name: "Amount".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(0.0),
                min: Some(0.0),
                max: Some(2.0),
                step: Some(0.01),
            }],
        },
        // Stylize effects
        EffectDefinition {
            id: "vignette".to_string(),
            name: "Vignette".to_string(),
            description: "Add a vignette effect".to_string(),
            category: EffectCategory::Stylize,
            parameters: vec![
                EffectParameter {
                    name: "intensity".to_string(),
                    display_name: "Intensity".to_string(),
                    param_type: ParameterType::Number,
                    default_value: serde_json::json!(0.0),
                    min: Some(0.0),
                    max: Some(1.0),
                    step: Some(0.01),
                },
                EffectParameter {
                    name: "radius".to_string(),
                    display_name: "Radius".to_string(),
                    param_type: ParameterType::Number,
                    default_value: serde_json::json!(0.5),
                    min: Some(0.1),
                    max: Some(1.0),
                    step: Some(0.01),
                },
            ],
        },
        EffectDefinition {
            id: "grain".to_string(),
            name: "Film Grain".to_string(),
            description: "Add film grain noise".to_string(),
            category: EffectCategory::Stylize,
            parameters: vec![EffectParameter {
                name: "intensity".to_string(),
                display_name: "Intensity".to_string(),
                param_type: ParameterType::Number,
                default_value: serde_json::json!(0.0),
                min: Some(0.0),
                max: Some(1.0),
                step: Some(0.01),
            }],
        },
    ]
}
