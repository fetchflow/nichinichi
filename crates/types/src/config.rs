use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.anthropic.com".to_string(),
            api_key: String::new(),
            model: "claude-sonnet-4-5".to_string(),
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
