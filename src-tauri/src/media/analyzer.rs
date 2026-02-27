//! Media file analyzer using FFmpeg

use super::WaveformData;
use crate::media::info::AudioInfo;
use crate::media::info::ChapterInfo;
use crate::media::info::MediaInfo;
use crate::media::info::SubtitleInfo;
use crate::{Error, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::ImageEncoder;
use std::collections::HashMap;
use std::path::Path;

use ffmpeg_next::format::input;
use ffmpeg_next::media::Type;
use ffmpeg_next::{self as ffmpeg};

/// Media analyzer for extracting information from media files
pub struct MediaAnalyzer {
    path: std::path::PathBuf,
}

impl MediaAnalyzer {
    /// Create a new media analyzer for the given path
    pub fn new(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Err(Error::NotFound(format!(
                "File not found: {}",
                path.display()
            )));
        }

        // Initialize FFmpeg (safe to call multiple times)
        ffmpeg::init().map_err(|e| Error::FFmpeg(e.to_string()))?;

        Ok(Self {
            path: path.to_path_buf(),
        })
    }

    /// Get comprehensive information about the media file
    pub fn get_info(&self) -> Result<MediaInfo> {
        let context = input(&self.path)?;

        let path_str = self.path.to_string_lossy().to_string();
        let name = self
            .path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let size = std::fs::metadata(&self.path)?.len();
        let duration = context.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;
        let format = context
            .format()
            .name()
            .split(',')
            .next()
            .unwrap_or("unknown")
            .to_string();

        // Extract video info
        let video = context
            .streams()
            .best(Type::Video)
            .and_then(|stream| self.extract_video_info(&stream));

        // Extract audio info
        let audio = context
            .streams()
            .best(Type::Audio)
            .and_then(|stream| self.extract_audio_info(&stream));

        // Extract subtitle info
        let subtitles = context
            .streams()
            .filter(|s| s.parameters().medium() == Type::Subtitle)
            .enumerate()
            .filter_map(|(i, stream)| self.extract_subtitle_info(i, &stream))
            .collect();

        // Extract chapters
        let chapters = context
            .chapters()
            .enumerate()
            .map(|(i, chapter)| {
                let time_base = chapter.time_base();
                let start = chapter.start() as f64 * time_base.numerator() as f64
                    / time_base.denominator() as f64;
                let end = chapter.end() as f64 * time_base.numerator() as f64
                    / time_base.denominator() as f64;

                ChapterInfo {
                    index: i,
                    start,
                    end,
                    title: chapter.metadata().get("title").map(String::from),
                }
            })
            .collect();

        // Extract metadata
        let metadata: HashMap<String, String> = context
            .metadata()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();

        Ok(MediaInfo {
            path: path_str,
            name,
            size,
            duration,
            format,
            video,
            audio,
            subtitles,
            chapters,
            metadata,
        })
    }

    fn extract_video_info(&self, stream: &ffmpeg::Stream) -> Option<super::info::VideoInfo> {
        let params = stream.parameters();

        // Name: keep what you had (but decoder find may fail for some streams)
        let codec = ffmpeg::decoder::find(params.id())?;

        // Build codec context from parameters (new API)
        let ctx = ffmpeg::codec::context::Context::from_parameters(params).ok()?;
        let decoder = ctx.decoder();

        let v = decoder.video().ok()?; // if not video, return None

        let width = v.width();
        let height = v.height();

        let fr = stream.avg_frame_rate();
        let frame_rate = fr.numerator() as f64 / fr.denominator().max(1) as f64;

        // bitrate is available on the stream parameters
        let br = v.bit_rate();
        let bit_rate = Some(br as u64).filter(|&b| b > 0);

        Some(super::info::VideoInfo {
            codec: codec.name().to_string(),
            width,
            height,
            frame_rate,
            bit_rate,
            pixel_format: "unknown".to_string(), // you can fill this from `v.format()` if you want
            color_space: None,
            frame_count: Some(stream.frames() as u64).filter(|&f| f > 0),
        })
    }

    fn extract_audio_info(&self, stream: &ffmpeg::Stream) -> Option<super::info::AudioInfo> {
        let params = stream.parameters();
        let codec = ffmpeg::decoder::find(params.id())?;

        let ctx = ffmpeg::codec::context::Context::from_parameters(params).ok()?;
        let decoder = ctx.decoder();

        let a = decoder.audio().ok()?; // if not audio, return None

        let sample_rate = a.rate();

        // Depending on your ffmpeg-next version, one of these exists:
        // - a.channels()
        // - a.channel_layout().channels()
        // We'll try the common one first.
        let channels = a.channels() as u32;

        let br = a.bit_rate();
        let bit_rate = Some(br as u64).filter(|&b| b > 0);

        Some(AudioInfo {
            codec: codec.name().to_string(),
            sample_rate,
            channels,
            channel_layout: format!("{} channels", channels),
            bit_rate,
            bits_per_sample: None,
        })
    }

    fn extract_subtitle_info(&self, index: usize, stream: &ffmpeg::Stream) -> Option<SubtitleInfo> {
        let params = stream.parameters();
        let codec = ffmpeg::decoder::find(params.id())?;

        let language = stream.metadata().get("language").map(String::from);
        let title = stream.metadata().get("title").map(String::from);

        Some(SubtitleInfo {
            index,
            codec: codec.name().to_string(),
            language,
            title,
        })
    }

    /// Extract a thumbnail at the specified timestamp
    pub fn extract_thumbnail(&self, timestamp: f64, width: u32, height: u32) -> Result<String> {
        let mut context = input(&self.path)?;

        // Find video stream
        let video_stream_index = context
            .streams()
            .best(Type::Video)
            .ok_or_else(|| Error::Media("No video stream found".to_string()))?
            .index();

        // Seek to timestamp
        let seek_target = (timestamp * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
        context.seek(seek_target, seek_target..seek_target)?;

        // Get decoder
        let stream = context.stream(video_stream_index).unwrap();
        let decoder_codec = ffmpeg::decoder::find(stream.parameters().id())
            .ok_or_else(|| Error::Media("Could not find decoder".to_string()))?;

        let mut decoder = ffmpeg::codec::context::Context::new_with_codec(decoder_codec)
            .decoder()
            .video()?;

        // Decode frames until we get one
        let mut frame = ffmpeg::frame::Video::empty();

        for (stream, packet) in context.packets() {
            if stream.index() == video_stream_index {
                decoder.send_packet(&packet)?;

                if decoder.receive_frame(&mut frame).is_ok() {
                    break;
                }
            }
        }

        if frame.width() == 0 {
            return Err(Error::Media("Could not decode frame".to_string()));
        }

        // Scale to target size
        let mut scaler = ffmpeg::software::scaling::context::Context::get(
            frame.format(),
            frame.width(),
            frame.height(),
            ffmpeg::format::Pixel::RGB24,
            width,
            height,
            ffmpeg::software::scaling::flag::Flags::BILINEAR,
        )?;

        let mut rgb_frame = ffmpeg::frame::Video::empty();
        scaler.run(&frame, &mut rgb_frame)?;

        // IMPORTANT: ffmpeg frames can be padded (stride != width*3)
        let stride = rgb_frame.stride(0);
        let w = width as usize;
        let h = height as usize;

        let src = rgb_frame.data(0);
        let row_bytes = w * 3;

        // Pack into a tightly packed RGB buffer
        let mut packed = vec![0u8; row_bytes * h];
        for y in 0..h {
            let src_row = &src[y * stride..y * stride + row_bytes];
            let dst_row = &mut packed[y * row_bytes..(y + 1) * row_bytes];
            dst_row.copy_from_slice(src_row);
        }
        // Encode PNG
        let mut png_data = Vec::new();
        {
            let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
            encoder.write_image(&packed, width, height, image::ColorType::Rgb8.into())?;
        }

        // Return as base64 data URL
        let base64_data = BASE64.encode(&png_data);
        Ok(format!("data:image/png;base64,{}", base64_data))
        // // Convert to PNG using image crate
        // let img = image::RgbImage::from_raw(width, height, rgb_frame.data(0).to_vec())
        //     .ok_or_else(|| Error::Media("Failed to create image buffer".to_string()))?;

        // let mut png_data = Vec::new();
        // let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
        // // encoder.write_image(&img, width, height, image::ColorType::Rgb8.into())?;
        // // encoder.encode(&img, width, height, image::ColorType::Rgb8.into())?;

        // // Return as base64 data URL
        // let base64_data = BASE64.encode(&png_data);
        // Ok(format!("data:image/png;base64,{}", base64_data))
    }

    /// Extract audio waveform data
    pub fn extract_waveform(&self, num_samples: usize) -> Result<WaveformData> {
        let mut context = input(&self.path)?;

        // Find audio stream
        let audio_stream_index = context
            .streams()
            .best(Type::Audio)
            .ok_or_else(|| Error::Media("No audio stream found".to_string()))?
            .index();

        let stream = context.stream(audio_stream_index).unwrap();
        let duration = context.duration() as f64 / ffmpeg::ffi::AV_TIME_BASE as f64;

        // Get decoder
        let decoder_codec = ffmpeg::decoder::find(stream.parameters().id())
            .ok_or_else(|| Error::Media("Could not find audio decoder".to_string()))?;

        let mut decoder = ffmpeg::codec::context::Context::new_with_codec(decoder_codec)
            .decoder()
            .audio()?;

        // Collect all audio samples
        let mut all_samples: Vec<f32> = Vec::new();
        let mut frame = ffmpeg::frame::Audio::empty();

        for (stream, packet) in context.packets() {
            if stream.index() == audio_stream_index {
                decoder.send_packet(&packet)?;

                while decoder.receive_frame(&mut frame).is_ok() {
                    // Convert to f32 samples (simplified - assumes planar float)
                    let data = frame.data(0);
                    let samples: Vec<f32> = data
                        .chunks(4)
                        .filter_map(|chunk| {
                            if chunk.len() == 4 {
                                Some(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                            } else {
                                None
                            }
                        })
                        .collect();
                    all_samples.extend(samples);
                }
            }
        }

        Ok(WaveformData::from_samples(
            &all_samples,
            duration,
            num_samples,
        ))
    }
}
