use anyhow::Result;
use chrono::Local;
use colored::Colorize;
use nichinichi_parser::entry::parse_entry_file;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::Config;
use std::io::Write;

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
    Ok(())
}
