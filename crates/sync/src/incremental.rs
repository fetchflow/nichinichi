use crate::{local_sqlite::LocalSqlite, sync_target::SyncTarget, SyncError};
use devlog_parser::{parse_file, ParsedFile};
use devlog_types::Config;
use sqlx::SqlitePool;
use std::path::Path;
use std::time::SystemTime;

/// Incrementally sync the repo to SQLite.
///
/// Only processes files whose `mtime` is newer than `last_sync_at` (stored in
/// settings). When no `last_sync_at` exists (first launch or after a DB
/// delete) every file is processed — equivalent to a full rebuild but without
/// the upfront table truncation.
///
/// After syncing, prunes goals/playbooks/digests whose source files no longer
/// exist on disk, then updates `last_sync_at`.
pub async fn sync_incremental(
    pool: &SqlitePool,
    repo: &Path,
    config: &Config,
) -> Result<(), SyncError> {
    let cutoff = get_cutoff(pool).await?;
    let target = LocalSqlite::new(pool.clone());
    walk_and_sync(repo, repo, config, &target, pool, cutoff.as_ref()).await?;
    prune_deleted(pool).await?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_at', ?)")
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(pool)
        .await?;
    Ok(())
}

async fn get_cutoff(pool: &SqlitePool) -> Result<Option<SystemTime>, SyncError> {
    let ts: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'last_sync_at'")
            .fetch_optional(pool)
            .await?;
    Ok(ts
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(SystemTime::from))
}

fn is_quiet(path: &Path, repo: &Path) -> bool {
    path.strip_prefix(repo)
        .ok()
        .map(|rel| rel.components().any(|c| c.as_os_str() == ".quiet"))
        .unwrap_or(false)
}

async fn walk_and_sync(
    dir: &Path,
    repo: &Path,
    config: &Config,
    target: &LocalSqlite,
    pool: &SqlitePool,
    cutoff: Option<&SystemTime>,
) -> Result<(), SyncError> {
    let mut read_dir = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = read_dir.next_entry().await? {
        let path = entry.path();
        let meta = entry.metadata().await?;

        if meta.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                continue;
            }
            Box::pin(walk_and_sync(&path, repo, config, target, pool, cutoff)).await?;
            continue;
        }

        if !meta.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !name.ends_with(".md") {
            continue;
        }
        if is_quiet(&path, repo) {
            continue;
        }

        // Skip files that haven't changed since last sync
        if let Some(c) = cutoff {
            if let Ok(mtime) = meta.modified() {
                if mtime <= *c {
                    continue;
                }
            }
        }

        match parse_file(&path, config) {
            Ok(parsed) => {
                if let Err(e) = process_parsed(parsed, &path, pool, target).await {
                    eprintln!("warn: failed to upsert {}: {e}", path.display());
                }
            }
            Err(e) => {
                eprintln!("warn: skipping {}: {e}", path.display());
            }
        }
    }
    Ok(())
}

async fn process_parsed(
    parsed: ParsedFile,
    path: &Path,
    pool: &SqlitePool,
    target: &LocalSqlite,
) -> Result<(), SyncError> {
    match parsed {
        ParsedFile::Entries(entries) => {
            // Delete existing entries for this date so that removed or edited
            // entries in the daily file don't linger in the index.
            let date_str = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if date_str.len() == 10 {
                sqlx::query("DELETE FROM entries WHERE date = ?")
                    .bind(date_str)
                    .execute(pool)
                    .await?;
            }
            for e in &entries {
                target.upsert_entry(e).await?;
            }
        }
        ParsedFile::Goal(goal) => target.upsert_goal(&goal).await?,
        ParsedFile::Playbook(pb) => target.upsert_playbook(&pb).await?,
        ParsedFile::Digest(d) => target.upsert_digest(&d).await?,
        ParsedFile::AiConversation(ai) => target.upsert_ai_conversation(&ai).await?,
    }
    Ok(())
}

/// Remove goals, playbooks, and digests whose source files no longer exist.
async fn prune_deleted(pool: &SqlitePool) -> Result<(), SyncError> {
    for table in &["goals", "playbooks", "digests"] {
        let paths: Vec<String> =
            sqlx::query_scalar(&format!("SELECT file_path FROM {table}"))
                .fetch_all(pool)
                .await?;
        for fp in paths {
            if !Path::new(&fp).exists() {
                sqlx::query(&format!("DELETE FROM {table} WHERE file_path = ?"))
                    .bind(&fp)
                    .execute(pool)
                    .await?;
            }
        }
    }
    Ok(())
}
