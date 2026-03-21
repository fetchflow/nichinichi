use crate::AiError;
use chrono::Local;
use std::path::{Path, PathBuf};

/// Save an AI conversation to `~/devlog/ai/YYYY-MM-DD-{slug}.md`.
/// The file watcher picks it up and indexes it into SQLite automatically.
pub async fn save_conversation(
    repo: &Path,
    query: &str,
    response: &str,
    org: Option<&str>,
    slug: Option<&str>,
) -> Result<PathBuf, AiError> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let resolved_slug = slug
        .map(|s| s.to_string())
        .unwrap_or_else(|| auto_slug(query));

    let filename = format!("{today}-{resolved_slug}.md");
    let dir = repo.join("ai");
    tokio::fs::create_dir_all(&dir).await?;

    let org_str = org.unwrap_or("null");
    let content = format!(
        "---\ntype: ai-conversation\ndate: {today}\nquery: {query}\norg: {org_str}\n---\n\n\
         **you:** {query}\n\n**devlog:** {response}\n"
    );

    let path = dir.join(&filename);
    tokio::fs::write(&path, content).await?;

    Ok(path)
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
