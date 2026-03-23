use anyhow::Result;
use dialoguer::{Confirm, Editor, Input};
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

/// Opens $EDITOR on an existing file path (editor modifies the file in place).
pub fn open_in_editor(editor: &str, path: &std::path::Path) -> Result<()> {
    let status = std::process::Command::new(editor).arg(path).status()?;
    if !status.success() {
        anyhow::bail!("editor exited with non-zero status");
    }
    Ok(())
}
