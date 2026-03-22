use anyhow::Result;
use chrono::Local;
use colored::Colorize;
use nichinichi_parser::goal::parse_goal_file;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::{Config, GoalStatus};
use std::io::Write;

pub async fn list(config: &Config) -> Result<()> {
    let goals_dir = config.repo.join("goals").join("active");
    if !goals_dir.exists() {
        println!("{}", "No active goals found.".yellow());
        return Ok(());
    }

    let mut found = false;
    for entry in std::fs::read_dir(&goals_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = std::fs::read_to_string(&path)?;
        let path_str = path.to_string_lossy().to_string();
        if let Ok(goal) = parse_goal_file(&content, &path_str) {
            found = true;
            let done = goal.steps.iter().filter(|s| matches!(s.status, nichinichi_types::GoalStepStatus::Done)).count();
            let total = goal.steps.len();
            println!(
                "{} {} {}/{} steps",
                goal.id.cyan().bold(),
                goal.title,
                done,
                total
            );
            for step in &goal.steps {
                let check = if matches!(step.status, nichinichi_types::GoalStepStatus::Done) {
                    "[x]".green()
                } else {
                    "[ ]".normal()
                };
                println!("  {} {}", check, step.title);
            }
        }
    }

    if !found {
        println!("{}", "No active goals found.".yellow());
    }

    Ok(())
}

pub async fn add(config: &Config, title: &str, goal_type: &str) -> Result<()> {
    let slug = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let dir = config.repo.join("goals").join("active");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{slug}.md"));

    if path.exists() {
        anyhow::bail!("goal '{}' already exists", slug);
    }

    let today = Local::now().format("%Y-%m-%d").to_string();
    let content = format!(
        "---\ntype: {goal_type}\norg: null\nhorizon: null\nstatus: active\nwhy: \ncreated: {today}\n---\n\n# {title}\n\n## steps\n\n- [ ] first step\n\n## progress\n"
    );

    let mut file = std::fs::File::create(&path)?;
    file.write_all(content.as_bytes())?;

    // Sync to SQLite
    let pool = open_db(&config.repo).await?;
    let path_str = path.to_string_lossy().to_string();
    let goal = parse_goal_file(&content, &path_str)?;
    let target = LocalSqlite::new(pool);
    target.upsert_goal(&goal).await?;

    println!("{} {} ({})", "created:".green().bold(), path.display(), slug);
    Ok(())
}

pub async fn done(config: &Config, slug: &str) -> Result<()> {
    let active_path = config.repo.join("goals").join("active").join(format!("{slug}.md"));
    if !active_path.exists() {
        anyhow::bail!("goal '{}' not found in goals/active/", slug);
    }

    let content = std::fs::read_to_string(&active_path)?;
    let path_str = active_path.to_string_lossy().to_string();
    let mut goal = parse_goal_file(&content, &path_str)?;

    // Update status in frontmatter and add completion_date
    let today = Local::now().format("%Y-%m-%d").to_string();
    let updated_content = content
        .replacen("status: active", "status: done", 1)
        .replacen("status: paused", "status: done", 1);
    let updated_content = if updated_content.contains("completion_date:") {
        updated_content
    } else {
        updated_content.replacen("---\n\n#", &format!("completion_date: {today}\n---\n\n#"), 1)
    };

    let archive_dir = config.repo.join("goals").join("archive");
    std::fs::create_dir_all(&archive_dir)?;
    let archive_path = archive_dir.join(format!("{slug}.md"));

    std::fs::write(&archive_path, &updated_content)?;
    std::fs::remove_file(&active_path)?;

    // Sync to SQLite
    let pool = open_db(&config.repo).await?;
    let archive_str = archive_path.to_string_lossy().to_string();
    goal.status = GoalStatus::Done;
    goal.file_path = archive_str.clone();
    goal.completion_date = Some(today);

    let archived_goal = parse_goal_file(&updated_content, &archive_str)?;
    let target = LocalSqlite::new(pool);
    target.upsert_goal(&archived_goal).await?;

    println!("{} {} archived to goals/archive/", "done:".green().bold(), slug);
    Ok(())
}
