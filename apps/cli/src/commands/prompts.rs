use anyhow::Result;
use dialoguer::{Confirm, Editor, Input, Select};
use std::io::IsTerminal;

pub fn is_interactive() -> bool {
    std::io::stdin().is_terminal()
}

/// Optional text — Enter on empty returns None.
pub fn ask_optional(prompt: &str) -> Result<Option<String>> {
    let val: String = Input::new()
        .with_prompt(prompt)
        .allow_empty(true)
        .interact_text()?;
    Ok(if val.trim().is_empty() { None } else { Some(val.trim().to_string()) })
}

/// Required text — loops until non-empty.
pub fn ask_required(prompt: &str) -> Result<String> {
    loop {
        let val: String = Input::new()
            .with_prompt(prompt)
            .allow_empty(true)
            .interact_text()?;
        if !val.trim().is_empty() {
            return Ok(val.trim().to_string());
        }
        eprintln!("  (required — please enter a value)");
    }
}

/// y/N confirm.
pub fn ask_confirm(prompt: &str, default: bool) -> Result<bool> {
    Ok(Confirm::new().with_prompt(prompt).default(default).interact()?)
}

/// Opens $EDITOR for multi-line detail text. Returns None if skipped or empty.
pub fn ask_detail(editor: &str) -> Result<Option<String>> {
    if !ask_confirm("Add a detail block? (opens editor)", false)? {
        return Ok(None);
    }
    let text = Editor::new()
        .executable(editor)
        .edit("# Enter detail below (save and close to confirm, leave empty to skip)\n")?;
    Ok(text.and_then(|t| {
        // Strip the instruction comment line
        let stripped = t
            .lines()
            .filter(|l| !l.starts_with('#'))
            .collect::<Vec<_>>()
            .join("\n");
        let trimmed = stripped.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    }))
}

/// Collects one or more step titles. First step is required.
pub fn collect_steps() -> Result<Vec<String>> {
    let mut steps = Vec::new();
    println!("  Add goal steps (first step required):");
    loop {
        let prompt = if steps.is_empty() {
            "  Step 1".to_string()
        } else {
            format!("  Step {}", steps.len() + 1)
        };
        let val: String = Input::new()
            .with_prompt(&prompt)
            .allow_empty(true)
            .interact_text()?;
        let val = val.trim().to_string();
        if val.is_empty() {
            if steps.is_empty() {
                eprintln!("  (at least one step required)");
                continue;
            }
            break;
        }
        steps.push(val);
        if !ask_confirm("  Add another step?", false)? {
            break;
        }
    }
    Ok(steps)
}

const ENTRY_TYPES: &[&str] = &["log", "solution", "decision", "reflection", "score", "ai"];

/// Select an entry type, pre-selecting `inferred` as the default.
pub fn ask_entry_type(inferred: &str) -> Result<&'static str> {
    let default_idx = ENTRY_TYPES.iter().position(|&t| t == inferred).unwrap_or(0);
    let selection = Select::new()
        .with_prompt("Entry type")
        .items(ENTRY_TYPES)
        .default(default_idx)
        .interact()?;
    Ok(ENTRY_TYPES[selection])
}

/// Select an org from known orgs, with "personal" and "enter new…" options.
/// `known_orgs` comes from `SELECT DISTINCT org FROM entries`.
/// `default` is pre-selected if it appears in the list.
pub fn ask_entry_org(known_orgs: &[String], default: Option<&str>) -> Result<Option<String>> {
    const PERSONAL: &str = "— personal (no org) —";
    const NEW: &str = "+ enter new org";

    // Build item list: known orgs, then personal, then new-entry option
    let mut items: Vec<&str> = known_orgs.iter().map(String::as_str).collect();
    items.push(PERSONAL);
    items.push(NEW);

    // Pre-select the default org if it's in the list, otherwise personal
    let default_idx = default
        .and_then(|d| items.iter().position(|&i| i == d))
        .unwrap_or(items.len() - 2); // "personal"

    let selection = Select::new()
        .with_prompt("Org")
        .items(&items)
        .default(default_idx)
        .interact()?;

    match items[selection] {
        PERSONAL => Ok(None),
        NEW => ask_new_org(),
        chosen => Ok(Some(chosen.to_string())),
    }
}

/// Text input fallback for entering a new org not yet in the DB.
fn ask_new_org() -> Result<Option<String>> {
    loop {
        let val: String = Input::new()
            .with_prompt("Org name (alphanumeric + hyphens, blank for personal)")
            .allow_empty(true)
            .interact_text()?;
        let val = val.trim().to_string();
        if val.is_empty() {
            return Ok(None);
        }
        if val.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Ok(Some(val));
        }
        eprintln!("  (must be alphanumeric with hyphens/underscores only, e.g. 'acme' or 'my-team')");
    }
}

/// Opens $EDITOR on an existing file path (editor modifies the file in place).
pub fn open_in_editor(editor: &str, path: &std::path::Path) -> Result<()> {
    let status = std::process::Command::new(editor).arg(path).status()?;
    if !status.success() {
        anyhow::bail!("editor exited with non-zero status");
    }
    Ok(())
}
