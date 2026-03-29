use crate::{
    digest::{parse_ai_conversation_file, parse_digest_file},
    entry::parse_entry_file,
    goal::parse_goal_file,
    playbook::parse_playbook_file,
    ParseError,
};
use nichinichi_types::{AiConversation, Config, Digest, Goal, ParsedEntry, Playbook};
use std::path::Path;

/// All possible parsed outputs from a single file.
#[derive(Debug)]
pub enum ParsedFile {
    Entries(Vec<ParsedEntry>),
    Goal(Goal),
    Playbook(Playbook),
    Digest(Digest),
    AiConversation(AiConversation),
}

/// Detect the file type from its path and parse it accordingly.
///
/// Path detection rules (in order):
/// - `goals/active/*.md` or `goals/archive/*.md` → Goal
/// - `playbooks/*.md` → Playbook
/// - `digests/*.md` → Digest
/// - `ai/*.md` → AiConversation
/// - `YYYY-MM-DD.md` anywhere else → daily entries
pub fn parse_file(path: &Path, config: &Config) -> Result<ParsedFile, ParseError> {
    let path_str = path.to_string_lossy();

    // Normalise to forward slashes for matching
    let normalised = path_str.replace('\\', "/");

    let content = std::fs::read_to_string(path)?;

    if normalised.contains("/goals/active/") || normalised.contains("/goals/archive/") {
        let goal = parse_goal_file(&content, &normalised)?;
        return Ok(ParsedFile::Goal(goal));
    }

    if normalised.contains("/playbooks/") {
        let pb = parse_playbook_file(&content, &normalised)?;
        return Ok(ParsedFile::Playbook(pb));
    }

    if normalised.contains("/digests/") {
        let d = parse_digest_file(&content, &normalised)?;
        return Ok(ParsedFile::Digest(d));
    }

    if normalised.contains("/ai/") {
        let ai = parse_ai_conversation_file(&content, &normalised)?;
        return Ok(ParsedFile::AiConversation(ai));
    }

    // Fall through: expect a daily entry file named YYYY-MM-DD.md
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if let Some(date) = extract_date(filename) {
        let default_org = config.effective_org();
        let entries = parse_entry_file(&content, &date, default_org)?;
        return Ok(ParsedFile::Entries(entries));
    }

    Err(ParseError::Format(format!(
        "unrecognised file: {}",
        path.display()
    )))
}

/// Extract `YYYY-MM-DD` from a filename like `2026-03-17.md`.
fn extract_date(filename: &str) -> Option<String> {
    let stem = filename.strip_suffix(".md")?;
    // Must be exactly 10 chars: YYYY-MM-DD
    if stem.len() == 10 {
        let bytes = stem.as_bytes();
        if bytes[4] == b'-' && bytes[7] == b'-' {
            return Some(stem.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use nichinichi_types::Config;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn test_config() -> Config {
        Config {
            repo: PathBuf::from("/tmp"),
            editor: "vim".to_string(),
            ai: Default::default(),
            default_org: None,
            cloud: None,
            project_org: None,
        }
    }

    // ── extract_date ──────────────────────────────────────────────────────

    #[test]
    fn extract_date_valid() {
        assert_eq!(
            extract_date("2026-03-17.md"),
            Some("2026-03-17".to_string())
        );
    }

    #[test]
    fn extract_date_invalid() {
        assert_eq!(extract_date("foo.md"), None);
        assert_eq!(extract_date("2026-03.md"), None);
        assert_eq!(extract_date("20260317.md"), None);
        assert_eq!(extract_date("README.md"), None);
    }

    // ── parse_file routing ────────────────────────────────────────────────

    #[test]
    fn route_goal_active() {
        let dir = tempdir().unwrap();
        let goal_dir = dir.path().join("goals").join("active");
        std::fs::create_dir_all(&goal_dir).unwrap();
        let path = goal_dir.join("my-goal.md");
        std::fs::write(&path, "---\nstatus: active\n---\n\n# My Goal\n").unwrap();
        let result = parse_file(&path, &test_config()).unwrap();
        assert!(matches!(result, ParsedFile::Goal(_)));
    }

    #[test]
    fn route_goal_archive() {
        let dir = tempdir().unwrap();
        let goal_dir = dir.path().join("goals").join("archive");
        std::fs::create_dir_all(&goal_dir).unwrap();
        let path = goal_dir.join("old-goal.md");
        std::fs::write(&path, "---\nstatus: done\n---\n\n# Old Goal\n").unwrap();
        let result = parse_file(&path, &test_config()).unwrap();
        assert!(matches!(result, ParsedFile::Goal(_)));
    }

    #[test]
    fn route_playbook() {
        let dir = tempdir().unwrap();
        let pb_dir = dir.path().join("playbooks");
        std::fs::create_dir_all(&pb_dir).unwrap();
        let path = pb_dir.join("my-playbook.md");
        std::fs::write(
            &path,
            "---\ntitle: My Playbook\ntags: []\nforked_from: null\ncreated: 2026-01-05\n---\n\n## steps\n\n1. Do something\n",
        )
        .unwrap();
        let result = parse_file(&path, &test_config()).unwrap();
        assert!(matches!(result, ParsedFile::Playbook(_)));
    }

    #[test]
    fn route_digest() {
        let dir = tempdir().unwrap();
        let d_dir = dir.path().join("digests");
        std::fs::create_dir_all(&d_dir).unwrap();
        let path = d_dir.join("2026-03-17-weekly.md");
        std::fs::write(
            &path,
            "---\ntype: weekly\nperiod_start: '2026-03-11'\nperiod_end: '2026-03-17'\n---\n\nWeekly summary.\n",
        )
        .unwrap();
        let result = parse_file(&path, &test_config()).unwrap();
        assert!(matches!(result, ParsedFile::Digest(_)));
    }

    #[test]
    fn route_daily_entry() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("2026-03-17.md");
        std::fs::write(&path, "# 2026-03-17\n\n---\n09:05 | test entry #log\n---\n").unwrap();
        let result = parse_file(&path, &test_config()).unwrap();
        assert!(matches!(result, ParsedFile::Entries(_)));
    }

    #[test]
    fn route_unrecognised_returns_error() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("README.md");
        std::fs::write(&path, "# README\n").unwrap();
        assert!(parse_file(&path, &test_config()).is_err());
    }
}
