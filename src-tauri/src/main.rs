//! Waldiez Player - Main entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use waldiez_player_lib::commands;
use waldiez_player_lib::commands::mpv::{MpvInner, MpvState};
use waldiez_player_lib::tray;

/// Emit a `file-opened` event to all webview windows with the given path.
fn emit_file_opened(app: &tauri::AppHandle, path: &str) {
    let _ = app.emit("file-opened", path.to_string());
}

/// Ensure mpv daemon is stopped when the application exits.
fn shutdown_mpv(app: &tauri::AppHandle) {
    let state = app.state::<MpvState>();
    tauri::async_runtime::block_on(async {
        commands::mpv::shutdown_mpv_state(&state).await;
    });
}

#[tauri::command]
fn tray_update(_name: String, _is_playing: bool) {
    // Tooltip update — no-op for now; tray menu is static
    // Future: update tray icon or menu title based on track name
}

fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting Waldiez Player...");

    // Collect file paths from CLI arguments (Windows / Linux file-association path).
    // On macOS, file opens arrive via RunEvent::Opened (handled by the deep-link plugin).
    // Skip the first arg (executable name) and keep only paths that exist on disk.
    let file_paths: Vec<String> = std::env::args()
        .skip(1)
        .filter(|a| std::path::Path::new(a).exists())
        .collect();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // mpv singleton state — starts as None, lazily initialised on first mpv_load
        .manage(MpvState(Arc::new(Mutex::new(None::<MpvInner>))))
        .invoke_handler(tauri::generate_handler![
            // Tray command
            tray_update,
            // Media commands
            commands::media::get_media_info,
            commands::media::extract_thumbnail,
            commands::media::extract_audio_waveform,
            commands::media::pdf_check,
            commands::media::pdf_get_info,
            commands::media::pdf_extract_text,
            commands::media::pdf_render_page,
            // Project commands
            commands::project::create_project,
            commands::project::load_project,
            commands::project::save_project,
            // Render commands
            commands::render::start_render,
            commands::render::start_render_project,
            commands::render::cancel_render,
            commands::render::get_render_progress,
            // Effect commands
            commands::effects::apply_effect,
            commands::effects::get_available_effects,
            // yt-dlp commands
            commands::ytdlp::yt_check,
            commands::ytdlp::yt_get_audio_url,
            commands::ytdlp::yt_get_video_info,
            commands::ytdlp::yt_search_videos,
            // mpv commands
            commands::mpv::mpv_check,
            commands::mpv::mpv_start,
            commands::mpv::mpv_load,
            commands::mpv::mpv_pause,
            commands::mpv::mpv_resume,
            commands::mpv::mpv_seek,
            commands::mpv::mpv_set_volume,
            commands::mpv::mpv_set_speed,
            commands::mpv::mpv_stop,
            commands::mpv::mpv_quit,
        ])
        .setup(move |app| {
            log::info!("Waldiez Player initialized successfully");

            // System tray
            if let Err(e) = tray::setup_tray(&app.handle()) {
                log::warn!("System tray setup failed: {e}");
            }

            // Emit file-opened for CLI file paths after a short delay (webview needs to be ready).
            // Only relevant on Windows / Linux; macOS uses RunEvent::Opened via the plugin.
            if !file_paths.is_empty() {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    for path in file_paths {
                        emit_file_opened(&handle, &path);
                    }
                });
            }

            // Handle deep-link events.  The tauri-plugin-deep-link plugin:
            //   • On macOS/iOS: intercepts RunEvent::Opened and emits "deep-link://new-url"
            //   • On Windows/Linux: processes CLI args matching configured schemes
            // We subscribe via on_open_url and forward to the webview as typed events.
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        match url.scheme() {
                            // File opened via macOS file association (arrives through the plugin)
                            "file" => {
                                if let Ok(path) = url.to_file_path() {
                                    if let Some(s) = path.to_str() {
                                        emit_file_opened(&handle, s);
                                    }
                                }
                            }
                            // Custom URI scheme: waldiez://player?w=...  or  waldiez://player?src=...
                            "waldiez" => {
                                let _ = handle.emit("deep-link", url.to_string());
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let mut did_shutdown_mpv = false;
    app.run(move |app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            if !did_shutdown_mpv {
                shutdown_mpv(app_handle);
                did_shutdown_mpv = true;
            }
        }
        _ => {}
    });
}
