use thiserror::Error;

#[derive(Debug, Error)]
pub enum CloudError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error ({status}): {body}")]
    Api { status: u16, body: String },

    #[error("authentication required — set cloud.token in ~/.nichinichi.yml")]
    Unauthenticated,

    #[error("serialization error: {0}")]
    Serialize(#[from] serde_json::Error),

    #[error("merge conflict on entry {id}: local={local_updated_at} remote={remote_updated_at}")]
    MergeConflict {
        id: String,
        local_updated_at: String,
        remote_updated_at: String,
    },

    #[error("io error: {0}")]
    Io(String),

    #[error("cloud sync is not configured")]
    NotConfigured,
}
