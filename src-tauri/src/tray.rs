use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = MenuBuilder::new(app)
        .item(&MenuItem::with_id(
            app,
            "play-pause",
            "⏸ Play/Pause",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "prev",
            "⏮ Previous",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "next",
            "⏭ Next",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)
        .build()?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false);

    // Use the app window icon if available
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .on_menu_event(|app, event| match event.id().as_ref() {
            "play-pause" => {
                let _ = app.emit("tray-action", "play-pause");
            }
            "next" => {
                let _ = app.emit("tray-action", "next");
            }
            "prev" => {
                let _ = app.emit("tray-action", "prev");
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
