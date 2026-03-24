use anyhow::{anyhow, Result};
use colored::Colorize;
use dialoguer::{Input, Select};
use nichinichi_parser::entry::parse_entry_file;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::Config;

pub async fn run(config: &Config) -> Result<()> {
    let pool = open_db(&config.repo).await?;

    // Fetch recent 20 entries
    let rows: Vec<(String, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, date, time, body, raw_line FROM entries ORDER BY date DESC, time DESC LIMIT 20",
    )
    .fetch_all(&pool)
    .await?;

    if rows.is_empty() {
        println!("No entries found.");
        return Ok(());
    }

    // Build display labels
    let labels: Vec<String> = rows
        .iter()
        .map(|(_, date, time, body, _)| format!("{date} {time}  {body}"))
        .collect();

    let selection = Select::new()
        .with_prompt("Select entry to edit")
        .items(&labels)
        .default(0)
        .interact()?;

    let (id, date, time, body, raw_line) = &rows[selection];
    let raw_line = raw_line
        .as_deref()
        .ok_or_else(|| anyhow!("entry has no raw_line"))?;

    // Prompt for new body text, pre-filled with current value
    let new_body: String = Input::new()
        .with_prompt("Edit entry")
        .with_initial_text(body)
        .interact_text()?;

    let new_body = new_body.trim();
    if new_body == body.as_str() {
        println!("{}", "No changes made.".dimmed());
        return Ok(());
    }

    let new_raw_line = format!("{time} | {new_body}");

    // Find markdown file
    let file_path = find_entry_file(config, date)
        .ok_or_else(|| anyhow!("could not find markdown file for date {date}"))?;

    let content = std::fs::read_to_string(&file_path)?;
    let updated = replace_entry_block(&content, raw_line, &new_raw_line, None);
    std::fs::write(&file_path, &updated)?;

    // Re-parse and upsert
    let default_org = config.effective_org();
    let entries = parse_entry_file(&updated, date, default_org)?;

    let new_entry = entries
        .into_iter()
        .find(|e| e.raw_line == new_raw_line)
        .ok_or_else(|| anyhow!("could not locate updated entry after re-parse"))?;

    let target = LocalSqlite::new(pool);
    target.delete_entry(id).await?;
    target.upsert_entry(&new_entry).await?;

    println!("{} {}", "updated".green().bold(), new_raw_line);
    Ok(())
}

fn find_entry_file(config: &Config, date: &str) -> Option<std::path::PathBuf> {
    let root = config.repo.join(format!("{date}.md"));
    if root.exists() {
        return Some(root);
    }
    // Check archive/{year}/{date}.md
    let year = date.split('-').next()?;
    let archived = config.repo.join("archive").join(year).join(format!("{date}.md"));
    if archived.exists() {
        return Some(archived);
    }
    None
}

fn replace_entry_block(
    content: &str,
    old_raw_line: &str,
    new_raw_line: &str,
    new_detail: Option<&str>,
) -> String {
    let blocks: Vec<&str> = content.split("\n---\n").collect();
    let mut out: Vec<String> = Vec::with_capacity(blocks.len());

    for block in blocks {
        let trimmed = block.trim();
        // Entry blocks start with HH:MM or ~HH:MM
        let first_line = trimmed.lines().next().unwrap_or("");
        let block_raw = first_line.trim();

        if block_raw == old_raw_line {
            // Build replacement block
            let mut new_block = new_raw_line.to_string();
            if let Some(detail) = new_detail {
                for line in detail.lines() {
                    new_block.push_str(&format!("\n       {line}"));
                }
            }
            out.push(new_block);
        } else {
            out.push(block.to_string());
        }
    }

    out.join("\n---\n")
}
