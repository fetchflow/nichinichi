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
