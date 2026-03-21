pub mod query;
pub mod save;
pub mod stream;

pub use query::search_entries;
pub use save::save_conversation;
pub use stream::AiClient;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AiError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("API error ({status}): {body}")]
    Api { status: u16, body: String },
    #[error("stream parse error: {0}")]
    Parse(String),
}
