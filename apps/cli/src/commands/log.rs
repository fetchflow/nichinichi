use anyhow::Result;
use chrono::Local;
use colored::Colorize;
use nichinichi_parser::entry::parse_entry_file;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::Config;
use std::io::Write;
use std::path::Path;

use super::prompts;

pub async fn run(config: &Config, text: &str) -> Result<()> {
    let now = Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let time = now.format("%H:%M").to_string();

    // Enrich text with missing org / type tags before writing
    let text = if prompts::is_interactive() {
        enrich_entry_text(text, config.effective_org())?
    } else {
        text.to_string()
    };
    let text = text.as_str();

    // Compose the entry line
    let entry_line = format!("{time} | {text}");

    // Resolve daily file path
    let daily_file = config.repo.join(format!("{date}.md"));

    // Append to file (create with header if absent)
    let header_needed = !daily_file.exists();
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&daily_file)?;

    if header_needed {
        writeln!(file, "# {date}\n")?;
    }
    writeln!(file, "\n---\n{entry_line}\n---")?;
    drop(file);

    // Sync the file to SQLite
    let pool = open_db(&config.repo).await?;
    let content = std::fs::read_to_string(&daily_file)?;
    let default_org = config.effective_org();
    let entries = parse_entry_file(&content, &date, default_org)?;

    let target = LocalSqlite::new(pool);
    for entry in &entries {
        target.upsert_entry(entry).await?;
    }

    println!("{} {}", "logged".green().bold(), entry_line);

    // Optionally collect a multi-line detail block (interactive only)
    if prompts::is_interactive() {
        if let Some(detail) = prompts::ask_detail(&config.editor)? {
            if !detail.trim().is_empty() {
                append_detail_to_entry(&daily_file, &detail)?;
                // Re-sync so SQLite reflects the detail block
                let content = std::fs::read_to_string(&daily_file)?;
                let entries = parse_entry_file(&content, &date, default_org)?;
                for entry in &entries {
                    target.upsert_entry(entry).await?;
                }
            }
        }
    }

    Ok(())
}

/// Prompts for missing #type and @org tags, returning an enriched text string.
fn enrich_entry_text(text: &str, default_org: Option<&str>) -> Result<String> {
    let mut out = text.to_string();

    if !has_type_tag(text) {
        let inferred = infer_type(text);
        let chosen = prompts::ask_entry_type(inferred)?;
        out = format!("{out} #{chosen}");
    }

    if !has_org_tag(text) {
        if let Some(org) = prompts::ask_entry_org(default_org)? {
            out = format!("{out} @{org}");
        }
    }

    Ok(out)
}

/// Returns true if the text already contains an explicit @org tag.
fn has_org_tag(text: &str) -> bool {
    text.split_whitespace().any(|w| w.starts_with('@'))
}

/// Returns true if the text already contains an explicit #<known_type> tag.
fn has_type_tag(text: &str) -> bool {
    const KNOWN: &[&str] = &["#log", "#solution", "#decision", "#reflection", "#score", "#ai"];
    text.split_whitespace().any(|w| KNOWN.contains(&w))
}

/// Infers an entry type from the body text, mirroring the parser's rules.
fn infer_type(text: &str) -> &'static str {
    let b = text.to_lowercase();
    if b.contains("fixed") || b.contains("solved") || b.contains("workaround") || b.contains("the fix") {
        "solution"
    } else if b.contains("chose") || b.contains("decided") || b.contains("rejected") || b.contains("picked") {
        "decision"
    } else if b.contains("clicked") || b.contains("realised") || b.contains("learned") || b.contains("finally") {
        "reflection"
    } else if b.contains("shipped") || b.contains("merged") || b.contains("closed") || b.contains("unblocked") {
        "score"
    } else if b.contains("claude") || b.contains("gpt") || b.contains(" ai ") || b.contains("prompt") || b.contains("copilot") {
        "ai"
    } else {
        "log"
    }
}

/// Appends an indented detail block to the last entry in a daily file.
///
/// The file was just written with the closing `---` as the final line.
/// We trim that trailer and re-append it after the indented detail block.
fn append_detail_to_entry(path: &Path, detail: &str) -> Result<()> {
    let content = std::fs::read_to_string(path)?;
    // writeln! leaves a trailing \n, so content ends with "---\n".
    // Trim whitespace first, then strip the closing "---, then trim again.
    let trimmed = content.trim_end();
    let base = trimmed
        .strip_suffix("---")
        .ok_or_else(|| anyhow::anyhow!("entry file missing closing ---"))?
        .trim_end();
    let indented = detail
        .lines()
        .map(|l| format!("       {l}"))
        .collect::<Vec<_>>()
        .join("\n");
    let updated = format!("{base}\n\n{indented}\n---\n");
    std::fs::write(path, updated)?;
    Ok(())
}
