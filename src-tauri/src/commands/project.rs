//! Project-related Tauri commands

use crate::project::{Project, ProjectManager};
use crate::Result;
use std::path::PathBuf;
use tauri::command;

/// Create a new project
#[command]
pub async fn create_project(name: String, path: Option<String>) -> Result<Project> {
    let path = path.map(PathBuf::from);
    ProjectManager::create(name, path)
}

/// Load an existing project
#[command]
pub async fn load_project(path: String) -> Result<Project> {
    let path = PathBuf::from(&path);
    ProjectManager::load(&path)
}

/// Save the current project
#[command]
pub async fn save_project(project: Project, path: Option<String>) -> Result<()> {
    let path = path.map(PathBuf::from);
    ProjectManager::save(&project, path.as_deref())
}
