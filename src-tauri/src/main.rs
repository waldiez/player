//! Waldiez Player - Main entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use waldiez_player_lib::commands;

fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting Waldiez Player...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Media commands
            commands::media::get_media_info,
            commands::media::extract_thumbnail,
            commands::media::extract_audio_waveform,
            // Project commands
            commands::project::create_project,
            commands::project::load_project,
            commands::project::save_project,
            // Render commands
            commands::render::start_render,
            commands::render::cancel_render,
            commands::render::get_render_progress,
            // Effect commands
            commands::effects::apply_effect,
            commands::effects::get_available_effects,
        ])
        .setup(|_appp| {
            log::info!("Waldiez Player initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
