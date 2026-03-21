use crate::{local_sqlite::LocalSqlite, sync_target::SyncTarget, SyncError};
use devlog_parser::{parse_file, ParsedFile};
use devlog_types::Config;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// Start the file watcher in a background thread.
///
/// Uses `std::thread` for the blocking notify loop, forwarding triggers via a
/// `tokio::sync::mpsc` channel (capacity 1, `try_send` for deduplication).
/// The async receiver re-parses changed files and upserts to SQLite.
///
/// `on_change` is called after each successful upsert (desktop emits Tauri events;
/// CLI passes `|_| {}`).
pub fn start_file_watcher(
    repo: PathBuf,
    pool: SqlitePool,
    config: Config,
    on_change: impl Fn(PathBuf) + Send + Sync + 'static,
) -> Result<(), SyncError> {
    let (tx, mut rx) = mpsc::channel::<PathBuf>(1);
    let repo_for_watcher = repo.clone();
    let repo_for_check = repo.clone();

    // Blocking notify thread
    std::thread::spawn(move || {
        let tx_inner = tx.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |res: DebounceEventResult| {
                if let Ok(events) = res {
                    for event in events {
                        let path = event.path;
                        if !is_indexable(&path, &repo_for_watcher) {
                            continue;
                        }
                        // try_send deduplicates rapid saves (capacity 1)
                        let _ = tx_inner.try_send(path);
                    }
                }
            },
        )
        .expect("failed to create debouncer");

        debouncer
            .watcher()
            .watch(&repo_for_check, RecursiveMode::Recursive)
            .expect("failed to watch repo");

        // Block forever — keeps the watcher alive
        loop {
            std::thread::sleep(Duration::from_secs(3600));
        }
    });

    // Async consumer
    let on_change = Arc::new(on_change);
    tokio::spawn(async move {
        let target = LocalSqlite::new(pool);
        while let Some(path) = rx.recv().await {
            match process_change(&path, &config, &target).await {
                Ok(_) => {
                    on_change(path);
                }
                Err(e) => {
                    eprintln!("watcher: error processing {}: {e}", path.display());
                }
            }
        }
    });

    Ok(())
}

async fn process_change(
    path: &Path,
    config: &Config,
    target: &LocalSqlite,
) -> Result<(), SyncError> {
    if !path.exists() {
        return Ok(());
    }

    match parse_file(path, config) {
        Ok(parsed) => match parsed {
            ParsedFile::Entries(entries) => {
                for e in entries {
                    target.upsert_entry(&e).await?;
                }
            }
            ParsedFile::Goal(goal) => {
                target.upsert_goal(&goal).await?;
            }
            ParsedFile::Playbook(pb) => {
                target.upsert_playbook(&pb).await?;
            }
            ParsedFile::Digest(d) => {
                target.upsert_digest(&d).await?;
            }
            ParsedFile::AiConversation(ai) => {
                target.upsert_ai_conversation(&ai).await?;
            }
        },
        Err(e) => {
            eprintln!("watcher: parse error for {}: {e}", path.display());
        }
    }

    Ok(())
}

fn is_indexable(path: &Path, repo: &Path) -> bool {
    if path.extension().and_then(|e| e.to_str()) != Some("md") {
        return false;
    }
    if !path.starts_with(repo) {
        return false;
    }
    if let Ok(rel) = path.strip_prefix(repo) {
        if rel.components().any(|c| c.as_os_str() == ".quiet") {
            return false;
        }
    }
    true
}
