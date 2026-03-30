use serde::{Deserialize, Serialize};

/// A lightweight record describing a single synced object on the server.
/// The server returns a list of these so the client can diff against local
/// state and decide what to push / pull.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    /// Same content-addressed ID used in the local SQLite DB.
    pub id: String,
    /// ISO-8601 datetime string of the last server-side write.
    pub updated_at: String,
    /// Object kind: "entry" | "goal" | "playbook" | "digest"
    pub kind: ManifestKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManifestKind {
    Entry,
    Goal,
    Playbook,
    Digest,
}

impl std::fmt::Display for ManifestKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManifestKind::Entry => f.write_str("entry"),
            ManifestKind::Goal => f.write_str("goal"),
            ManifestKind::Playbook => f.write_str("playbook"),
            ManifestKind::Digest => f.write_str("digest"),
        }
    }
}

/// Server response to `GET /sync/manifest`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifest {
    /// Unix timestamp (seconds) at which this manifest was generated.
    /// Clients should store this and pass it as `since` on the next sync.
    pub generated_at: i64,
    pub entries: Vec<ManifestEntry>,
}

/// Query parameters for `GET /sync/manifest`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManifestQuery {
    /// If present, only return items modified after this Unix timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<i64>,
    /// If present, restrict to a single org.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org: Option<String>,
}
