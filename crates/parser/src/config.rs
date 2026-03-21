use crate::ParseError;
use devlog_types::{AiConfig, Config};
use std::path::{Path, PathBuf};

/// Load config from `~/.devlog.yml`, applying env var fallbacks for AI settings.
/// Also walks up from `start_dir` looking for a project-level `.devlog.yml`.
pub fn load_config(start_dir: Option<&Path>) -> Result<Config, ParseError> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let global_path = home.join(".devlog.yml");

    let mut config = if global_path.exists() {
        let content = std::fs::read_to_string(&global_path)?;
        let raw: serde_yaml::Value = serde_yaml::from_str(&content)?;
        config_from_yaml(&raw, &home)
    } else {
        Config {
            repo: home.join("devlog"),
            editor: std::env::var("EDITOR").unwrap_or_else(|_| "vim".to_string()),
            ai: AiConfig::default(),
            default_org: None,
            project_org: None,
        }
    };

    // Apply env var overrides for AI (CLI fallback)
    if let Ok(key) = std::env::var("AI_API_KEY") {
        if !key.is_empty() {
            config.ai.api_key = key;
        }
    }
    if let Ok(url) = std::env::var("AI_BASE_URL") {
        if !url.is_empty() {
            config.ai.base_url = url;
        }
    }
    if let Ok(model) = std::env::var("AI_MODEL") {
        if !model.is_empty() {
            config.ai.model = model;
        }
    }

    // Walk up from start_dir to find project-level .devlog.yml
    if let Some(dir) = start_dir {
        if let Some(proj_org) = find_project_org(dir) {
            config.project_org = Some(proj_org);
        }
    }

    Ok(config)
}

fn config_from_yaml(raw: &serde_yaml::Value, home: &Path) -> Config {
    let repo = raw
        .get("repo")
        .and_then(|v| v.as_str())
        .map(|s| expand_tilde(s, home))
        .unwrap_or_else(|| home.join("devlog"));

    let editor = raw
        .get("editor")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| std::env::var("EDITOR").unwrap_or_else(|_| "vim".to_string()));

    let ai = if let Some(ai_node) = raw.get("ai") {
        AiConfig {
            base_url: ai_node
                .get("base_url")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| "https://api.anthropic.com".to_string()),
            api_key: ai_node
                .get("api_key")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_default(),
            model: ai_node
                .get("model")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| "claude-sonnet-4-5".to_string()),
        }
    } else {
        AiConfig::default()
    };

    let default_org = raw
        .get("default_org")
        .and_then(|v| v.as_str())
        .map(String::from);

    Config {
        repo,
        editor,
        ai,
        default_org,
        project_org: None,
    }
}

fn expand_tilde(path: &str, home: &Path) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        home.join(rest)
    } else if path == "~" {
        home.to_path_buf()
    } else {
        PathBuf::from(path)
    }
}

fn find_project_org(start: &Path) -> Option<String> {
    let mut dir = start;
    loop {
        let candidate = dir.join(".devlog.yml");
        if candidate.exists() {
            if let Ok(content) = std::fs::read_to_string(&candidate) {
                if let Ok(raw) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                    if let Some(org) = raw.get("org").and_then(|v| v.as_str()) {
                        return Some(org.to_string());
                    }
                }
            }
        }
        match dir.parent() {
            Some(parent) => dir = parent,
            None => break,
        }
    }
    None
}
