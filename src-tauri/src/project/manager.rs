//! Project manager for creating, loading, and saving projects

use super::{AssetLibrary, Composition, Project, ProjectSettings};
use crate::{Error, Result};
use chrono::Utc;
use std::fs;
use std::path::Path;
use uuid::Uuid;

/// Project manager for handling project lifecycle
pub struct ProjectManager;

impl ProjectManager {
    /// Create a new project
    pub fn create(name: String, path: Option<std::path::PathBuf>) -> Result<Project> {
        let now = Utc::now();

        let project = Project {
            id: Uuid::new_v4(),
            name,
            version: "1.0.0".to_string(),
            created_at: now,
            updated_at: now,
            settings: ProjectSettings::default(),
            assets: AssetLibrary::default(),
            composition: Composition::default(),
            file_path: path.map(|p| p.to_string_lossy().to_string()),
        };

        // Save immediately if path provided
        if let Some(ref file_path) = project.file_path {
            Self::save(&project, Some(Path::new(file_path)))?;
        }

        Ok(project)
    }

    /// Load a project from file
    pub fn load(path: &Path) -> Result<Project> {
        if !path.exists() {
            return Err(Error::NotFound(format!(
                "Project file not found: {}",
                path.display()
            )));
        }

        let content = fs::read_to_string(path)?;
        let mut project: Project = serde_json::from_str(&content)?;

        // Update file path to current location
        project.file_path = Some(path.to_string_lossy().to_string());

        log::info!("Loaded project '{}' from {}", project.name, path.display());

        Ok(project)
    }

    /// Save a project to file
    pub fn save(project: &Project, path: Option<&Path>) -> Result<()> {
        let save_path = path
            .map(|p| p.to_path_buf())
            .or_else(|| project.file_path.as_ref().map(std::path::PathBuf::from))
            .ok_or_else(|| Error::Project("No save path specified".to_string()))?;

        // Ensure parent directory exists
        if let Some(parent) = save_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Serialize with pretty printing
        let content = serde_json::to_string_pretty(project)?;
        fs::write(&save_path, content)?;

        log::info!(
            "Saved project '{}' to {}",
            project.name,
            save_path.display()
        );

        Ok(())
    }

    /// Export project to a specific format
    pub fn export(project: &Project, path: &Path, _format: &str) -> Result<()> {
        // For now, just save as JSON regardless of format
        // TODO: Support different export formats (e.g., EDL, XML)
        Self::save(project, Some(path))
    }

    /// Validate a project
    pub fn validate(project: &Project) -> Result<Vec<String>> {
        let mut warnings = Vec::new();

        // Check for missing assets
        for track in &project.composition.tracks {
            for item in &track.items {
                let asset_exists = project.assets.images.iter().any(|a| a.id == item.asset_id)
                    || project.assets.audio.iter().any(|a| a.id == item.asset_id)
                    || project.assets.video.iter().any(|a| a.id == item.asset_id);

                if !asset_exists {
                    warnings.push(format!(
                        "Track '{}' references missing asset: {}",
                        track.name, item.asset_id
                    ));
                }
            }
        }

        // Check for overlapping items (simplified check)
        for track in &project.composition.tracks {
            let mut items: Vec<_> = track.items.iter().collect();
            items.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());

            for window in items.windows(2) {
                if let [a, b] = window {
                    let a_end = a.start_time + a.duration;
                    if a_end > b.start_time {
                        warnings.push(format!(
                            "Track '{}' has overlapping items at {:.2}s",
                            track.name, b.start_time
                        ));
                    }
                }
            }
        }

        Ok(warnings)
    }
}
