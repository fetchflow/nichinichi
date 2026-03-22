use crate::SyncError;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::path::Path;
use std::str::FromStr;

/// Open (or create) the SQLite database at `repo/nichinichi.db` and run migrations.
pub async fn open_db(repo: &Path) -> Result<SqlitePool, SyncError> {
    let db_path = repo.join("nichinichi.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.display());

    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| SyncError::Db(e.into()))?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(opts).await?;

    // Run embedded migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
