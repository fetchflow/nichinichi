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

/// Ask for an org tag. `default` is pre-filled if set.
/// Re-prompts until the value is alphanumeric+hyphens or empty (personal).
pub fn ask_entry_org(default: Option<&str>) -> Result<Option<String>> {
    let prompt = match default {
        Some(d) => format!("Org (Enter for '{d}', blank to skip)"),
        None => "Org, e.g. 'acme' (blank for personal)".to_string(),
    };
    loop {
        let val: String = Input::new()
            .with_prompt(&prompt)
            .allow_empty(true)
            .interact_text()?;
        let val = val.trim().to_string();
        if val.is_empty() {
            return Ok(default.map(String::from));
        }
        if val.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Ok(Some(val));
        }
        eprintln!("  (org must be alphanumeric with hyphens/underscores only, e.g. 'acme' or 'my-team')");
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
