//! Render-related Tauri commands

use crate::render::{RenderManager, RenderProgress, RenderSettings};
use crate::Result;
use tauri::command;

/// Start a render job
#[command]
pub async fn start_render(
    project_path: String,
    settings: RenderSettings,
    output_path: String,
) -> Result<String> {
    RenderManager::start_render(&project_path, settings, &output_path).await
}

/// Cancel a running render job
#[command]
pub async fn cancel_render(job_id: String) -> Result<()> {
    RenderManager::cancel_render(&job_id)
}

/// Get the progress of a render job
#[command]
pub async fn get_render_progress(job_id: String) -> Result<RenderProgress> {
    RenderManager::get_progress(&job_id)
}
