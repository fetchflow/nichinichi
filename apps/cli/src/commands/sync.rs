use anyhow::Result;
use colored::Colorize;
use nichinichi_sync::{open_db, LocalSqlite, SyncTarget};
use nichinichi_types::Config;

pub async fn run(config: &Config, rebuild: bool) -> Result<()> {
    let pool = open_db(&config.repo).await?;
    let target = LocalSqlite::new(pool);

    if rebuild {
        println!("{}", "Rebuilding database from markdown files...".yellow());
        target.rebuild(&config.repo, config).await?;
        println!("{}", "Rebuild complete.".green().bold());
    } else {
        println!("{}", "Syncing...".yellow());
        target.rebuild(&config.repo, config).await?;
        println!("{}", "Sync complete.".green().bold());
    }

    Ok(())
}
