use async_trait::async_trait;
use nichinichi_types::{AiConversation, Digest, Goal, ParsedEntry, Playbook};

use crate::SyncError;

/// The Phase 2 seam: swap `LocalSqlite` for `SupabaseSync` without touching
/// Tauri commands or CLI commands.
#[async_trait]
pub trait SyncTarget: Send + Sync {
    async fn upsert_entry(&self, entry: &ParsedEntry) -> Result<(), SyncError>;
    async fn upsert_goal(&self, goal: &Goal) -> Result<(), SyncError>;
    async fn upsert_playbook(&self, playbook: &Playbook) -> Result<(), SyncError>;
    async fn upsert_digest(&self, digest: &Digest) -> Result<(), SyncError>;
    async fn upsert_ai_conversation(&self, ai: &AiConversation) -> Result<(), SyncError>;
    async fn delete_entry(&self, id: &str) -> Result<(), SyncError>;
    async fn rebuild(&self, repo: &std::path::Path, config: &nichinichi_types::Config) -> Result<(), SyncError>;
}
