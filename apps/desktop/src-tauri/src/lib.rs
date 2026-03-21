mod commands;

use commands::AppState;
use devlog_parser::load_config;
use devlog_sync::{open_db, start_file_watcher};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tokio::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Load config (async init via block_on inside setup closure)
            tauri::async_runtime::block_on(async move {
                setup_app(app_handle).await
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_entries,
            commands::add_entry,
            commands::delete_entry,
            commands::get_goals,
            commands::update_goal_step,
            commands::archive_goal,
            commands::accept_suggestion,
            commands::dismiss_suggestion,
            commands::get_playbooks,
            commands::sync_now,
            commands::rebuild_db,
            commands::get_last_sync,
            commands::ai_ask,
            commands::save_ai_conversation_cmd,
            commands::get_stats,
            commands::get_activity,
            commands::get_settings,
            commands::set_setting,
            commands::save_ai_key,
            commands::get_orgs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn setup_app(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Load config
    let config = load_config(None)?;

    // Ensure repo directory exists
    std::fs::create_dir_all(&config.repo)?;

    // Open SQLite database
    let pool = open_db(&config.repo).await?;

    // Seed default settings if absent
    sqlx::query(
        "INSERT OR IGNORE INTO settings (key, value) VALUES
         ('theme', 'dark'),
         ('active_org', 'all')",
    )
    .execute(&pool)
    .await?;

    // Start file watcher
    let watcher_app = app.clone();
    start_file_watcher(
        config.repo.clone(),
        pool.clone(),
        config.clone(),
        move |_path| {
            let _ = watcher_app.emit("sync-update", ());
        },
    )?;

    // Register managed state
    app.manage(Mutex::new(AppState {
        pool: pool.clone(),
        config: config.clone(),
    }));

    // Build system tray
    build_tray(&app, pool)?;

    Ok(())
}

fn build_tray(
    app: &tauri::AppHandle,
    pool: sqlx::SqlitePool,
) -> Result<(), Box<dyn std::error::Error>> {
    let sync_item = MenuItem::with_id(app, "sync", "Sync Now", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit DevLog", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&sync_item, &quit_item])?;

    let app_for_tray = app.clone();
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |_tray, event| match event.id().as_ref() {
            "sync" => {
                let pool = pool.clone();
                let app = app_for_tray.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<tokio::sync::Mutex<AppState>>() {
                        let state = state.lock().await;
                        let target = devlog_sync::LocalSqlite::new(pool);
                        if let Err(e) = devlog_sync::SyncTarget::rebuild(
                            &target,
                            &state.config.repo,
                            &state.config,
                        )
                        .await
                        {
                            eprintln!("tray sync error: {e}");
                        } else {
                            let _ = app.emit("sync-update", ());
                        }
                    }
                });
            }
            "quit" => {
                app_for_tray.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
