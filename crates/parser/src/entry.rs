use crate::ParseError;
use nichinichi_types::{EntryType, ParsedEntry};
use sha2::{Digest, Sha256};

/// Parse a daily entry file (`YYYY-MM-DD.md`).
/// Returns all entries found in the file.
pub fn parse_entry_file(
    content: &str,
    date: &str,
    default_org: Option<&str>,
) -> Result<Vec<ParsedEntry>, ParseError> {
    let mut entries = Vec::new();

    // Split on `---` delimiter lines; the first segment is the file header
    let raw_blocks: Vec<&str> = content.split("\n---\n").collect();

    // raw_blocks[0] is the header line (`# YYYY-MM-DD`) — skip it
    // Each subsequent pair of segments forms one entry block:
    // content between opening `---` and closing `---`
    // After splitting on "\n---\n", entries are in positions 1, 3, 5, ...
    // because the delimiter both opens and closes:
    //   header \n---\n entry1 \n---\n entry2 \n---\n
    // splits into: [header, entry1, entry2, ""]
    // So every element from index 1 onwards (except trailing empty) is an entry.

    for block in raw_blocks.iter().skip(1) {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }
        if let Some(entry) = parse_entry_block(block, date, default_org)? {
            entries.push(entry);
        }
    }

    Ok(entries)
}

fn parse_entry_block(
    block: &str,
    date: &str,
    default_org: Option<&str>,
) -> Result<Option<ParsedEntry>, ParseError> {
    let mut lines = block.lines();

    let first_line = match lines.next() {
        Some(l) => l.trim(),
        None => return Ok(None),
    };

    if first_line.is_empty() {
        return Ok(None);
    }

    // Parse: `HH:MM | body @org #type #tags`
    // or     `~HH:MM | body ...`
    let (time_raw, rest) = first_line
        .split_once(" | ")
        .ok_or_else(|| ParseError::Format(format!("missing ' | ' in entry line: {first_line}")))?;

    let approximate = time_raw.starts_with('~');
    let time = time_raw.trim_start_matches('~').to_string();

    // Collect detail lines (indented lines below the first)
    let mut detail_lines: Vec<&str> = Vec::new();
    for line in lines {
        if line.starts_with("       ") || line.starts_with('\t') || line.starts_with("  ") {
            detail_lines.push(line.trim());
        } else if !line.trim().is_empty() {
            detail_lines.push(line.trim());
        }
    }
    let detail = if detail_lines.is_empty() {
        None
    } else {
        Some(detail_lines.join("\n"))
    };

    // Parse tokens from rest: words starting with @ or #
    let (body, org, entry_type, tags) = parse_entry_tokens(rest, default_org);

    let id = entry_id(date, &time, &body);
    let raw_line = first_line.to_string();

    Ok(Some(ParsedEntry {
        id,
        date: date.to_string(),
        time,
        body,
        detail,
        entry_type,
        tags,
        project: None,
        org,
        approximate,
        raw_line,
    }))
}

/// Extract body, org, type, and extra tags from the entry text after the `|`.
fn parse_entry_tokens(
    text: &str,
    default_org: Option<&str>,
) -> (String, Option<String>, EntryType, Vec<String>) {
    let mut org: Option<String> = None;
    let mut type_tag: Option<EntryType> = None;
    let mut extra_tags: Vec<String> = Vec::new();
    let mut body_words: Vec<&str> = Vec::new();

    for word in text.split_whitespace() {
        if let Some(mention) = word.strip_prefix('@') {
            // First @mention wins as org
            if org.is_none() {
                org = Some(mention.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_').to_string());
            }
            // @mentions are not included in the body
        } else if let Some(tag) = word.strip_prefix('#') {
            let tag = tag.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_');
            // Check if it's a known type tag
            if type_tag.is_none() {
                match tag {
                    "log" => { type_tag = Some(EntryType::Log); }
                    "solution" => { type_tag = Some(EntryType::Solution); }
                    "decision" => { type_tag = Some(EntryType::Decision); }
                    "reflection" => { type_tag = Some(EntryType::Reflection); }
                    "score" => { type_tag = Some(EntryType::Score); }
                    "ai" => { type_tag = Some(EntryType::Ai); }
                    _ => { extra_tags.push(tag.to_string()); }
                }
            } else {
                extra_tags.push(tag.to_string());
            }
            // #tags are not included in the body
        } else {
            body_words.push(word);
        }
    }

    let body = body_words.join(" ");

    // Resolve org: inline > default
    let resolved_org = org.or_else(|| default_org.map(|s| s.to_string()));

    // Resolve type: explicit tag > keyword inference > log
    let entry_type = type_tag.unwrap_or_else(|| infer_type(&body));

    (body, resolved_org, entry_type, extra_tags)
}

/// Infer entry type from body keywords per CLAUDE.md rules.
fn infer_type(body: &str) -> EntryType {
    let lower = body.to_lowercase();
    if lower.contains("fixed")
        || lower.contains("solved")
        || lower.contains("workaround")
        || lower.contains("the fix")
    {
        return EntryType::Solution;
    }
    if lower.contains("chose")
        || lower.contains("decided")
        || lower.contains("rejected")
        || lower.contains("picked")
    {
        return EntryType::Decision;
    }
    if lower.contains("clicked")
        || lower.contains("realised")
        || lower.contains("learned")
        || lower.contains("finally")
    {
        return EntryType::Reflection;
    }
    if lower.contains("shipped")
        || lower.contains("merged")
        || lower.contains("closed")
        || lower.contains("unblocked")
    {
        return EntryType::Score;
    }
    if lower.contains("claude")
        || lower.contains("gpt")
        || lower.contains(" ai ")
        || lower.contains("prompt")
        || lower.contains("copilot")
    {
        return EntryType::Ai;
    }
    EntryType::Log
}

/// Compute sha256(date || time || body) as hex string.
pub fn entry_id(date: &str, time: &str, body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(date.as_bytes());
    hasher.update(time.as_bytes());
    hasher.update(body.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"# 2026-03-17

---
09:05 | picking up the auth refactor @acme #log
---
11:32 | jwt refresh swallowing errors — fixed @acme #solution

       Root cause: expiry check after decode, not before
       Fix: move expiry check to top of middleware
       Time lost: 2hrs. Check expiry BEFORE decode, always.
---
14:15 | claude suggested localStorage — rejected, xss risk @acme #ai
---
16:48 | fixed, merged, Sarah unblocked @acme #score
---
17:30 | slow morning but strong finish #reflection
---"#;

    #[test]
    fn test_parse_entry_count() {
        let entries = parse_entry_file(SAMPLE, "2026-03-17", None).unwrap();
        assert_eq!(entries.len(), 5);
    }

    #[test]
    fn test_entry_fields() {
        let entries = parse_entry_file(SAMPLE, "2026-03-17", None).unwrap();
        let e = &entries[0];
        assert_eq!(e.time, "09:05");
        assert_eq!(e.org.as_deref(), Some("acme"));
        assert_eq!(e.entry_type, EntryType::Log);
        assert!(!e.approximate);
    }

    #[test]
    fn test_solution_with_detail() {
        let entries = parse_entry_file(SAMPLE, "2026-03-17", None).unwrap();
        let e = &entries[1];
        assert_eq!(e.entry_type, EntryType::Solution);
        assert!(e.detail.is_some());
        assert!(e.detail.as_ref().unwrap().contains("Root cause"));
    }

    #[test]
    fn test_type_inference_score() {
        let entries = parse_entry_file(SAMPLE, "2026-03-17", None).unwrap();
        // entry at 16:48 has explicit #score but body also contains "merged"
        assert_eq!(entries[3].entry_type, EntryType::Score);
    }

    #[test]
    fn test_reflection_no_type_tag() {
        // "slow morning but strong finish" — no known keyword → log
        let entries = parse_entry_file(SAMPLE, "2026-03-17", None).unwrap();
        assert_eq!(entries[4].entry_type, EntryType::Reflection);
    }

    #[test]
    fn test_infer_solution() {
        assert_eq!(infer_type("fixed the bug in auth middleware"), EntryType::Solution);
    }

    #[test]
    fn test_infer_decision() {
        assert_eq!(infer_type("rejected the proposal to use Redis"), EntryType::Decision);
    }

    #[test]
    fn test_infer_score() {
        assert_eq!(infer_type("shipped the new feature"), EntryType::Score);
    }

    #[test]
    fn test_approximate_timestamp() {
        let content = "# 2026-03-17\n\n---\n~09:05 | rough time estimate @acme #log\n---\n";
        let entries = parse_entry_file(content, "2026-03-17", None).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].approximate);
        assert_eq!(entries[0].time, "09:05");
    }

    #[test]
    fn test_default_org_fallback() {
        let content = "# 2026-03-17\n\n---\n09:00 | no org here #log\n---\n";
        let entries = parse_entry_file(content, "2026-03-17", Some("personal")).unwrap();
        assert_eq!(entries[0].org.as_deref(), Some("personal"));
    }

    #[test]
    fn test_entry_id_deterministic() {
        let id1 = entry_id("2026-03-17", "09:05", "some body");
        let id2 = entry_id("2026-03-17", "09:05", "some body");
        assert_eq!(id1, id2);
        let id3 = entry_id("2026-03-17", "09:05", "different body");
        assert_ne!(id1, id3);
    }
}
