use crate::{local_sqlite::LocalSqlite, sync_target::SyncTarget, SyncError};
use nichinichi_parser::{parse_file, ParsedFile};
use nichinichi_types::Config;
use sqlx::SqlitePool;
use std::path::Path;

/// Drop all reconstructable tables, re-walk the repo, and upsert everything.
/// Preserves `goal_suggestions` and `settings` (non-reconstructable).
pub async fn rebuild_from_disk(
    pool: &SqlitePool,
    repo: &Path,
    config: &Config,
) -> Result<(), SyncError> {
    // Drop reconstructable tables in dependency order
    sqlx::query("DELETE FROM goal_step_entries").execute(pool).await?;
    sqlx::query("DELETE FROM goal_progress").execute(pool).await?;
    sqlx::query("DELETE FROM goal_steps").execute(pool).await?;
    sqlx::query("DELETE FROM goals").execute(pool).await?;
    sqlx::query("DELETE FROM playbooks").execute(pool).await?;
    sqlx::query("DELETE FROM digests").execute(pool).await?;
    sqlx::query("DELETE FROM entries").execute(pool).await?;

    // Rebuild FTS5 index
    sqlx::query("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
        .execute(pool)
        .await
        .ok(); // non-fatal if FTS is already empty

    let target = LocalSqlite::new(pool.clone());

    // Walk the repo directory tree
    walk_and_upsert(repo, repo, config, &target).await?;

    Ok(())
}

fn is_quiet(path: &Path, repo: &Path) -> bool {
    path.strip_prefix(repo)
        .ok()
        .map(|rel| rel.components().any(|c| c.as_os_str() == ".quiet"))
        .unwrap_or(false)
}

async fn walk_and_upsert(
    dir: &Path,
    repo: &Path,
    config: &Config,
    target: &LocalSqlite,
) -> Result<(), SyncError> {
    let mut read_dir = tokio::fs::read_dir(dir).await?;

    while let Some(entry) = read_dir.next_entry().await? {
        let path = entry.path();
        let meta = entry.metadata().await?;

        if meta.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            // Skip hidden dirs except .quiet (which we descend into only to skip)
            if name.starts_with('.') {
                continue; // skip .quiet and all other hidden dirs
            }
            Box::pin(walk_and_upsert(&path, repo, config, target)).await?;
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

        match parse_file(&path, config) {
            Ok(parsed) => {
                upsert_parsed(parsed, target).await?;
            }
            Err(e) => {
                eprintln!("warn: skipping {}: {e}", path.display());
            }
        }
    }

    Ok(())
}

async fn upsert_parsed(parsed: ParsedFile, target: &LocalSqlite) -> Result<(), SyncError> {
    match parsed {
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
    }
    Ok(())
}
