use crate::ParseError;
use devlog_types::{
    Goal, GoalProgress, GoalStatus, GoalStep, GoalStepStatus, GoalType, ProgressSignal,
};
use sha2::{Digest, Sha256};
use std::path::Path;

/// Parse a goal markdown file.
pub fn parse_goal_file(content: &str, file_path: &str) -> Result<Goal, ParseError> {
    let slug = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Split out YAML frontmatter
    let (frontmatter, body) = extract_frontmatter(content)?;
    let fm: serde_yaml::Value = serde_yaml::from_str(&frontmatter)?;

    let title = extract_heading(body).unwrap_or_else(|| slug.replace('-', " "));

    let goal_type = fm
        .get("type")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<GoalType>().ok());

    let status = fm
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<GoalStatus>().ok())
        .unwrap_or(GoalStatus::Active);

    let horizon = fm.get("horizon").and_then(|v| v.as_str()).map(String::from);
    let why = fm.get("why").and_then(|v| v.as_str()).map(String::from);
    let org = fm.get("org").and_then(|v| v.as_str()).map(String::from);
    let created_at = fm
        .get("created")
        .and_then(|v| v.as_str())
        .map(String::from);
    let completion_date = fm
        .get("completion_date")
        .and_then(|v| v.as_str())
        .map(String::from);

    let steps = parse_steps(body, &slug);
    let progress = parse_progress(body, &slug);

    Ok(Goal {
        id: slug,
        title,
        goal_type,
        horizon,
        status,
        why,
        org,
        file_path: file_path.to_string(),
        created_at,
        updated_at: None,
        completion_date,
        steps,
        progress,
    })
}

fn extract_frontmatter(content: &str) -> Result<(String, &str), ParseError> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return Err(ParseError::Format("goal file missing YAML frontmatter".into()));
    }
    let after_open = &content[3..];
    let end = after_open.find("\n---").ok_or_else(|| {
        ParseError::Format("goal file frontmatter not closed".into())
    })?;
    let frontmatter = after_open[..end].trim().to_string();
    let body = &after_open[end + 4..]; // skip "\n---"
    Ok((frontmatter, body))
}

fn extract_heading(body: &str) -> Option<String> {
    body.lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").trim().to_string())
}

fn step_id(goal_id: &str, title: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(goal_id.as_bytes());
    hasher.update(title.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn parse_steps(body: &str, goal_id: &str) -> Vec<GoalStep> {
    let mut steps = Vec::new();
    let mut in_steps = false;
    let mut position: i64 = 0;
    let mut current_step: Option<(String, GoalStepStatus)> = None;
    let mut notes_lines: Vec<String> = Vec::new();
    let mut due_date: Option<String> = None;

    let flush = |step: Option<(String, GoalStepStatus)>,
                 notes: &mut Vec<String>,
                 due: &mut Option<String>,
                 steps: &mut Vec<GoalStep>,
                 pos: &mut i64,
                 goal_id: &str| {
        if let Some((title, status)) = step {
            let notes_str = if notes.is_empty() {
                None
            } else {
                Some(notes.join(" "))
            };
            steps.push(GoalStep {
                id: step_id(goal_id, &title),
                goal_id: goal_id.to_string(),
                title,
                status,
                notes: notes_str,
                due_date: due.take(),
                position: *pos,
            });
            *pos += 1;
            notes.clear();
        }
    };

    for line in body.lines() {
        let trimmed = line.trim();

        if trimmed == "## steps" {
            in_steps = true;
            continue;
        }
        if trimmed.starts_with("## ") && trimmed != "## steps" {
            if in_steps {
                flush(current_step.take(), &mut notes_lines, &mut due_date, &mut steps, &mut position, goal_id);
            }
            in_steps = false;
            continue;
        }

        if !in_steps {
            continue;
        }

        if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [ ] ") {
            flush(current_step.take(), &mut notes_lines, &mut due_date, &mut steps, &mut position, goal_id);
            let done = trimmed.starts_with("- [x] ");
            let title = trimmed[6..].trim().to_string();
            let status = if done { GoalStepStatus::Done } else { GoalStepStatus::NotStarted };
            current_step = Some((title, status));
        } else if current_step.is_some() && (line.starts_with("      ") || line.starts_with('\t')) {
            // indented metadata under a step
            if let Some(rest) = trimmed.strip_prefix("notes:") {
                notes_lines.push(rest.trim().to_string());
            } else if let Some(rest) = trimmed.strip_prefix("due:") {
                due_date = Some(rest.trim().to_string());
            } else {
                notes_lines.push(trimmed.to_string());
            }
        }
    }
    flush(current_step.take(), &mut notes_lines, &mut due_date, &mut steps, &mut position, goal_id);

    steps
}

fn parse_progress(body: &str, goal_id: &str) -> Vec<GoalProgress> {
    let mut progress = Vec::new();
    let mut in_progress_section = false;
    let mut current_date: Option<String> = None;
    let mut current_signal: Option<ProgressSignal> = None;
    let mut note_lines: Vec<String> = Vec::new();
    let mut current_refs: Vec<String> = Vec::new();

    let flush = |date: &mut Option<String>,
                 signal: &mut Option<ProgressSignal>,
                 notes: &mut Vec<String>,
                 refs: &mut Vec<String>,
                 progress: &mut Vec<GoalProgress>,
                 goal_id: &str| {
        if let (Some(d), Some(sig)) = (date.take(), signal.take()) {
            let note = if notes.is_empty() { None } else { Some(notes.join(" ")) };
            progress.push(GoalProgress {
                id: {
                    let mut h = Sha256::new();
                    h.update(goal_id.as_bytes());
                    h.update(d.as_bytes());
                    format!("{:x}", h.finalize())
                },
                goal_id: goal_id.to_string(),
                period_start: d.clone(),
                period_end: d,
                signal: sig,
                note,
                created_at: None,
                refs: refs.drain(..).collect(),
            });
            notes.clear();
        }
    };

    for line in body.lines() {
        let trimmed = line.trim();

        if trimmed == "## progress" {
            in_progress_section = true;
            continue;
        }
        if trimmed.starts_with("## ") && trimmed != "## progress" {
            if in_progress_section {
                flush(&mut current_date, &mut current_signal, &mut note_lines, &mut current_refs, &mut progress, goal_id);
            }
            in_progress_section = false;
            continue;
        }

        if !in_progress_section {
            continue;
        }

        if trimmed.starts_with("### ") {
            flush(&mut current_date, &mut current_signal, &mut note_lines, &mut current_refs, &mut progress, goal_id);
            current_date = Some(trimmed[4..].trim().to_string());
        } else if let Some(rest) = trimmed.strip_prefix("signal:") {
            current_signal = rest.trim().parse::<ProgressSignal>().ok();
        } else if let Some(rest) = trimmed.strip_prefix("note:") {
            note_lines.push(rest.trim().to_string());
        } else if let Some(rest) = trimmed.strip_prefix("refs:") {
            // Parse "refs: [2026-03-17 11:32, 2026-03-17 16:48]"
            let inner = rest.trim().trim_start_matches('[').trim_end_matches(']');
            current_refs = inner.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        } else if !trimmed.is_empty() && current_date.is_some() {
            note_lines.push(trimmed.to_string());
        }
    }
    flush(&mut current_date, &mut current_signal, &mut note_lines, &mut current_refs, &mut progress, goal_id);

    progress
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"---
type: career
org: acme
horizon: end of 2027
status: active
why: want to lead technical direction, not just implement
created: 2026-01-05
---

# become a staff engineer

## steps

- [x] mentor a junior through a full feature end to end
      notes: David's auth PR — Mar 2026
- [ ] lead a cross-team technical initiative
      notes: devlog platform counts — spans 3 projects
- [ ] write and publish a technical design doc
      due: 2026-06-01

## progress

### 2026-03-17
signal: strong
note: Strong impact signal this week.

### 2026-03-10
signal: moderate
note: One mentorship entry.
"#;

    #[test]
    fn test_parse_goal_basic() {
        let goal = parse_goal_file(SAMPLE, "goals/active/become-staff-engineer.md").unwrap();
        assert_eq!(goal.id, "become-staff-engineer");
        assert_eq!(goal.title, "become a staff engineer");
        assert_eq!(goal.org.as_deref(), Some("acme"));
        assert_eq!(goal.status, GoalStatus::Active);
    }

    #[test]
    fn test_parse_goal_steps() {
        let goal = parse_goal_file(SAMPLE, "goals/active/become-staff-engineer.md").unwrap();
        assert_eq!(goal.steps.len(), 3);
        assert_eq!(goal.steps[0].status, GoalStepStatus::Done);
        assert!(goal.steps[0].notes.as_ref().unwrap().contains("David"));
        assert_eq!(goal.steps[2].due_date.as_deref(), Some("2026-06-01"));
    }

    #[test]
    fn test_parse_goal_progress() {
        let goal = parse_goal_file(SAMPLE, "goals/active/become-staff-engineer.md").unwrap();
        assert_eq!(goal.progress.len(), 2);
        assert_eq!(goal.progress[0].signal, ProgressSignal::Strong);
        assert_eq!(goal.progress[1].signal, ProgressSignal::Moderate);
    }
}
