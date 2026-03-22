use anyhow::Result;
use colored::Colorize;
use nichinichi_ai::{save_conversation, search_entries, AiClient};
use nichinichi_sync::open_db;
use nichinichi_types::{Config, OrgScope};
use std::io::{self, Write};

pub async fn run(
    config: &Config,
    query: &str,
    org: Option<&str>,
    save: bool,
) -> Result<()> {
    let pool = open_db(&config.repo).await?;

    let org_scope = match org {
        None => OrgScope::All,
        Some("personal") => OrgScope::Personal,
        Some(o) => OrgScope::Org(o.to_string()),
    };

    // Search for relevant context
    let context = search_entries(&pool, query, &org_scope, 20).await?;

    if context.is_empty() {
        println!("{}", "No matching entries found in your journal.".yellow());
    }

    println!("{}", "nichinichi:".cyan().bold());

    let client = AiClient::new(config.ai.clone());
    let response = client
        .ask(query, &context, &[], |chunk| {
            print!("{chunk}");
            let _ = io::stdout().flush();
        })
        .await?;

    println!(); // newline after streaming

    if save {
        let path = save_conversation(&config.repo, query, &response, org, None).await?;
        println!(
            "\n{} {}",
            "saved:".green().bold(),
            path.display()
        );
    }

    Ok(())
}
