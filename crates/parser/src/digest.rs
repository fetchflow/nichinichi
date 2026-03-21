use crate::ParseError;
use devlog_types::{AiConversation, Digest, DigestType};
use sha2::{Digest as _, Sha256};
use std::path::Path;

/// Parse a digest file (`digests/YYYY-MM-DD-type.md`).
pub fn parse_digest_file(content: &str, file_path: &str) -> Result<Digest, ParseError> {
    let (fm_str, body) = extract_frontmatter(content)?;
    let fm: serde_yaml::Value = serde_yaml::from_str(&fm_str)?;

    let digest_type = fm
        .get("type")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DigestType>().ok())
        .ok_or_else(|| ParseError::MissingField("type".into()))?;

    let period_start = fm
        .get("period_start")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ParseError::MissingField("period_start".into()))?
        .to_string();

    let period_end = fm
        .get("period_end")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ParseError::MissingField("period_end".into()))?
        .to_string();

    let entry_count = fm
        .get("entries")
        .and_then(|v| v.as_i64());

    let org = fm.get("org").and_then(|v| {
        if v.is_null() { None } else { v.as_str().map(String::from) }
    });

    let created_at = fm
        .get("generated")
        .and_then(|v| v.as_str())
        .map(String::from);

    let slug = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");
    let id = sha256_str(slug);

    Ok(Digest {
        id,
        digest_type,
        content: body.trim().to_string(),
        period_start,
        period_end,
        entry_count,
        org,
        file_path: file_path.to_string(),
        created_at,
    })
}

/// Parse a saved AI conversation file (`ai/YYYY-MM-DD-slug.md`).
pub fn parse_ai_conversation_file(
    content: &str,
    file_path: &str,
) -> Result<AiConversation, ParseError> {
    let (fm_str, body) = extract_frontmatter(content)?;
    let fm: serde_yaml::Value = serde_yaml::from_str(&fm_str)?;

    let date = fm
        .get("date")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ParseError::MissingField("date".into()))?
        .to_string();

    let query = fm
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ParseError::MissingField("query".into()))?
        .to_string();

    let org = fm.get("org").and_then(|v| {
        if v.is_null() { None } else { v.as_str().map(String::from) }
    });

    let slug = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");
    let id = sha256_str(slug);

    Ok(AiConversation {
        id,
        date,
        query,
        org,
        content: body.trim().to_string(),
        file_path: file_path.to_string(),
    })
}

fn extract_frontmatter(content: &str) -> Result<(String, &str), ParseError> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return Err(ParseError::Format("file missing YAML frontmatter".into()));
    }
    let after_open = &content[3..];
    let end = after_open
        .find("\n---")
        .ok_or_else(|| ParseError::Format("frontmatter not closed".into()))?;
    let fm = after_open[..end].trim().to_string();
    let body = &after_open[end + 4..];
    Ok((fm, body))
}

fn sha256_str(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    format!("{:x}", h.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIGEST_SAMPLE: &str = r#"---
type: weekly
period_start: 2026-03-11
period_end: 2026-03-17
entries: 19
org: null
generated: 2026-03-17T18:00:00
---

3 score entries this week — solid delivery.
"#;

    const AI_SAMPLE: &str = r#"---
type: ai-conversation
date: 2026-03-17
query: when did i fix a jwt bug
org: acme
---

**you:** when did i fix a jwt bug

**devlog:** Based on your entries: jwt refresh bug fixed March 17...
"#;

    #[test]
    fn test_parse_digest() {
        let d = parse_digest_file(DIGEST_SAMPLE, "digests/2026-03-17-weekly.md").unwrap();
        assert_eq!(d.digest_type, DigestType::Weekly);
        assert_eq!(d.period_start, "2026-03-11");
        assert_eq!(d.entry_count, Some(19));
        assert!(d.content.contains("solid delivery"));
    }

    #[test]
    fn test_parse_ai_conversation() {
        let ai = parse_ai_conversation_file(AI_SAMPLE, "ai/2026-03-17-jwt.md").unwrap();
        assert_eq!(ai.date, "2026-03-17");
        assert_eq!(ai.query, "when did i fix a jwt bug");
        assert_eq!(ai.org.as_deref(), Some("acme"));
        assert!(ai.content.contains("jwt refresh"));
    }
}
