use anyhow::Result;
use chrono::Local;
use colored::Colorize;
use devlog_types::Config;
use std::io::{self, BufRead, Write};

pub async fn run(config: &Config, year: Option<u32>, yes: bool) -> Result<()> {
    let target_year = year.unwrap_or_else(|| {
        Local::now().format("%Y").to_string().parse::<u32>().unwrap_or(2024) - 1
    });

    let pattern = format!("{target_year}-");
    let mut to_archive: Vec<std::path::PathBuf> = Vec::new();

    for entry in std::fs::read_dir(&config.repo)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with(&pattern) && name.ends_with(".md") {
            to_archive.push(path);
        }
    }

    if to_archive.is_empty() {
        println!("{}", format!("No files to archive for {target_year}.").yellow());
        return Ok(());
    }

    println!(
        "Found {} files to archive to archive/{}/",
        to_archive.len(),
        target_year
    );

    if !yes {
        print!("Continue? [y/N] ");
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().lock().read_line(&mut input)?;
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Aborted.");
            return Ok(());
        }
    }

    let archive_dir = config.repo.join("archive").join(target_year.to_string());
    std::fs::create_dir_all(&archive_dir)?;

    let mut count = 0;
    for path in &to_archive {
        let dest = archive_dir.join(path.file_name().unwrap());
        std::fs::rename(path, &dest)?;
        count += 1;
    }

    println!(
        "{} {} files archived to archive/{}/",
        "done:".green().bold(),
        count,
        target_year
    );

    Ok(())
}
