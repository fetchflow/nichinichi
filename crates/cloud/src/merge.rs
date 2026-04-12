use std::collections::HashMap;

use crate::error::CloudError;
use nichinichi_types::ParsedEntry;

/// Strategy for resolving conflicts between a local record and a remote record
/// when both have been modified since the last sync.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ConflictStrategy {
    /// The remote (server) copy wins. Local changes are overwritten.
    #[default]
    RemoteWins,
    /// The local copy wins. Remote changes are overwritten on the next push.
    LocalWins,
    /// Return a `CloudError::MergeConflict` so the caller can decide.
    Error,
}

/// Outcome of merging a single entry.
#[derive(Debug, Clone)]
pub enum MergeOutcome {
    /// Keep the entry as-is (already up to date).
    NoOp,
    /// Use the provided entry (remote won or local won unanimously).
    Use(ParsedEntry),
    /// The entry must be pushed to the server (local is newer).
    PushLocal(ParsedEntry),
}

/// Merge a local entry with the version fetched from the server.
///
/// `local_updated_at` and `remote_updated_at` are ISO-8601 strings.
/// When both sides have the same `updated_at` the entry is already in sync.
pub fn merge_entry(
    local: &ParsedEntry,
    remote: &ParsedEntry,
    local_updated_at: &str,
    remote_updated_at: &str,
    strategy: ConflictStrategy,
) -> Result<MergeOutcome, CloudError> {
    if local_updated_at == remote_updated_at {
        return Ok(MergeOutcome::NoOp);
    }

    // Compare timestamps lexicographically — ISO-8601 strings sort correctly.
    let local_is_newer = local_updated_at > remote_updated_at;

    if local_is_newer {
        match strategy {
            ConflictStrategy::RemoteWins => Ok(MergeOutcome::Use(remote.clone())),
            ConflictStrategy::LocalWins => Ok(MergeOutcome::PushLocal(local.clone())),
            ConflictStrategy::Error => Err(CloudError::MergeConflict {
                id: local.id.clone(),
                local_updated_at: local_updated_at.to_string(),
                remote_updated_at: remote_updated_at.to_string(),
            }),
        }
    } else {
        // Remote is newer — always pull the remote regardless of strategy
        // (there is no local change to protect).
        Ok(MergeOutcome::Use(remote.clone()))
    }
}

// ── Daily file merge ──────────────────────────────────────────────────────────

/// Merge two daily entry files by taking the union of their entry blocks.
///
/// The file header (e.g. `# 2026-03-17`) is taken from `local`.
/// Duplicate entries (same first line) are deduped — the longer block wins,
/// so a detail block added on one machine is preserved.
/// Entries are sorted by their `HH:MM` timestamp prefix.
pub fn merge_daily_file(local: &str, remote: &str) -> String {
    let (local_header, local_blocks) = split_daily_file(local);
    let (_, remote_blocks) = split_daily_file(remote);

    // key → block lines. Keep the longer block on collision (more detail).
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for block in local_blocks.into_iter().chain(remote_blocks) {
        let key = block_key(&block);
        if key.is_empty() {
            continue;
        }
        let entry = map.entry(key).or_default();
        if block.len() > entry.len() {
            *entry = block;
        }
    }

    // Sort by timestamp so the merged file stays chronological.
    let mut sorted: Vec<Vec<String>> = map.into_values().collect();
    sorted.sort_by_key(|b| block_time(b));

    // Reconstruct: header + alternating --- / entry lines / --- pattern.
    let mut out = local_header.clone();
    if !out.ends_with('\n') {
        out.push('\n');
    }
    for block in &sorted {
        out.push_str("---\n");
        for line in block {
            out.push_str(line);
            out.push('\n');
        }
    }
    if !sorted.is_empty() {
        out.push_str("---\n");
    }
    out
}

/// Split a daily file into (header_text, Vec<entry_block_lines>).
///
/// The header is everything before the first `---` delimiter.
/// Each entry block is the slice of lines between two consecutive `---` lines.
fn split_daily_file(content: &str) -> (String, Vec<Vec<String>>) {
    let lines: Vec<&str> = content.lines().collect();

    let delimiters: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter(|(_, l)| l.trim() == "---")
        .map(|(i, _)| i)
        .collect();

    if delimiters.is_empty() {
        return (content.to_string(), vec![]);
    }

    let first = delimiters[0];
    // Trim trailing blank lines from the header.
    let mut header_end = first;
    while header_end > 0 && lines[header_end - 1].trim().is_empty() {
        header_end -= 1;
    }
    let header = lines[..header_end].join("\n");

    let mut blocks = Vec::new();
    for window in delimiters.windows(2) {
        let start = window[0] + 1;
        let end = window[1];
        let block: Vec<String> = lines[start..end].iter().map(|l| l.to_string()).collect();
        if block.iter().any(|l| !l.trim().is_empty()) {
            blocks.push(block);
        }
    }

    (header, blocks)
}

/// The dedup key for an entry block: its first non-empty line (the `HH:MM | …` line).
fn block_key(block: &[String]) -> String {
    block
        .iter()
        .find(|l| !l.trim().is_empty())
        .cloned()
        .unwrap_or_default()
}

/// Extract the sortable time string (`HH:MM`) from an entry block.
/// Returns an empty string for blocks that don't start with a valid timestamp.
fn block_time(block: &[String]) -> String {
    let first = block_key(block);
    let s = first.trim_start_matches('~');
    if s.len() >= 5
        && s.as_bytes()[2] == b':'
        && s[..2].bytes().all(|b| b.is_ascii_digit())
        && s[3..5].bytes().all(|b| b.is_ascii_digit())
    {
        s[..5].to_string()
    } else {
        String::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_entry(id: &str) -> ParsedEntry {
        ParsedEntry {
            id: id.to_string(),
            date: "2026-03-17".to_string(),
            time: "09:05".to_string(),
            body: "test entry".to_string(),
            detail: None,
            entry_type: nichinichi_types::EntryType::Log,
            tags: vec![],
            project: None,
            org: None,
            approximate: false,
            raw_line: String::new(),
        }
    }

    #[test]
    fn test_merge_no_op_when_timestamps_equal() {
        let e = dummy_entry("abc");
        let result = merge_entry(
            &e,
            &e,
            "2026-03-17T09:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::RemoteWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::NoOp));
    }

    #[test]
    fn test_merge_remote_wins_when_local_newer() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::RemoteWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::Use(_)));
    }

    #[test]
    fn test_merge_local_wins_push() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::LocalWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::PushLocal(_)));
    }

    #[test]
    fn test_merge_error_on_conflict() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::Error,
        );
        assert!(matches!(result, Err(CloudError::MergeConflict { .. })));
    }

    // ── merge_daily_file tests ────────────────────────────────────────────────

    const HEADER: &str = "# 2026-03-17";

    fn daily(entries: &[(&str, &str)]) -> String {
        // Build a daily file from (time, body) pairs.
        let mut out = format!("{HEADER}\n");
        for (time, body) in entries {
            out.push_str(&format!("---\n{time} | {body}\n"));
        }
        if !entries.is_empty() {
            out.push_str("---\n");
        }
        out
    }

    #[test]
    fn test_merge_daily_disjoint_entries_are_unioned() {
        let local = daily(&[("09:00", "entry A @acme #log"), ("11:00", "entry B @acme #log")]);
        let remote = daily(&[("10:00", "entry C @acme #log")]);
        let merged = merge_daily_file(&local, &remote);
        assert!(merged.contains("09:00 | entry A"));
        assert!(merged.contains("10:00 | entry C"));
        assert!(merged.contains("11:00 | entry B"));
        // Sorted chronologically — C should appear between A and B
        let pos_a = merged.find("09:00").unwrap();
        let pos_c = merged.find("10:00").unwrap();
        let pos_b = merged.find("11:00").unwrap();
        assert!(pos_a < pos_c && pos_c < pos_b);
    }

    #[test]
    fn test_merge_daily_identical_entries_deduped() {
        let file = daily(&[("09:00", "shared entry @acme #log")]);
        let merged = merge_daily_file(&file, &file);
        assert_eq!(merged.matches("09:00 | shared entry").count(), 1);
    }

    #[test]
    fn test_merge_daily_longer_block_wins() {
        // local has the entry without detail; remote has it with detail
        let local = "# 2026-03-17\n---\n09:00 | fixed the bug @acme #solution\n---\n";
        let remote =
            "# 2026-03-17\n---\n09:00 | fixed the bug @acme #solution\n\n       Root cause: off-by-one\n---\n";
        let merged = merge_daily_file(local, remote);
        assert!(merged.contains("Root cause: off-by-one"));
    }

    #[test]
    fn test_merge_daily_header_taken_from_local() {
        let local = daily(&[("09:00", "local only @acme #log")]);
        let remote = "# 2026-03-17\n---\n10:00 | remote only @acme #log\n---\n";
        let merged = merge_daily_file(&local, remote);
        assert!(merged.starts_with(HEADER));
    }

    #[test]
    fn test_merge_daily_empty_remote() {
        let local = daily(&[("09:00", "only local @acme #log")]);
        let remote = format!("{HEADER}\n");
        let merged = merge_daily_file(&local, &remote);
        assert!(merged.contains("09:00 | only local"));
    }

    #[test]
    fn test_merge_daily_approximate_timestamp_sorted() {
        let local = daily(&[("~09:30", "approximate entry #log")]);
        let remote = daily(&[("09:00", "exact entry #log"), ("10:00", "later #log")]);
        let merged = merge_daily_file(&local, &remote);
        let pos_exact = merged.find("09:00").unwrap();
        let pos_approx = merged.find("~09:30").unwrap();
        let pos_later = merged.find("10:00").unwrap();
        assert!(pos_exact < pos_approx && pos_approx < pos_later);
    }
}
