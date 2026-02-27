//! Effect-related Tauri commands
use crate::effects;
use crate::{Error, Result};
use ffmpeg_next as ffmpeg;
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
    let input = PathBuf::from(&input_path);
    let output = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let temp_dir = Builder::new().prefix("waldiez_").tempdir()?;
            temp_dir.path().join(format!("effect_{}.mp4", effect_id))
        }
    };

    let filter_str = effects::get_ffmpeg_filter(&effect_id, &parameters)?;

    let mut ictx = ffmpeg::format::input(&input)?;
    let mut octx = ffmpeg::format::output(&output)?;

    let mut stream_mapping = vec![usize::MAX; ictx.nb_streams() as usize];
    let mut best_video_stream: Option<usize> = None;

    for (i, ist) in ictx.streams().enumerate() {
        // Pick the first video stream as "best" (you can improve later)
        if best_video_stream.is_none() && ist.parameters().medium() == ffmpeg::media::Type::Video {
            best_video_stream = Some(i);
        }

        // Create an output stream without relying on `ist.codec()`.
        // In ffmpeg-next 8.x, the safe way is to add a stream by codec id when you actually encode.
        // For "copy/remux" scaffolding, we can add a stream using the same codec id from parameters.
        let codec_id = ist.parameters().id();

        // `find(codec_id)` returns a codec descriptor (decoder/encoder). We just need something
        // to satisfy add_stream; parameters are set right after.
        let codec = ffmpeg::codec::decoder::find(codec_id)
            .or_else(|| ffmpeg::codec::encoder::find(codec_id))
            .ok_or_else(|| Error::Media(format!("Unsupported codec id: {:?}", codec_id)))?;

        let mut ost = octx.add_stream(codec)?;
        ost.set_parameters(ist.parameters());

        stream_mapping[i] = ost.index();
    }

    let video_stream_index =
        best_video_stream.ok_or_else(|| Error::Media("No video stream found".into()))?;

    let filter = format!("[in]{}[out]", filter_str);
    let mut graph = ffmpeg::filter::Graph::new();
    let stream = ictx.stream(video_stream_index).unwrap();
    let params = stream.parameters();
    let ctx = ffmpeg::codec::context::Context::from_parameters(params)?;
    let decoder = ctx.decoder();

    let (w, h) = if let Ok(v) = decoder.video() {
        (v.width(), v.height())
    } else {
        (0, 0)
    };

    graph.add(
        &ffmpeg::filter::find("buffer").unwrap(),
        "in",
        &format!(
            "video_size={}x{}:pix_fmt={}:time_base={}:pixel_aspect={}",
            w, h, "yuv420p", "1/25", "1/1"
        ),
    )?;
    graph.add(&ffmpeg::filter::find("buffersink").unwrap(), "out", "")?;
    graph.parse(&filter)?;
    graph.validate()?;

    octx.write_header()?;

    for (stream, packet) in ictx.packets() {
        if stream.index() == video_stream_index {
            // How to apply filter graph? This is getting complicated.
            // For a single command, it's easier to use std::process::Command
        }

        let mut packet = packet;
        packet.rescale_ts(
            stream.time_base(),
            octx.stream(stream_mapping[stream.index()])
                .unwrap()
                .time_base(),
        );
        packet.set_stream(stream_mapping[stream.index()]);
        packet.write_interleaved(&mut octx)?;
    }

    octx.write_trailer()?;

    // The above is complex. For now, let's just return a placeholder.
    // The real implementation will be part of the render manager.
    // This command is more for previewing single effects.

    // For now, let's use the command line ffmpeg for simplicity.
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
