//! Render manager for handling video export

use crate::project::{Project, ProjectManager};
use crate::wid::next_wid;
use crate::{Error, Result};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::async_runtime::spawn;
use tempfile::tempdir;
use tokio::process::Command;
use tokio::time::sleep;

lazy_static! {
    static ref RENDER_JOBS: Arc<Mutex<HashMap<String, Arc<Mutex<RenderJob>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSettings {
    pub resolution: (u32, u32),
    pub frame_rate: f64,
    pub format: String,
    pub quality: RenderQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RenderQuality {
    Low,
    Medium,
    High,
    Lossless,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgress {
    pub job_id: String,
    pub status: RenderStatus,
    pub progress: f64,
    pub message: String,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RenderStatus {
    Queued,
    Rendering,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug)]
pub struct RenderJob {
    pub id: String,
    pub project: Project,
    pub settings: RenderSettings,
    pub output_path: PathBuf,
    pub progress: RenderProgress,
}

impl RenderJob {
    fn new(project: Project, settings: RenderSettings, output_path: PathBuf) -> Self {
        let job_id = next_wid();
        Self {
            id: job_id.clone(),
            project,
            settings,
            output_path,
            progress: RenderProgress {
                job_id,
                status: RenderStatus::Queued,
                progress: 0.0,
                message: "Waiting to start".to_string(),
                output_path: None,
            },
        }
    }

    fn update_progress(&mut self, status: RenderStatus, progress: f64, message: &str) {
        self.progress.status = status;
        self.progress.progress = progress;
        self.progress.message = message.to_string();
    }
}

#[derive(Clone)]
struct TimelineScene {
    title: String,
    start_time: f64,
    duration: f64,
    caption_text: String,
    visual_path: Option<String>,
    visual_kind: Option<crate::project::TrackType>,
    audio_path: Option<String>,
    audio_offset: f64,
    audio_volume: f64,
}

pub struct RenderManager;

impl RenderManager {
    pub async fn start_render(
        project_path: &str,
        settings: RenderSettings,
        output_path: &str,
    ) -> Result<String> {
        let project = ProjectManager::load(Path::new(project_path))?;
        Self::start_render_for_project(project, settings, output_path).await
    }

    pub async fn start_render_for_project(
        project: Project,
        settings: RenderSettings,
        output_path: &str,
    ) -> Result<String> {
        let job = Arc::new(Mutex::new(RenderJob::new(
            project,
            settings,
            PathBuf::from(output_path),
        )));
        let job_id = job.lock().unwrap().id.clone();

        RENDER_JOBS
            .lock()
            .unwrap()
            .insert(job_id.clone(), job.clone());

        spawn(async move {
            let (project, settings, output_path) = {
                let mut job_lock = job.lock().unwrap();
                job_lock.update_progress(RenderStatus::Rendering, 0.0, "Starting render...");

                // Make a clone of necessary data for the rendering task
                let project = job_lock.project.clone();
                let settings = job_lock.settings.clone();
                let output_path = job_lock.output_path.clone();

                // job_lock is dropped here when the inner scope ends
                (project, settings, output_path)
            };

            let render_result = run_render_task(project, settings, output_path, job.clone()).await;

            let mut job_lock = job.lock().unwrap();
            match render_result {
                Ok(path) => {
                    job_lock.update_progress(RenderStatus::Completed, 1.0, "Render finished");
                    job_lock.progress.output_path = Some(path);
                }
                Err(e) => {
                    job_lock.update_progress(RenderStatus::Failed, 0.0, &e.to_string());
                }
            }
        });

        Ok(job_id)
    }

    pub fn cancel_render(job_id: &str) -> Result<()> {
        if let Some(job_arc) = RENDER_JOBS.lock().unwrap().get(job_id) {
            // Read status under a short-lived lock to avoid holding an immutable borrow
            let status = {
                let job = job_arc.lock().unwrap();
                job.progress.status.clone()
            };
            if status == RenderStatus::Rendering || status == RenderStatus::Queued {
                // Read current progress under a short-lived lock to avoid simultaneous borrows
                let current_progress = {
                    let job = job_arc.lock().unwrap();
                    job.progress.progress
                };
                let mut job = job_arc.lock().unwrap();
                job.update_progress(
                    RenderStatus::Cancelled,
                    current_progress,
                    "Render cancelled by user",
                );
                // The render loop should check for this status and exit gracefully.
                return Ok(());
            }
        }
        Err(Error::NotFound("Render job not found".to_string()))
    }

    pub fn get_progress(job_id: &str) -> Result<RenderProgress> {
        RENDER_JOBS
            .lock()
            .unwrap()
            .get(job_id)
            .map(|job| job.lock().unwrap().progress.clone())
            .ok_or_else(|| Error::NotFound("Render job not found".to_string()))
    }
}

async fn run_render_task(
    project: Project,
    settings: RenderSettings,
    output_path: PathBuf,
    job: Arc<Mutex<RenderJob>>,
) -> Result<String> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let steps = [
        (0.15, "Preparing scene timeline"),
        (0.4, "Building output document"),
        (0.75, "Writing export"),
        (0.95, "Finalizing export"),
    ];

    for (progress, message) in steps {
        if job.lock().unwrap().progress.status == RenderStatus::Cancelled {
            return Err(Error::Cancelled);
        }
        job.lock()
            .unwrap()
            .update_progress(RenderStatus::Rendering, progress, message);
        sleep(std::time::Duration::from_millis(180)).await;
    }

    let rendered = match settings.format.as_str() {
        "html" => render_storyboard_html(&project, &settings),
        "srt" => render_storyboard_srt(&project),
        "json" => serde_json::to_string_pretty(&project)?,
        "mp4" => return render_video_mp4(&project, &settings, &output_path, job.clone()).await,
        other => {
            return Err(Error::Render(format!(
                "Unsupported render format '{other}'. Use mp4, html, srt, or json."
            )))
        }
    };

    fs::write(&output_path, rendered)?;

    Ok(output_path.to_string_lossy().to_string())
}

async fn render_video_mp4(
    project: &Project,
    settings: &RenderSettings,
    output_path: &Path,
    job: Arc<Mutex<RenderJob>>,
) -> Result<String> {
    let timeline = collect_timeline_scenes(project);
    let total_duration = timeline
        .last()
        .map(|scene| scene.start_time + scene.duration)
        .unwrap_or(0.0);
    if total_duration <= 0.0 {
        return Err(Error::Render(
            "Cannot render video for a project with zero total duration.".to_string(),
        ));
    }

    let ffmpeg_ok = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .await
        .map(|result| result.status.success())
        .unwrap_or(false);

    if !ffmpeg_ok {
        let fallback = output_path.with_extension("html");
        job.lock().unwrap().update_progress(
            RenderStatus::Rendering,
            0.85,
            "ffmpeg not found, exporting storyboard HTML fallback",
        );
        fs::write(&fallback, render_storyboard_html(project, settings))?;
        return Ok(fallback.to_string_lossy().to_string());
    }

    let temp = tempdir()?;
    let subtitles_path = temp.path().join("captions.srt");
    fs::write(&subtitles_path, render_storyboard_srt(project))?;

    let background = project
        .settings
        .background_color
        .trim_start_matches('#')
        .to_string();
    let subtitles_filter = format!(
        "subtitles={}:force_style='FontName=Sans,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=40'",
        ffmpeg_filter_escape(&subtitles_path)
    );

    job.lock().unwrap().update_progress(
        RenderStatus::Rendering,
        0.88,
        "Running ffmpeg video render",
    );

    let mut command = Command::new("ffmpeg");
    command.arg("-y");

    let mut audio_labels = Vec::new();
    let mut filter_parts = Vec::new();
    let video_background = format!(
        "color=c=0x{}:s={}x{}:r={}:d={}",
        background,
        settings.resolution.0,
        settings.resolution.1,
        settings.frame_rate,
        total_duration
    );
    command.args(["-f", "lavfi", "-i", &video_background]);

    let mut overlay_chain = String::from("[0:v]setpts=PTS-STARTPTS[base0]");
    let mut next_input_index = 1usize;
    for (index, scene) in timeline.iter().enumerate() {
        let visual_input_index = next_input_index;
        next_input_index += 1;
        append_scene_visual_input(&mut command, scene);
        filter_parts.push(scene_video_filter_chain(
            index,
            visual_input_index,
            scene,
            settings,
        ));
        overlay_chain.push_str(&format!(
            ";[base{index}][v{index}]overlay=shortest=0:eof_action=pass:enable='between(t,{},{})'[base{}]",
            scene.start_time,
            scene.start_time + scene.duration,
            index + 1
        ));

        if let Some(audio_path) = scene.audio_path.as_deref() {
            let audio_input_index = next_input_index;
            next_input_index += 1;
            append_scene_audio_input(&mut command, audio_path);
            filter_parts.push(scene_audio_filter_chain(index, audio_input_index, scene));
            audio_labels.push(format!("[a{index}]"));
        }
    }

    let video_chain = format!("[base{}]{}[vout]", timeline.len(), subtitles_filter);
    let audio_chain = if audio_labels.is_empty() {
        String::new()
    } else {
        format!(
            ";{}amix=inputs={}:normalize=0:dropout_transition=0[aout]",
            audio_labels.join(""),
            audio_labels.len()
        )
    };
    let filter_complex = format!(
        "{};{};{}{}",
        filter_parts.join(";"),
        overlay_chain,
        video_chain,
        audio_chain
    );

    let quality_args = video_quality_args(&settings.quality);
    command
        .arg("-filter_complex")
        .arg(&filter_complex)
        .args(["-map", "[vout]"])
        .args(if audio_labels.is_empty() {
            &[][..]
        } else {
            &["-map", "[aout]"][..]
        })
        .args(quality_args)
        .args([
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-shortest",
        ])
        .arg(output_path);

    let status = command.status().await?;

    if !status.success() {
        let fallback = output_path.with_extension("html");
        job.lock().unwrap().update_progress(
            RenderStatus::Rendering,
            0.92,
            "ffmpeg render failed, exporting storyboard HTML fallback",
        );
        fs::write(&fallback, render_storyboard_html(project, settings))?;
        return Ok(fallback.to_string_lossy().to_string());
    }

    Ok(output_path.to_string_lossy().to_string())
}

fn append_scene_visual_input(command: &mut Command, scene: &TimelineScene) {
    match (&scene.visual_kind, &scene.visual_path) {
        (Some(crate::project::TrackType::Image), Some(path)) => {
            command
                .args(["-loop", "1", "-t", &scene.duration.to_string(), "-i"])
                .arg(path);
        }
        (Some(crate::project::TrackType::Video), Some(path)) => {
            command
                .args([
                    "-stream_loop",
                    "-1",
                    "-t",
                    &scene.duration.to_string(),
                    "-i",
                ])
                .arg(path);
        }
        _ => {
            command.args(["-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.1"]);
        }
    }
}

fn append_scene_audio_input(command: &mut Command, path: &str) {
    command.args(["-stream_loop", "-1", "-i"]).arg(path);
}

fn scene_video_filter_chain(
    index: usize,
    input_index: usize,
    scene: &TimelineScene,
    settings: &RenderSettings,
) -> String {
    let base = format!("[{input_index}:v]");
    let scaled = match scene.visual_kind {
        Some(crate::project::TrackType::Image) | Some(crate::project::TrackType::Video) => format!(
            "{base}scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2,trim=duration={},setpts=PTS-STARTPTS,fps={}[v{index}]",
            settings.resolution.0,
            settings.resolution.1,
            settings.resolution.0,
            settings.resolution.1,
            scene.duration,
            settings.frame_rate
        ),
        _ => format!(
            "{base}scale={}:{}:flags=lanczos,trim=duration={},setpts=PTS-STARTPTS,fps={}[v{index}]",
            settings.resolution.0,
            settings.resolution.1,
            scene.duration,
            settings.frame_rate
        ),
    };
    scaled
}

fn scene_audio_filter_chain(index: usize, input_index: usize, scene: &TimelineScene) -> String {
    let delay_ms = (scene.start_time.max(0.0) * 1000.0).round() as u64;
    let end = (scene.audio_offset + scene.duration).max(scene.audio_offset);
    format!(
        "[{input_index}:a]atrim=start={}:end={},asetpts=PTS-STARTPTS,volume={},adelay={}|{}[a{index}]",
        scene.audio_offset.max(0.0),
        end,
        scene.audio_volume.max(0.0),
        delay_ms,
        delay_ms
    )
}

fn video_quality_args(quality: &RenderQuality) -> [&'static str; 4] {
    match quality {
        RenderQuality::Low => ["-c:v", "libx264", "-preset", "veryfast"],
        RenderQuality::Medium => ["-c:v", "libx264", "-preset", "fast"],
        RenderQuality::High => ["-c:v", "libx264", "-preset", "medium"],
        RenderQuality::Lossless => ["-c:v", "libx264", "-crf", "0"],
    }
}

fn render_storyboard_html(project: &Project, settings: &RenderSettings) -> String {
    let scenes = collect_timeline_scenes(project)
        .iter()
        .enumerate()
        .map(|(index, scene)| {
            format!(
                r#"<section class="scene"><div class="meta">Scene {} · {:.0}s</div><h2>{}</h2>{}<pre>{}</pre></section>"#,
                index + 1,
                scene.duration,
                escape_html(&scene.title),
                if scene.visual_path.as_deref().unwrap_or_default().is_empty() {
                    "".to_string()
                } else {
                    let kind = match scene.visual_kind {
                        Some(crate::project::TrackType::Image) => "image",
                        Some(crate::project::TrackType::Video) => "video",
                        _ => "background",
                    };
                    format!(
                        r#"<div class="asset">{} · {}</div>"#,
                        kind,
                        escape_html(scene.visual_path.as_deref().unwrap_or_default())
                    )
                },
                escape_html(&scene.caption_text)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>
    :root {{ color-scheme: dark; }}
    body {{ margin:0; font-family: "IBM Plex Sans", sans-serif; background: linear-gradient(180deg,#08111a,#0f172a); color:#f8fafc; }}
    header {{ padding:48px; border-bottom:1px solid rgba(255,255,255,0.1); background: radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 38%); }}
    h1 {{ margin:0 0 8px; font-size:40px; }}
    main {{ padding:32px; display:grid; gap:20px; }}
    .scene {{ border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:24px; background: rgba(255,255,255,0.04); }}
    .meta {{ font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8; }}
    h2 {{ margin:12px 0; font-size:22px; }}
    .asset {{ margin:0 0 12px; color:#5eead4; font-size:14px; }}
    pre {{ margin:0; white-space:pre-wrap; font:16px/1.8 "IBM Plex Mono", monospace; }}
  </style>
</head>
<body>
  <header>
    <h1>{title}</h1>
    <p>{scene_count} scenes · {width}x{height} · {fps:.0} fps · {quality}</p>
  </header>
  <main>{scenes}</main>
</body>
</html>"#,
        title = escape_html(&project.name),
        scene_count = project.composition.markers.len().max(1),
        width = settings.resolution.0,
        height = settings.resolution.1,
        fps = settings.frame_rate,
        quality = format!("{:?}", settings.quality).to_lowercase(),
        scenes = scenes
    )
}

fn render_storyboard_srt(project: &Project) -> String {
    let mut lines = Vec::new();
    let mut items = project
        .composition
        .tracks
        .iter()
        .filter(|track| matches!(track.track_type, crate::project::TrackType::Caption))
        .flat_map(|track| track.items.iter())
        .collect::<Vec<_>>();
    items.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());

    for (index, item) in items.iter().enumerate() {
        let caption = project
            .assets
            .captions
            .iter()
            .find(|caption| caption.id == item.asset_id);
        let body = caption
            .map(|entry| decode_caption_path(&entry.path))
            .unwrap_or_else(|| caption.map(|entry| entry.name.clone()).unwrap_or_default());
        lines.push(format!("{}", index + 1));
        lines.push(format!(
            "{} --> {}",
            srt_timestamp(item.start_time),
            srt_timestamp(item.start_time + item.duration)
        ));
        lines.push(body.trim().to_string());
        lines.push(String::new());
    }

    format!("{}\n", lines.join("\n"))
}

fn srt_timestamp(seconds: f64) -> String {
    let seconds = seconds.max(0.0);
    let total_millis = (seconds * 1000.0).round() as u64;
    let hours = total_millis / 3_600_000;
    let minutes = (total_millis % 3_600_000) / 60_000;
    let secs = (total_millis % 60_000) / 1000;
    let millis = total_millis % 1000;
    format!("{hours:02}:{minutes:02}:{secs:02},{millis:03}")
}

fn decode_caption_path(path: &str) -> String {
    let prefix = "data:text/plain;charset=utf-8,";
    if let Some(encoded) = path.strip_prefix(prefix) {
        urlencoding::decode(encoded)
            .map(|value| value.into_owned())
            .unwrap_or_else(|_| encoded.to_string())
    } else {
        path.to_string()
    }
}

fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn ffmpeg_filter_escape(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .replace(':', "\\:")
        .replace('\'', "\\'")
}

fn collect_timeline_scenes(project: &Project) -> Vec<TimelineScene> {
    let visual_tracks = project
        .composition
        .tracks
        .iter()
        .filter(|track| {
            matches!(
                track.track_type,
                crate::project::TrackType::Image | crate::project::TrackType::Video
            )
        })
        .collect::<Vec<_>>();
    let audio_tracks = project
        .composition
        .tracks
        .iter()
        .filter(|track| matches!(track.track_type, crate::project::TrackType::Audio))
        .collect::<Vec<_>>();

    let mut scenes = project
        .composition
        .tracks
        .iter()
        .filter(|track| matches!(track.track_type, crate::project::TrackType::Caption))
        .flat_map(|track| track.items.iter())
        .map(|item| {
            let caption = project
                .assets
                .captions
                .iter()
                .find(|caption| caption.id == item.asset_id);
            let visual = visual_tracks.iter().find_map(|track| {
                track
                    .items
                    .iter()
                    .find(|visual_item| visual_item.start_time == item.start_time)
                    .map(|visual_item| (&track.track_type, visual_item.asset_id.as_str()))
            });
            let visual_path = match visual {
                Some((crate::project::TrackType::Image, asset_id)) => project
                    .assets
                    .images
                    .iter()
                    .find(|asset| asset.id == asset_id)
                    .map(|asset| asset.path.clone()),
                Some((crate::project::TrackType::Video, asset_id)) => project
                    .assets
                    .video
                    .iter()
                    .find(|asset| asset.id == asset_id)
                    .map(|asset| asset.path.clone()),
                _ => None,
            };
            let audio_item = audio_tracks.iter().find_map(|track| {
                track
                    .items
                    .iter()
                    .find(|audio_item| audio_item.start_time == item.start_time)
            });
            let audio_path = audio_item.and_then(|audio_item| {
                project
                    .assets
                    .audio
                    .iter()
                    .find(|asset| asset.id == audio_item.asset_id)
                    .map(|asset| asset.path.clone())
            });

            TimelineScene {
                title: caption
                    .map(|entry| entry.name.clone())
                    .unwrap_or_else(|| "Scene".to_string()),
                start_time: item.start_time,
                duration: item.duration,
                caption_text: caption
                    .map(|entry| decode_caption_path(&entry.path))
                    .unwrap_or_default(),
                visual_path,
                visual_kind: visual.map(|(kind, _)| kind.clone()),
                audio_path,
                audio_offset: audio_item.map(|item| item.in_point).unwrap_or(0.0),
                audio_volume: audio_item.map(|item| item.transform.opacity).unwrap_or(0.8),
            }
        })
        .collect::<Vec<_>>();

    scenes.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    scenes
}
