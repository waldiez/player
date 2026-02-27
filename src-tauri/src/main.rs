//! Waldiez Player - Main entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;
use waldiez_player_lib::commands;
use waldiez_player_lib::commands::mpv::{MpvInner, MpvState};

fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting Waldiez Player...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // mpv singleton state — starts as None, lazily initialised on first mpv_load
        .manage(MpvState(Arc::new(Mutex::new(None::<MpvInner>))))
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
            // yt-dlp commands
            commands::ytdlp::yt_check,
            commands::ytdlp::yt_get_audio_url,
            commands::ytdlp::yt_get_video_info,
            // mpv commands
            commands::mpv::mpv_check,
            commands::mpv::mpv_load,
            commands::mpv::mpv_pause,
            commands::mpv::mpv_resume,
            commands::mpv::mpv_seek,
            commands::mpv::mpv_set_volume,
            commands::mpv::mpv_set_speed,
            commands::mpv::mpv_stop,
            commands::mpv::mpv_quit,
        ])
        .setup(|_app| {
            log::info!("Waldiez Player initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
