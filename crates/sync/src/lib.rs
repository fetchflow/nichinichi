pub mod db;
pub mod incremental;
pub mod local_sqlite;
pub mod rebuild;
pub mod sync_target;
pub mod watcher;

pub use db::open_db;
pub use incremental::sync_incremental;
pub use local_sqlite::LocalSqlite;
pub use rebuild::rebuild_from_disk;
pub use sync_target::SyncTarget;
pub use watcher::start_file_watcher;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum SyncError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("parser error: {0}")]
    Parser(#[from] devlog_parser::ParseError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("watcher error: {0}")]
    Watcher(String),
}
