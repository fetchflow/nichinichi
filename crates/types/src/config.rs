use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    #[default]
    Ollama,
    Openwebui,
}

/// Configuration for the optional nichinichi-cloud sync backend.
///
/// Stored under the `cloud:` key in `~/.nichinichi.yml`.
/// When absent, cloud sync is disabled and all operations remain local-only.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudConfig {
    /// Base URL of the nichinichi-cloud server, e.g. `https://sync.nichinichi.app`.
    #[serde(default = "default_cloud_base_url")]
    pub base_url: String,
    /// Bearer token obtained via `nichinichi cloud login`.
    #[serde(default)]
    pub token: String,
    /// Unix timestamp (seconds) of the last successful sync.
    /// Used as the `since` parameter on the next manifest request.
    #[serde(default)]
    pub last_synced_at: Option<i64>,
    /// Conflict resolution strategy: "remote_wins" (default) | "local_wins" | "error"
    #[serde(default = "default_conflict_strategy")]
    pub conflict_strategy: String,
}

fn default_cloud_base_url() -> String {
    "https://sync.nichinichi.app".to_string()
}

fn default_conflict_strategy() -> String {
    "remote_wins".to_string()
}

impl Default for CloudConfig {
    fn default() -> Self {
        Self {
            base_url: default_cloud_base_url(),
            token: String::new(),
            last_synced_at: None,
            conflict_strategy: default_conflict_strategy(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub provider: AiProvider,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:11434".to_string(),
            api_key: String::new(),
            model: String::new(),
            provider: AiProvider::Ollama,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub repo: PathBuf,
    #[serde(default = "default_editor")]
    pub editor: String,
    #[serde(default)]
    pub ai: AiConfig,
    pub default_org: Option<String>,
    /// Optional cloud sync configuration. When `None`, cloud sync is disabled.
    #[serde(default)]
    pub cloud: Option<CloudConfig>,
    /// project-level override (from nearest .nichinichi.yml in cwd ancestry)
    #[serde(skip)]
    pub project_org: Option<String>,
}

fn default_editor() -> String {
    std::env::var("EDITOR").unwrap_or_else(|_| "vim".to_string())
}

impl Config {
    /// Effective org for a new entry: project > default > None
    pub fn effective_org(&self) -> Option<&str> {
        self.project_org
            .as_deref()
            .or(self.default_org.as_deref())
    }
}
