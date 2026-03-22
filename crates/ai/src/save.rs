use crate::AiError;
use chrono::Local;
use nichinichi_types::{AiConversation, ChatMessage};
use std::path::{Path, PathBuf};

/// Save an AI conversation to `~/nichinichi/ai/YYYY-MM-DD-{slug}.md`.
/// The file watcher picks it up and indexes it into SQLite automatically.
/// The full message history is serialized so conversations can be resumed.
pub async fn save_conversation(
    repo: &Path,
    messages: &[ChatMessage],
    org: Option<&str>,
    slug: Option<&str>,
) -> Result<PathBuf, AiError> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let query = messages
        .iter()
        .find(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("conversation");

    let resolved_slug = slug
        .map(|s| s.to_string())
        .unwrap_or_else(|| auto_slug(query));

    let filename = format!("{today}-{resolved_slug}.md");
    let dir = repo.join("ai");
    tokio::fs::create_dir_all(&dir).await?;

    let org_str = org.unwrap_or("null");
    let mut body = String::new();
    for msg in messages {
        let label = if msg.role == "user" { "you" } else { "nichinichi" };
        body.push_str(&format!("**{label}:** {}\n\n", msg.content));
    }

    let content = format!(
        "---\ntype: ai-conversation\ndate: {today}\nquery: {query}\norg: {org_str}\n---\n\n{body}"
    );

    let path = dir.join(&filename);
    tokio::fs::write(&path, content).await?;

    Ok(path)
}

/// List all saved AI conversations, newest first.
pub async fn list_conversations(
    repo: &Path,
    org: Option<&str>,
) -> Result<Vec<AiConversation>, AiError> {
    let dir = repo.join("ai");
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = tokio::fs::read_dir(&dir).await?;
    let mut conversations = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let raw = tokio::fs::read_to_string(&path).await.unwrap_or_default();
        if let Some(conv) = parse_conversation_frontmatter(&raw, &path) {
            if let Some(filter_org) = org {
                if conv.org.as_deref() != Some(filter_org) {
                    continue;
                }
            }
            conversations.push(conv);
        }
    }

    conversations.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(conversations)
}

/// Load a saved conversation file and reconstruct the message history.
pub async fn load_conversation(path: &Path) -> Result<Vec<ChatMessage>, AiError> {
    let raw = tokio::fs::read_to_string(path).await?;
    // Strip YAML frontmatter
    let body = if raw.starts_with("---") {
        let after_first = &raw[3..];
        if let Some(end) = after_first.find("\n---") {
            after_first[end + 4..].trim_start().to_string()
        } else {
            raw.clone()
        }
    } else {
        raw.clone()
    };

    let mut messages = Vec::new();
    // Each message starts with **you:** or **nichinichi:**
    let mut remaining = body.as_str();
    while !remaining.is_empty() {
        let (role, rest) = if let Some(r) = remaining.strip_prefix("**you:** ") {
            ("user", r)
        } else if let Some(r) = remaining.strip_prefix("**nichinichi:** ") {
            ("assistant", r)
        } else {
            // skip non-message lines
            let next = remaining.find('\n').map(|i| i + 1).unwrap_or(remaining.len());
            remaining = &remaining[next..];
            continue;
        };

        // Content ends at the next `**you:**` or `**nichinichi:**` marker (or EOF)
        let content_end = find_next_marker(rest);
        let content = rest[..content_end].trim_end().to_string();
        if !content.is_empty() {
            messages.push(ChatMessage { role: role.to_string(), content });
        }
        remaining = &rest[content_end..].trim_start_matches('\n');
    }

    Ok(messages)
}

fn find_next_marker(s: &str) -> usize {
    let markers = ["**you:** ", "**nichinichi:** "];
    let mut pos = 0;
    let bytes = s.as_bytes();
    while pos < bytes.len() {
        for marker in &markers {
            if s[pos..].starts_with(marker) {
                return pos;
            }
        }
        // advance to next line
        match s[pos..].find('\n') {
            Some(i) => pos += i + 1,
            None => return s.len(),
        }
    }
    s.len()
}

fn parse_conversation_frontmatter(raw: &str, path: &Path) -> Option<AiConversation> {
    if !raw.starts_with("---") {
        return None;
    }
    let after = &raw[3..];
    let end = after.find("\n---")?;
    let fm = &after[..end];

    let mut date = String::new();
    let mut query = String::new();
    let mut org: Option<String> = None;

    for line in fm.lines() {
        if let Some(v) = line.strip_prefix("date: ") {
            date = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("query: ") {
            query = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("org: ") {
            let v = v.trim();
            if v != "null" {
                org = Some(v.to_string());
            }
        }
    }

    if date.is_empty() {
        return None;
    }

    let id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    let file_path = path.to_string_lossy().to_string();
    let body_start = 3 + end + 4; // skip "---\n"
    let content = raw.get(body_start..).unwrap_or("").trim().to_string();

    Some(AiConversation { id, date, query, org, content, file_path })
}

/// Generate a slug from query text: lowercase, hyphens, max 60 chars.
fn auto_slug(query: &str) -> String {
    let slug: String = query
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.len() > 60 {
        slug[..60].trim_end_matches('-').to_string()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::auto_slug;

    #[test]
    fn test_auto_slug() {
        assert_eq!(auto_slug("when did I fix a JWT bug"), "when-did-i-fix-a-jwt-bug");
        assert_eq!(auto_slug("hello world!"), "hello-world");
    }

    #[test]
    fn test_auto_slug_truncation() {
        let long = "a".repeat(100);
        assert!(auto_slug(&long).len() <= 60);
    }
}
