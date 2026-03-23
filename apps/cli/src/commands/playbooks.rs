use anyhow::Result;
use chrono::Local;
use colored::Colorize;
use nichinichi_parser::playbook::parse_playbook_file;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::Config;

use super::prompts;

pub async fn add(config: &Config, title: Option<&str>) -> Result<()> {
    // Resolve title: arg → interactive prompt → bail
    let title = match title {
        Some(t) => t.trim().to_string(),
        None => {
            if prompts::is_interactive() {
                prompts::ask_required("Playbook title")?
            } else {
                anyhow::bail!("title required (pass as argument or run interactively)");
            }
        }
    };

    let slug = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let dir = config.repo.join("playbooks");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{slug}.md"));

    if path.exists() {
        anyhow::bail!("playbook '{}' already exists", slug);
    }

    // Collect optional metadata interactively
    let (tags_str, org_str) = if prompts::is_interactive() {
        let raw_tags = prompts::ask_optional("Tags (comma-separated, Enter to skip)")?;
        let tags: Vec<String> = raw_tags
            .unwrap_or_default()
            .split(',')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        let tags_yaml = if tags.is_empty() {
            "[]".to_string()
        } else {
            format!("[{}]", tags.iter().map(|t| t.as_str()).collect::<Vec<_>>().join(", "))
        };
        let org = prompts::ask_optional("Org, e.g. 'acme' (Enter to skip)")?;
        let org_yaml = org.as_deref().unwrap_or("null").to_string();
        (tags_yaml, org_yaml)
    } else {
        ("[]".to_string(), "null".to_string())
    };

    let today = Local::now().format("%Y-%m-%d").to_string();
    let content = format!(
        "---\ntitle: {title}\ntags: {tags_str}\norg: {org_str}\nforked_from: null\ncreated: {today}\n---\n\n## steps\n\n1. \n"
    );

    std::fs::write(&path, &content)?;

    // Open editor so the user can fill in the steps body
    if prompts::is_interactive() {
        prompts::open_in_editor(&config.editor, &path)?;
    }

    // Re-read + sync to SQLite after the editor closes
    let final_content = std::fs::read_to_string(&path)?;
    let path_str = path.to_string_lossy().to_string();
    let playbook = parse_playbook_file(&final_content, &path_str)?;
    let pool = open_db(&config.repo).await?;
    let target = LocalSqlite::new(pool);
    target.upsert_playbook(&playbook).await?;

    println!("{} {}", "created:".green().bold(), path.display());
    Ok(())
}

pub async fn list(config: &Config) -> Result<()> {
    let dir = config.repo.join("playbooks");
    if !dir.exists() {
        println!("{}", "No playbooks found.".yellow());
        return Ok(());
    }

    let mut found = false;
    let mut entries: Vec<_> = std::fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().and_then(|x| x.to_str()) == Some("md")
        })
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let content = std::fs::read_to_string(&path)?;
        let path_str = path.to_string_lossy().to_string();
        if let Ok(pb) = parse_playbook_file(&content, &path_str) {
            found = true;
            let tags_display = if pb.tags.is_empty() {
                String::new()
            } else {
                format!(" [{}]", pb.tags.join(", "))
            };
            println!("{}{}", pb.title.cyan().bold(), tags_display);
            println!("  {}", pb.id);
        }
    }

    if !found {
        println!("{}", "No playbooks found.".yellow());
    }

    Ok(())
}
