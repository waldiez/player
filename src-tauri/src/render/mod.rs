//! Render manager for handling video export

use crate::project::{Project, ProjectManager};
use crate::{Error, Result};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::async_runtime::spawn;
use tokio::time::sleep;
use uuid::Uuid;

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
        let job_id = Uuid::new_v4().to_string();
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

pub struct RenderManager;

impl RenderManager {
    pub async fn start_render(
        project_path: &str,
        settings: RenderSettings,
        output_path: &str,
    ) -> Result<String> {
        let project = ProjectManager::load(Path::new(project_path))?;
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
    _project: Project,
    _settings: RenderSettings,
    _output_path: PathBuf,
    _job: Arc<Mutex<RenderJob>>,
) -> Result<String> {
    // TODO: This is the core rendering logic.
    // 1. Setup ffmpeg_next contexts (input, output, filter graph).
    // 2. Build a complex filter graph based on the project timeline.
    //    - Each track item is an input source.
    //    - Effects are chained filters.
    //    - Transitions are complex filter chains (e.g., using xfade).
    //    - Audio tracks need to be mixed using amix.
    // 3. Loop through time, read frames from sources, process through graph, and write to output.
    // 4. Update progress periodically by calling `job.lock().unwrap().update_progress(...)`.
    // 5. Check for cancellation `job.lock().unwrap().progress.status == RenderStatus::Cancelled`.

    // For now, we'll simulate a long render and then succeed.
    for i in 1..=10 {
        // Check for cancellation
        if _job.lock().unwrap().progress.status == RenderStatus::Cancelled {
            return Err(Error::Render("Render was cancelled".to_string()));
        }

        sleep(std::time::Duration::from_secs(1)).await;
        let progress = i as f64 / 10.0;
        _job.lock().unwrap().update_progress(
            RenderStatus::Rendering,
            progress,
            &format!("Rendering... {}%", (progress * 100.0) as u32),
        );
    }

    Ok(_output_path.to_string_lossy().to_string())
}
