//! Effects processing logic

use crate::Error;
use serde_json::Value;

pub fn get_ffmpeg_filter(effect_id: &str, parameters: &Value) -> Result<String, Error> {
    match effect_id {
        "brightness" => {
            let value = parameters["value"].as_f64().unwrap_or(1.0) - 1.0;
            Ok(format!("eq=brightness={}", value))
        }
        "contrast" => {
            let value = parameters["value"].as_f64().unwrap_or(1.0);
            Ok(format!("eq=contrast={}", value))
        }
        "saturation" => {
            let value = parameters["value"].as_f64().unwrap_or(1.0);
            Ok(format!("eq=saturation={}", value))
        }
        "hue" => {
            let value = parameters["value"].as_f64().unwrap_or(0.0);
            Ok(format!("hue=h={}", value))
        }
        "blur" => {
            let radius = parameters["radius"].as_f64().unwrap_or(0.0);
            Ok(format!("gblur=sigma={}", radius))
        }
        "sharpen" => {
            let amount = parameters["amount"].as_f64().unwrap_or(0.0);
            Ok(format!("unsharp=luma_amount={}", amount))
        }
        "vignette" => {
            let intensity = parameters["intensity"].as_f64().unwrap_or(0.0);
            // A simple way to map intensity to FFmpeg's vignette angle
            let angle = 90.0 + (intensity * 80.0);
            Ok(format!("vignette=angle={}", angle))
        }
        "grain" => {
            let intensity = parameters["intensity"].as_f64().unwrap_or(0.0);
            let strength = (intensity * 50.0) as u32;
            Ok(format!("noise=all_s={}:all_f=t", strength))
        }
        _ => Err(Error::Effect(format!("Unknown effect: {}", effect_id))),
    }
}
