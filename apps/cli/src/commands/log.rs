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
