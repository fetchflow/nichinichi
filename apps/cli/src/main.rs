mod commands;

use anyhow::Result;
use clap::{Parser, Subcommand};
use devlog_parser::load_config;

#[derive(Parser)]
#[command(
    name = "devlog",
    about = "Local-first developer journal and knowledge base",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Log an entry directly (shorthand for `devlog log "text"`)
    #[arg(value_name = "ENTRY")]
    entry: Option<String>,
}

#[derive(Subcommand)]
enum Command {
    /// Log a new journal entry
    Log {
        /// Entry text: `"body @org #type #tags"`
        text: String,
    },
    /// Sync markdown files to SQLite
    Sync {
        /// Drop and rebuild the entire database from scratch
        #[arg(long)]
        rebuild: bool,
    },
    /// Ask the AI a question about your journal
    Ask {
        /// Natural-language query
        query: String,
        /// Filter to a specific org
        #[arg(long)]
        org: Option<String>,
        /// Save the conversation to ~/devlog/ai/
        #[arg(long)]
        save: bool,
    },
    /// Manage goals
    Goals {
        #[command(subcommand)]
        action: GoalAction,
    },
    /// Archive daily files from a previous year
    Archive {
        /// Year to archive (e.g. 2025)
        #[arg(long)]
        year: Option<u32>,
        /// Skip confirmation prompt
        #[arg(long, short = 'y')]
        yes: bool,
    },
}

#[derive(Subcommand)]
enum GoalAction {
    /// List active goals
    List,
    /// Add a new goal
    Add {
        title: String,
        #[arg(long, default_value = "career")]
        r#type: String,
    },
    /// Mark a goal as done
    Done { slug: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let config = load_config(Some(&std::env::current_dir()?))?;

    // Shorthand: `devlog "text"` → log
    if let Some(entry_text) = cli.entry {
        return commands::log::run(&config, &entry_text).await;
    }

    match cli.command {
        Some(Command::Log { text }) => commands::log::run(&config, &text).await,
        Some(Command::Sync { rebuild }) => commands::sync::run(&config, rebuild).await,
        Some(Command::Ask { query, org, save }) => {
            commands::ask::run(&config, &query, org.as_deref(), save).await
        }
        Some(Command::Goals { action }) => match action {
            GoalAction::List => commands::goals::list(&config).await,
            GoalAction::Add { title, r#type } => {
                commands::goals::add(&config, &title, &r#type).await
            }
            GoalAction::Done { slug } => commands::goals::done(&config, &slug).await,
        },
        Some(Command::Archive { year, yes }) => commands::archive::run(&config, year, yes).await,
        None => {
            // No subcommand and no entry text — print help
            use clap::CommandFactory;
            Cli::command().print_help()?;
            Ok(())
        }
    }
}
