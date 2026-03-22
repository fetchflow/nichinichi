mod commands;

use commands::AppState;
use devlog_parser::load_config;
use devlog_sync::{open_db, start_file_watcher, sync_incremental};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tokio::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            commands::reactivate_goal,
            commands::accept_suggestion,
            commands::dismiss_suggestion,
            commands::get_playbooks,
            commands::get_digests,
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
            commands::get_config_repo,
            commands::save_config_repo,
            commands::get_orgs,
            commands::update_goal_meta,
            commands::save_goal_content,
            commands::save_playbook,
            commands::create_playbook,
            commands::delete_playbook,
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

    // Catch up on any files that changed while the app was offline.
    // Delayed slightly so initial UI queries (get_entries, get_goals, etc.)
    // don't contend with the sync writes on startup.
    let startup_app = app.clone();
    let startup_pool = pool.clone();
    let startup_repo = config.repo.clone();
    let startup_config = config.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        if let Err(e) = sync_incremental(&startup_pool, &startup_repo, &startup_config).await {
            eprintln!("startup sync error: {e}");
        }
        let _ = startup_app.emit("sync-update", ());
    });

    // Build system tray
    build_tray(&app)?;

    Ok(())
}

fn build_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sync_item = MenuItem::with_id(app, "sync", "Sync Now", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit DevLog", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&sync_item, &quit_item])?;

    let app_for_tray = app.clone();
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |_tray, event| match event.id().as_ref() {
            "sync" => {
                let app = app_for_tray.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<tokio::sync::Mutex<AppState>>() {
                        let state = state.lock().await;
                        if let Err(e) = sync_incremental(
                            &state.pool,
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
