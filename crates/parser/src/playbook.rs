use crate::ParseError;
use nichinichi_types::Playbook;
use std::path::Path;

/// Parse a playbook markdown file.
pub fn parse_playbook_file(content: &str, file_path: &str) -> Result<Playbook, ParseError> {
    let slug = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let content_trimmed = content.trim_start();
    if !content_trimmed.starts_with("---") {
        return Err(ParseError::Format("playbook missing YAML frontmatter".into()));
    }

    let after_open = &content_trimmed[3..];
    let end = after_open
        .find("\n---")
        .ok_or_else(|| ParseError::Format("playbook frontmatter not closed".into()))?;

    let frontmatter_str = after_open[..end].trim();
    let body = after_open[end + 4..].trim().to_string();

    let fm: serde_yaml::Value = serde_yaml::from_str(frontmatter_str)?;

    let title = fm
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| slug.replace('-', " "));

    let tags: Vec<String> = fm
        .get("tags")
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let org = fm.get("org").and_then(|v| v.as_str()).map(String::from);
    let forked_from = fm
        .get("forked_from")
        .and_then(|v| v.as_str())
        .map(String::from);
    let created_at = fm
        .get("created")
        .and_then(|v| v.as_str())
        .map(String::from);

    Ok(Playbook {
        id: slug,
        title,
        content: Some(body),
        tags,
        org,
        forked_from,
        file_path: file_path.to_string(),
        created_at,
        updated_at: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"---
title: debugging node.js memory leaks
tags: [node, memory]
forked_from: null
org: null
created: 2026-02-10
---

## steps

1. Run `node --inspect` and open Chrome DevTools Memory tab
2. Take heap snapshot before and after suspected leak
"#;

    #[test]
    fn test_parse_playbook() {
        let pb = parse_playbook_file(SAMPLE, "playbooks/debugging-memory-leaks.md").unwrap();
        assert_eq!(pb.id, "debugging-memory-leaks");
        assert_eq!(pb.title, "debugging node.js memory leaks");
        assert_eq!(pb.tags, vec!["node", "memory"]);
        assert!(pb.content.as_ref().unwrap().contains("heap snapshot"));
        assert_eq!(pb.created_at.as_deref(), Some("2026-02-10"));
    }
}
