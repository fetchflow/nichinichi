use nichinichi_ai::{list_conversations, load_conversation, save_conversation, search_entries, AiClient};
use nichinichi_sync::{rebuild_from_disk, sync_incremental, LocalSqlite, SyncTarget};
use nichinichi_types::{ChatMessage, Config, Digest, Goal, OrgScope, ParsedEntry, Playbook};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::{Emitter, State, Window};
use tokio::sync::Mutex;

/// App-level state held in Tauri's managed state.
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Config,
}

// ── Entries ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_entries(
    date: Option<String>,
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ParsedEntry>, String> {
    let state = state.lock().await;
    let pool = &state.pool;

    let rows = match (date, org) {
        (Some(d), Some(o)) => {
            sqlx::query_as::<_, EntryRow>(
                "SELECT id, date, time, body, detail, type, tags, project, org, approximate, raw_line
                 FROM entries WHERE date = ? AND org = ? ORDER BY time",
            )
            .bind(d)
            .bind(o)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?
        }
        (Some(d), None) => {
            sqlx::query_as::<_, EntryRow>(
                "SELECT id, date, time, body, detail, type, tags, project, org, approximate, raw_line
                 FROM entries WHERE date = ? ORDER BY time",
            )
            .bind(d)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?
        }
        (None, Some(o)) => {
            sqlx::query_as::<_, EntryRow>(
                "SELECT id, date, time, body, detail, type, tags, project, org, approximate, raw_line
                 FROM entries WHERE org = ? ORDER BY date DESC, time DESC LIMIT 100",
            )
            .bind(o)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?
        }
        (None, None) => {
            sqlx::query_as::<_, EntryRow>(
                "SELECT id, date, time, body, detail, type, tags, project, org, approximate, raw_line
                 FROM entries ORDER BY date DESC, time DESC LIMIT 100",
            )
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?
        }
    };

    Ok(rows.into_iter().map(row_to_entry).collect())
}

#[tauri::command]
pub async fn add_entry(
    text: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<ParsedEntry, String> {
    let state = state.lock().await;
    let config = &state.config;

    let now = chrono::Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let time = now.format("%H:%M").to_string();
    let entry_line = format!("{time} | {text}");

    let daily_file = config.repo.join(format!("{date}.md"));
    let header_needed = !daily_file.exists();

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&daily_file)
        .map_err(|e| e.to_string())?;

    use std::io::Write;
    if header_needed {
        writeln!(file, "# {date}\n").map_err(|e| e.to_string())?;
    }
    writeln!(file, "\n---\n{entry_line}\n---").map_err(|e| e.to_string())?;
    drop(file);

    let content = std::fs::read_to_string(&daily_file).map_err(|e| e.to_string())?;
    let default_org = config.effective_org();
    let entries = nichinichi_parser::entry::parse_entry_file(&content, &date, default_org)
        .map_err(|e| e.to_string())?;

    let target = LocalSqlite::new(state.pool.clone());
    for entry in &entries {
        target.upsert_entry(entry).await.map_err(|e| e.to_string())?;
    }

    // Return the last entry (the one just added)
    entries.into_iter().last().ok_or_else(|| "failed to parse entry".to_string())
}

#[tauri::command]
pub async fn delete_entry(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let target = LocalSqlite::new(state.pool.clone());
    target.delete_entry(&id).await.map_err(|e| e.to_string())
}

// ── Goals ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_goals(
    status: Option<String>,
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Goal>, String> {
    let state = state.lock().await;
    let config = &state.config;

    // Walk goals directory and parse
    let mut goals = Vec::new();
    for subdir in &["active", "archive"] {
        let dir = config.repo.join("goals").join(subdir);
        if !dir.exists() {
            continue;
        }
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let path_str = path.to_string_lossy().to_string();
            let goal = nichinichi_parser::goal::parse_goal_file(&content, &path_str)
                .map_err(|e| format!("parse error in {path_str}: {e}"))?;
            let status_match = status.as_ref().map_or(true, |s| goal.status.to_string() == *s);
            let org_match = match (org.as_deref(), goal.org.as_deref()) {
                (None, _) => true,
                (Some("personal"), None) => true,
                (Some(o), Some(g)) => o == g,
                _ => false,
            };
            if status_match && org_match {
                goals.push(goal);
            }
        }
    }

    Ok(goals)
}

#[tauri::command]
pub async fn update_goal_step(
    app: tauri::AppHandle,
    step_id: String,
    done: bool,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;

    // Fetch the goal_id for this step so we can locate the file
    let row: Option<(String,)> =
        sqlx::query_as("SELECT goal_id FROM goal_steps WHERE id = ?")
            .bind(&step_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    let goal_id = row.ok_or("step not found")?.0;

    let file_path = find_goal_file(&state.config, &goal_id)
        .ok_or_else(|| format!("goal '{goal_id}' not found"))?;

    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let updated = toggle_step_in_file(&content, &step_id, done, &state.pool).await?;
    std::fs::write(&file_path, &updated).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&updated, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(())
}

async fn toggle_step_in_file(
    content: &str,
    step_id: &str,
    done: bool,
    pool: &sqlx::SqlitePool,
) -> Result<String, String> {
    // Fetch the step title so we can find the right line
    let row: Option<(String,)> =
        sqlx::query_as("SELECT title FROM goal_steps WHERE id = ?")
            .bind(step_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    let title = row.ok_or("step not found")?.0;

    let checkbox_done = if done { "[x]" } else { "[ ]" };
    let checkbox_other = if done { "[ ]" } else { "[x]" };

    // Replace the first checkbox line that matches the step title
    let mut replaced = false;
    let updated: Vec<String> = content
        .lines()
        .map(|line| {
            if !replaced {
                let trimmed = line.trim_start();
                if (trimmed.starts_with(&format!("- {checkbox_other} {title}"))
                    || trimmed.starts_with(&format!("- [ ] {title}"))
                    || trimmed.starts_with(&format!("- [x] {title}")))
                    && trimmed.ends_with(title.trim_end())
                {
                    replaced = true;
                    let indent = &line[..line.len() - trimmed.len()];
                    return format!("{indent}- {checkbox_done} {title}");
                }
            }
            line.to_string()
        })
        .collect();
    Ok(updated.join("\n"))
}

#[tauri::command]
pub async fn archive_goal(
    goal_id: String,
    status: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let config = &state.config;

    // Accept from either active or archive (e.g. paused → done)
    let src_path = ["active", "archive"]
        .iter()
        .map(|d| config.repo.join("goals").join(d).join(format!("{goal_id}.md")))
        .find(|p| p.exists())
        .ok_or_else(|| format!("goal '{goal_id}' not found"))?;

    let content = std::fs::read_to_string(&src_path).map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    // Replace any existing status value
    let updated = update_yaml_key(&content, "status", &status);
    let updated = if updated.contains("completion_date:") {
        updated
    } else {
        updated.replacen("---\n\n#", &format!("completion_date: {today}\n---\n\n#"), 1)
    };

    let archive_dir = config.repo.join("goals").join("archive");
    std::fs::create_dir_all(&archive_dir).map_err(|e| e.to_string())?;
    let archive_path = archive_dir.join(format!("{goal_id}.md"));
    std::fs::write(&archive_path, &updated).map_err(|e| e.to_string())?;
    if src_path != archive_path {
        std::fs::remove_file(&src_path).map_err(|e| e.to_string())?;
    }

    let path_str = archive_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&updated, &path_str).map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn reactivate_goal(
    goal_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let config = &state.config;

    let archive_path = config.repo.join("goals").join("archive").join(format!("{goal_id}.md"));
    if !archive_path.exists() {
        return Err(format!("goal '{goal_id}' not found in goals/archive/"));
    }

    let content = std::fs::read_to_string(&archive_path).map_err(|e| e.to_string())?;
    // Set status to active, remove completion_date line
    let updated = update_yaml_key(&content, "status", "active");
    let updated: String = updated
        .lines()
        .filter(|l| !l.trim_start().starts_with("completion_date:"))
        .collect::<Vec<_>>()
        .join("\n");

    let active_dir = config.repo.join("goals").join("active");
    std::fs::create_dir_all(&active_dir).map_err(|e| e.to_string())?;
    let active_path = active_dir.join(format!("{goal_id}.md"));
    std::fs::write(&active_path, &updated).map_err(|e| e.to_string())?;
    std::fs::remove_file(&archive_path).map_err(|e| e.to_string())?;

    let path_str = active_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&updated, &path_str).map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn accept_suggestion(
    suggestion_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("UPDATE goal_suggestions SET status = 'accepted' WHERE id = ?")
        .bind(&suggestion_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn dismiss_suggestion(
    suggestion_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("UPDATE goal_suggestions SET status = 'dismissed' WHERE id = ?")
        .bind(&suggestion_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Playbooks ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playbooks(
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Playbook>, String> {
    let state = state.lock().await;
    let dir = state.config.repo.join("playbooks");
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut playbooks = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();
        if let Ok(pb) = nichinichi_parser::playbook::parse_playbook_file(&content, &path_str) {
            let org_match = match (org.as_deref(), pb.org.as_deref()) {
                (None, _) => true,
                (Some("personal"), None) => true,
                (Some(o), Some(g)) => o == g,
                _ => false,
            };
            if org_match {
                playbooks.push(pb);
            }
        }
    }

    Ok(playbooks)
}

// ── Digests ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_digests(
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<nichinichi_types::Digest>, String> {
    let state = state.lock().await;
    let dir = state.config.repo.join("digests");
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut digests = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();
        if let Ok(digest) = nichinichi_parser::digest::parse_digest_file(&content, &path_str) {
            let org_match = match (org.as_deref(), digest.org.as_deref()) {
                (None, _) => true,
                (Some("personal"), None) => true,
                (Some(o), Some(g)) => o == g,
                _ => false,
            };
            if org_match {
                digests.push(digest);
            }
        }
    }

    // Sort newest first by period_end
    digests.sort_by(|a, b| b.period_end.cmp(&a.period_end));
    Ok(digests)
}

// ── Sync ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_now(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    sync_incremental(&state.pool, &state.config.repo, &state.config)
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());
    Ok(())
}

/// Full rebuild — drops all reconstructable tables and re-walks the repo.
/// Exposed in Settings UI for when the user wants a clean slate.
#[tauri::command]
pub async fn rebuild_db(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    rebuild_from_disk(&state.pool, &state.config.repo, &state.config)
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());
    Ok(())
}

#[tauri::command]
pub async fn get_last_sync(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let state = state.lock().await;
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'last_sync_at'")
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|(v,)| v).unwrap_or_else(|| "never".to_string()))
}

// ── AI ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ai_ask(
    query: String,
    history: Vec<ChatMessage>,
    org: Option<String>,
    model: Option<String>,
    window: Window,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let (pool, mut ai_config) = {
        let state = state.lock().await;
        (state.pool.clone(), state.config.ai.clone())
    };

    // Per-request model override
    if let Some(m) = model {
        ai_config.model = m;
    }

    let org_scope = match org.as_deref() {
        None => OrgScope::All,
        Some("personal") => OrgScope::Personal,
        Some(o) => OrgScope::Org(o.to_string()),
    };

    let context = search_entries(&pool, &query, &org_scope, 20)
        .await
        .map_err(|e| e.to_string())?;

    let client = AiClient::new(ai_config);
    let window_clone = window.clone();

    let response = client
        .ask(&query, &context, &history, move |chunk| {
            let _ = window_clone.emit("ai-chunk", &chunk);
        })
        .await
        .map_err(|e| e.to_string())?;

    window.emit("ai-done", &response).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_conversation_cmd(
    app: tauri::AppHandle,
    messages: Vec<ChatMessage>,
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let repo = {
        let state = state.lock().await;
        state.config.repo.clone()
    };
    save_conversation(&repo, &messages, org.as_deref(), None)
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.emit("ai-saved", ());
    Ok(())
}

#[tauri::command]
pub async fn get_ai_conversations(
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<nichinichi_types::AiConversation>, String> {
    let repo = {
        let state = state.lock().await;
        state.config.repo.clone()
    };
    list_conversations(&repo, org.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_ai_conversation_cmd(
    file_path: String,
) -> Result<Vec<ChatMessage>, String> {
    let path = std::path::PathBuf::from(&file_path);
    load_conversation(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_ai_conversation_cmd(file_path: String) -> Result<(), String> {
    tokio::fs::remove_file(&file_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_ai_conversation_cmd(file_path: String) -> Result<(), String> {
    let src = std::path::PathBuf::from(&file_path);
    let filename = src.file_name().ok_or("invalid path")?;
    let archive_dir = src.parent().ok_or("no parent dir")?.join("archive");
    tokio::fs::create_dir_all(&archive_dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio::fs::rename(&src, archive_dir.join(filename))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retitle_ai_conversation_cmd(
    file_path: String,
    title: String,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(&file_path);
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let updated = replace_yaml_field(&content, "query", &title);
    tokio::fs::write(&path, updated)
        .await
        .map_err(|e| e.to_string())
}

// ── Stats ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct StatsPayload {
    pub total_entries: i64,
    pub entries_by_type: HashMap<String, i64>,
    pub streak: i64,
    pub heatmap: Vec<HeatmapCell>,
}

#[derive(Serialize)]
pub struct HeatmapCell {
    pub date: String,
    pub count: i64,
}

#[tauri::command]
pub async fn get_stats(
    org: Option<String>,
    days: Option<u32>,
    state: State<'_, Mutex<AppState>>,
) -> Result<StatsPayload, String> {
    let state = state.lock().await;
    let pool = &state.pool;
    let days = days.unwrap_or(90) as i64;

    let org_clause = if let Some(ref o) = org {
        format!("AND org = '{}'", o.replace('\'', "''"))
    } else {
        String::new()
    };

    // Total entries
    let total: (i64,) = sqlx::query_as::<_, (i64,)>(&format!(
        "SELECT COUNT(*) FROM entries WHERE date >= date('now', '-{days} days') {org_clause}"
    ))
    .fetch_one(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    // By type
    let type_rows: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(&format!(
        "SELECT type, COUNT(*) FROM entries
         WHERE date >= date('now', '-{days} days') {org_clause}
         GROUP BY type"
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let entries_by_type: HashMap<String, i64> = type_rows.into_iter().collect();

    // Heatmap (daily counts)
    let heatmap_rows: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(&format!(
        "SELECT date, COUNT(*) FROM entries
         WHERE date >= date('now', '-{days} days') {org_clause}
         GROUP BY date ORDER BY date"
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let heatmap = heatmap_rows
        .into_iter()
        .map(|(date, count)| HeatmapCell { date, count })
        .collect();

    // Streak: consecutive days with entries up to today
    let streak_rows: Vec<(String,)> =
        sqlx::query_as::<_, (String,)>("SELECT DISTINCT date FROM entries ORDER BY date DESC LIMIT 365")
            .fetch_all(pool)
            .await
            .map_err(|e: sqlx::Error| e.to_string())?;

    let streak = compute_streak(streak_rows.iter().map(|(d,): &(String,)| d.as_str()));

    Ok(StatsPayload {
        total_entries: total.0,
        entries_by_type,
        streak,
        heatmap,
    })
}

fn compute_streak<'a>(dates: impl Iterator<Item = &'a str>) -> i64 {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut streak = 0i64;
    let mut expected = today;

    for date in dates {
        if date == expected {
            streak += 1;
            // Decrement expected date by one day
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
                expected = (d - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
            }
        } else {
            break;
        }
    }

    streak
}

// ── Activity ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct WeekBucket {
    pub week_start: String,
    pub label: String,
    pub entries: HashMap<String, i64>,
}

#[derive(Serialize)]
pub struct DayBucket {
    pub date: String,
    pub entries: HashMap<String, i64>,
}

#[derive(Serialize)]
pub struct MonthBucket {
    pub month: String,
    pub label: String,
    pub entries: HashMap<String, i64>,
}

#[derive(Serialize)]
pub struct ActivityPayload {
    pub week_days: Vec<WeekBucket>,
    pub weekly: Vec<WeekBucket>,
    pub monthly: Vec<DayBucket>,
    pub yearly: Vec<MonthBucket>,
}

#[tauri::command]
pub async fn get_activity(
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ActivityPayload, String> {
    use chrono::{Datelike, Duration, Local, NaiveDate};

    let state = state.lock().await;
    let pool = &state.pool;

    let org_clause = match &org {
        Some(o) => format!(" AND org = '{}'", o.replace('\'', "''")),
        None => String::new(),
    };

    // ── Weekly (last 9 weeks) ─────────────────────────────────────────────
    // Compute the Monday of the current week, then go back 8 more weeks
    let today = Local::now().date_naive();
    let days_since_monday = today.weekday().num_days_from_monday() as i64;
    let this_monday = today - Duration::days(days_since_monday);

    // Build 9 MonNday slots (oldest first)
    let mut week_starts: Vec<NaiveDate> = (0..9)
        .rev()
        .map(|i| this_monday - Duration::weeks(i))
        .collect();
    week_starts.sort();

    let week_rows: Vec<(String, String, i64)> = sqlx::query_as::<_, (String, String, i64)>(&format!(
        "SELECT date(date, '-' || cast(((cast(strftime('%w', date) as integer) + 6) % 7) as text) || ' days') as week_start, \
         type, COUNT(*) as cnt \
         FROM entries \
         WHERE date >= date('now', '-62 days'){org_clause} \
         GROUP BY week_start, type ORDER BY week_start"
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    // Group by week_start
    let mut week_map: HashMap<String, HashMap<String, i64>> = HashMap::new();
    for (ws, t, cnt) in week_rows {
        week_map.entry(ws).or_default().insert(t, cnt);
    }

    let month_abbrs = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let weekly: Vec<WeekBucket> = week_starts
        .iter()
        .map(|d| {
            let key = d.format("%Y-%m-%d").to_string();
            let mo = (d.month0() as usize).min(11);
            let label = format!("{} {}", month_abbrs[mo], d.day());
            WeekBucket {
                week_start: key.clone(),
                label,
                entries: week_map.remove(&key).unwrap_or_default(),
            }
        })
        .collect();

    // ── Monthly (current month, all days) ────────────────────────────────
    let year = today.year();
    let month = today.month();
    let days_in_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .map(|d| (d - NaiveDate::from_ymd_opt(year, month, 1).unwrap()).num_days())
    .unwrap_or(30);

    let month_rows: Vec<(String, String, i64)> = sqlx::query_as::<_, (String, String, i64)>(&format!(
        "SELECT date, type, COUNT(*) as cnt FROM entries \
         WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now'){org_clause} \
         GROUP BY date, type ORDER BY date"
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let mut month_day_map: HashMap<String, HashMap<String, i64>> = HashMap::new();
    for (d, t, cnt) in month_rows {
        month_day_map.entry(d).or_default().insert(t, cnt);
    }

    let monthly: Vec<DayBucket> = (1..=days_in_month)
        .map(|day| {
            let date = format!("{year}-{month:02}-{day:02}");
            DayBucket {
                entries: month_day_map.remove(&date).unwrap_or_default(),
                date,
            }
        })
        .collect();

    // ── Yearly (current year, all months) ────────────────────────────────
    let year_rows: Vec<(String, String, i64)> = sqlx::query_as::<_, (String, String, i64)>(&format!(
        "SELECT strftime('%Y-%m', date) as month, type, COUNT(*) as cnt \
         FROM entries WHERE strftime('%Y', date) = strftime('%Y', 'now'){org_clause} \
         GROUP BY month, type ORDER BY month"
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let mut year_map: HashMap<String, HashMap<String, i64>> = HashMap::new();
    for (m, t, cnt) in year_rows {
        year_map.entry(m).or_default().insert(t, cnt);
    }

    let yearly: Vec<MonthBucket> = (1..=12)
        .map(|m| {
            let month_key = format!("{year}-{m:02}");
            MonthBucket {
                label: month_abbrs[(m - 1) as usize].to_string(),
                entries: year_map.remove(&month_key).unwrap_or_default(),
                month: month_key,
            }
        })
        .collect();


    // ── Week days (Mon–Sun of current week) ──────────────────────────────
    let sunday = this_monday + Duration::days(6);
    let week_day_rows: Vec<(String, String, i64)> = sqlx::query_as::<_, (String, String, i64)>(&format!(
        "SELECT date, type, COUNT(*) as cnt FROM entries \
         WHERE date >= '{}' AND date <= '{}'{org_clause} \
         GROUP BY date, type ORDER BY date",
        this_monday.format("%Y-%m-%d"),
        sunday.format("%Y-%m-%d")
    ))
    .fetch_all(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    let mut week_day_map: HashMap<String, HashMap<String, i64>> = HashMap::new();
    for (d, t, cnt) in week_day_rows {
        week_day_map.entry(d).or_default().insert(t, cnt);
    }

    let day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let week_days: Vec<WeekBucket> = (0..7i64)
        .map(|i| {
            let date = this_monday + Duration::days(i);
            let key = date.format("%Y-%m-%d").to_string();
            WeekBucket {
                week_start: key.clone(),
                label: day_names[i as usize].to_string(),
                entries: week_day_map.remove(&key).unwrap_or_default(),
            }
        })
        .collect();

    Ok(ActivityPayload { weekly, monthly, yearly, week_days })
}

// ── Settings ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_settings(
    state: State<'_, Mutex<AppState>>,
) -> Result<HashMap<String, String>, String> {
    let state = state.lock().await;
    let rows: Vec<(String, String)> = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(&state.pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(rows.into_iter().collect())
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&value)
        .execute(&state.pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_key(
    api_key: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut state = state.lock().await;

    // Update in-memory config
    state.config.ai.api_key = api_key.clone();

    // Write to ~/.nichinichi.yml
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let config_path = home.join(".nichinichi.yml");
    let content = if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?
    } else {
        format!(
            "repo: ~/nichinichi\nai:\n  base_url: https://api.anthropic.com\n  api_key: \"\"\n  model: claude-sonnet-4-5\n"
        )
    };

    // Replace the api_key line
    let updated = if content.contains("api_key:") {
        let mut lines: Vec<String> = content.lines().map(String::from).collect();
        for line in &mut lines {
            if line.trim_start().starts_with("api_key:") {
                let indent = line.len() - line.trim_start().len();
                *line = format!("{}api_key: \"{}\"", " ".repeat(indent), api_key);
                break;
            }
        }
        lines.join("\n")
    } else {
        content + &format!("\n  api_key: \"{api_key}\"")
    };

    std::fs::write(&config_path, updated).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_config(
    api_key: String,
    base_url: String,
    model: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut state = state.lock().await;

    // Update in-memory config
    state.config.ai.api_key = api_key.clone();
    state.config.ai.base_url = base_url.clone();
    state.config.ai.model = model.clone();

    // Write to ~/.nichinichi.yml
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let config_path = home.join(".nichinichi.yml");
    let content = if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?
    } else {
        "repo: ~/nichinichi\nai:\n  base_url: \"\"\n  api_key: \"\"\n  model: \"\"\n".to_string()
    };

    let updated = replace_yaml_field(&content, "api_key", &api_key);
    let updated = replace_yaml_field(&updated, "base_url", &base_url);
    let updated = replace_yaml_field(&updated, "model", &model);

    std::fs::write(&config_path, updated).map_err(|e| e.to_string())?;
    Ok(())
}

/// Replace a YAML field value in-place, preserving indentation.
fn replace_yaml_field(content: &str, key: &str, value: &str) -> String {
    let needle = format!("{}:", key);
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let mut found = false;
    for line in &mut lines {
        if line.trim_start().starts_with(&needle) {
            let indent = line.len() - line.trim_start().len();
            *line = format!("{}{}: \"{}\"", " ".repeat(indent), key, value);
            found = true;
            break;
        }
    }
    if !found {
        lines.push(format!("  {}: \"{}\"", key, value));
    }
    lines.join("\n")
}

// ── Config repo path ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_config_repo(
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let state = state.lock().await;
    Ok(state.config.repo.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn get_ai_config(
    state: State<'_, Mutex<AppState>>,
) -> Result<serde_json::Value, String> {
    let state = state.lock().await;
    Ok(serde_json::json!({
        "base_url": state.config.ai.base_url,
        "model": state.config.ai.model,
    }))
}

#[tauri::command]
pub async fn get_models(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    let ai_config = {
        let state = state.lock().await;
        state.config.ai.clone()
    };
    let client = AiClient::new(ai_config);
    client.list_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config_repo(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut state = state.lock().await;

    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let config_path = home.join(".nichinichi.yml");
    let content = if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?
    } else {
        format!(
            "repo: ~/nichinichi\nai:\n  base_url: https://api.anthropic.com\n  api_key: \"\"\n  model: claude-sonnet-4-5\n"
        )
    };

    let updated = if content.contains("repo:") {
        let mut lines: Vec<String> = content.lines().map(String::from).collect();
        for line in &mut lines {
            if line.trim_start().starts_with("repo:") {
                *line = format!("repo: {path}");
                break;
            }
        }
        lines.join("\n")
    } else {
        format!("repo: {path}\n") + &content
    };

    std::fs::write(&config_path, updated).map_err(|e| e.to_string())?;

    // Update in-memory config
    state.config.repo = std::path::PathBuf::from(path.replace("~/", &format!("{}/", home.display())));

    Ok(())
}

// ── Goal metadata editing ──────────────────────────────────────────────────

#[tauri::command]
pub async fn update_goal_meta(
    app: tauri::AppHandle,
    goal_id: String,
    title: String,
    goal_type: Option<String>,
    horizon: Option<String>,
    why: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Goal, String> {
    let state = state.lock().await;
    let config = &state.config;

    // Find the goal file by scanning goals directories
    let file_path = find_goal_file(config, &goal_id)
        .ok_or_else(|| format!("goal '{goal_id}' not found"))?;

    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    let updated = update_yaml_key(&content, "type", goal_type.as_deref().unwrap_or(""));
    let updated = update_yaml_key(&updated, "horizon", horizon.as_deref().unwrap_or(""));
    let updated = update_yaml_key(&updated, "why", why.as_deref().unwrap_or(""));
    let updated = update_h1_title(&updated, &title);

    std::fs::write(&file_path, &updated).map_err(|e| e.to_string())?;

    // Re-sync from the updated file
    let target = LocalSqlite::new(state.pool.clone());
    let path_str = file_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&updated, &path_str)
        .map_err(|e| e.to_string())?;
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(goal)
}

fn find_goal_file(config: &nichinichi_types::Config, goal_id: &str) -> Option<std::path::PathBuf> {
    for subdir in &["active", "archive"] {
        let p = config.repo.join("goals").join(subdir).join(format!("{goal_id}.md"));
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn update_yaml_key(content: &str, key: &str, value: &str) -> String {
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let mut found = false;
    for line in &mut lines {
        let trimmed = line.trim_start();
        if trimmed.starts_with(&format!("{key}:")) {
            if value.is_empty() {
                *line = format!("{}:", key);
            } else {
                *line = format!("{key}: {value}");
            }
            found = true;
            break;
        }
    }
    if !found && !value.is_empty() {
        // Insert before closing --- of frontmatter
        let mut in_fm = false;
        let mut inserted = false;
        let mut result = Vec::new();
        for line in lines {
            if line == "---" {
                if !in_fm {
                    in_fm = true;
                    result.push(line);
                } else if !inserted {
                    result.push(format!("{key}: {value}"));
                    result.push(line);
                    inserted = true;
                } else {
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        }
        return result.join("\n");
    }
    lines.join("\n")
}

fn update_h1_title(content: &str, title: &str) -> String {
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    for line in &mut lines {
        if line.starts_with("# ") && !line.starts_with("## ") {
            *line = format!("# {title}");
            break;
        }
    }
    lines.join("\n")
}

// ── Goal content editing (steps + progress) ────────────────────────────────

#[derive(serde::Deserialize)]
pub struct StepInput {
    pub title: String,
    pub done: bool,
    pub notes: Option<String>,
    pub due_date: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct ProgressInput {
    pub date: String,
    pub signal: String,
    pub note: Option<String>,
    #[serde(default)]
    pub refs: Vec<String>,
}

#[tauri::command]
pub async fn save_goal_content(
    app: tauri::AppHandle,
    goal_id: String,
    steps: Vec<StepInput>,
    progress: Vec<ProgressInput>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Goal, String> {
    let state = state.lock().await;
    let config = &state.config;

    let file_path = find_goal_file(config, &goal_id)
        .ok_or_else(|| format!("goal '{goal_id}' not found"))?;

    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let updated = replace_steps_section(&content, &steps);
    let updated = replace_progress_section(&updated, &progress);

    std::fs::write(&file_path, &updated).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&updated, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(goal)
}

fn replace_steps_section(content: &str, steps: &[StepInput]) -> String {
    let lines: Vec<&str> = content.lines().collect();

    // Find the ## steps heading
    let steps_start = lines.iter().position(|l| l.trim() == "## steps");
    let Some(steps_start) = steps_start else {
        // No steps section — append one before ## progress or at end
        let progress_pos = lines.iter().position(|l| l.trim() == "## progress");
        let insert_at = progress_pos.unwrap_or(lines.len());
        let mut result: Vec<String> = lines[..insert_at].iter().map(|l| l.to_string()).collect();
        result.push(String::new());
        result.push("## steps".to_string());
        result.push(String::new());
        for step in steps {
            serialize_step_into(&mut result, step);
        }
        result.push(String::new());
        for l in &lines[insert_at..] {
            result.push(l.to_string());
        }
        return result.join("\n");
    };

    // Find end of steps section (next ## heading or EOF)
    let steps_end = lines[steps_start + 1..]
        .iter()
        .position(|l| l.starts_with("## "))
        .map(|i| steps_start + 1 + i)
        .unwrap_or(lines.len());

    let mut result: Vec<String> = lines[..steps_start].iter().map(|l| l.to_string()).collect();
    result.push("## steps".to_string());
    result.push(String::new());
    for step in steps {
        serialize_step_into(&mut result, step);
    }
    if steps_end < lines.len() {
        result.push(String::new());
        for l in &lines[steps_end..] {
            result.push(l.to_string());
        }
    }
    result.join("\n")
}

fn serialize_step_into(out: &mut Vec<String>, step: &StepInput) {
    let checkbox = if step.done { "[x]" } else { "[ ]" };
    out.push(format!("- {checkbox} {}", step.title));
    if let Some(notes) = &step.notes {
        if !notes.is_empty() {
            out.push(format!("      notes: {notes}"));
        }
    }
    if let Some(due) = &step.due_date {
        if !due.is_empty() {
            out.push(format!("      due: {due}"));
        }
    }
}

fn replace_progress_section(content: &str, progress: &[ProgressInput]) -> String {
    let lines: Vec<&str> = content.lines().collect();

    let progress_start = lines.iter().position(|l| l.trim() == "## progress");

    let mut result: Vec<String>;
    if let Some(ps) = progress_start {
        result = lines[..ps].iter().map(|l| l.to_string()).collect();
    } else {
        result = lines.iter().map(|l| l.to_string()).collect();
        // Trim trailing blank lines before appending
        while result.last().map(|l: &String| l.is_empty()) == Some(true) {
            result.pop();
        }
    }

    if !progress.is_empty() {
        result.push(String::new());
        result.push("## progress".to_string());
        result.push(String::new());
        for (i, entry) in progress.iter().enumerate() {
            result.push(format!("### {}", entry.date));
            result.push(format!("signal: {}", entry.signal));
            if let Some(note) = &entry.note {
                if !note.is_empty() {
                    result.push(format!("note: {note}"));
                }
            }
            if !entry.refs.is_empty() {
                result.push(format!("refs: [{}]", entry.refs.join(", ")));
            }
            if i + 1 < progress.len() {
                result.push(String::new());
            }
        }
    }

    // Ensure file ends with a single newline
    let mut s = result.join("\n");
    if !s.ends_with('\n') {
        s.push('\n');
    }
    s
}

// ── Playbook editing ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn save_playbook(
    app: tauri::AppHandle,
    id: String,
    title: String,
    tags: Vec<String>,
    content: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Playbook, String> {
    let state = state.lock().await;
    let config = &state.config;

    // Find the playbook file
    let pb_dir = config.repo.join("playbooks");
    let file_path = pb_dir.join(format!("{id}.md"));
    if !file_path.exists() {
        return Err(format!("playbook '{id}' not found"));
    }

    // Read existing file to preserve org/forked_from/created metadata
    let existing = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let path_str = file_path.to_string_lossy().to_string();
    let old_pb = nichinichi_parser::playbook::parse_playbook_file(&existing, &path_str)
        .map_err(|e| e.to_string())?;

    let tags_str = tags.join(", ");
    let org_val = old_pb.org.as_deref().unwrap_or("null");
    let fork_val = old_pb.forked_from.as_deref().unwrap_or("null");
    let created_val = old_pb.created_at.as_deref().unwrap_or("");

    let new_file = format!(
        "---\ntitle: {title}\ntags: [{tags_str}]\nforked_from: {fork_val}\norg: {org_val}\ncreated: {created_val}\n---\n\n{content}\n"
    );

    std::fs::write(&file_path, &new_file).map_err(|e| e.to_string())?;

    let target = LocalSqlite::new(state.pool.clone());
    let pb = nichinichi_parser::playbook::parse_playbook_file(&new_file, &path_str)
        .map_err(|e| e.to_string())?;
    target.upsert_playbook(&pb).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(pb)
}


#[tauri::command]
pub async fn create_playbook(
    app: tauri::AppHandle,
    title: String,
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Playbook, String> {
    let state = state.lock().await;
    let config = &state.config;
    let pb_dir = config.repo.join("playbooks");

    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = if slug.is_empty() { "untitled".to_string() } else { slug };

    let mut file_path = pb_dir.join(format!("{slug}.md"));
    let mut counter = 1u32;
    while file_path.exists() {
        file_path = pb_dir.join(format!("{slug}-{counter}.md"));
        counter += 1;
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let org_val = org.as_deref().unwrap_or("null");
    let content = format!(
        "---\ntitle: {title}\ntags: []\nforked_from: null\norg: {org_val}\ncreated: {today}\n---\n\n## steps\n\n"
    );

    std::fs::create_dir_all(&pb_dir).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let pb = nichinichi_parser::playbook::parse_playbook_file(&content, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_playbook(&pb).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(pb)
}

#[tauri::command]
pub async fn delete_playbook(
    app: tauri::AppHandle,
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let config = &state.config;
    let file_path = config.repo.join("playbooks").join(format!("{id}.md"));

    if file_path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }

    sqlx::query("DELETE FROM playbooks WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(())
}

// ── AI creation helpers ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_goal_from_ai(
    app: tauri::AppHandle,
    title: String,
    goal_type: String,
    org: Option<String>,
    horizon: Option<String>,
    why: Option<String>,
    steps: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Goal, String> {
    let state = state.lock().await;
    let config = &state.config;

    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = if slug.is_empty() { "untitled".to_string() } else { slug };

    let active_dir = config.repo.join("goals").join("active");
    std::fs::create_dir_all(&active_dir).map_err(|e| e.to_string())?;

    let mut file_path = active_dir.join(format!("{slug}.md"));
    let mut counter = 1u32;
    while file_path.exists() {
        file_path = active_dir.join(format!("{slug}-{counter}.md"));
        counter += 1;
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let org_val = org.as_deref().unwrap_or("null");
    let horizon_val = horizon.as_deref().unwrap_or("null");
    let why_val = why.as_deref().unwrap_or("");
    let steps_md = steps.iter().map(|s| format!("- [ ] {s}")).collect::<Vec<_>>().join("\n");

    let content = format!(
        "---\ntype: {goal_type}\norg: {org_val}\nhorizon: {horizon_val}\nstatus: active\nwhy: {why_val}\ncreated: {today}\n---\n\n# {title}\n\n## steps\n\n{steps_md}\n\n## progress\n\n"
    );

    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let goal = nichinichi_parser::goal::parse_goal_file(&content, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_goal(&goal).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(goal)
}

#[tauri::command]
pub async fn create_playbook_from_ai(
    app: tauri::AppHandle,
    title: String,
    tags: Vec<String>,
    org: Option<String>,
    content: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Playbook, String> {
    let state = state.lock().await;
    let config = &state.config;

    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = if slug.is_empty() { "untitled".to_string() } else { slug };

    let pb_dir = config.repo.join("playbooks");
    std::fs::create_dir_all(&pb_dir).map_err(|e| e.to_string())?;

    let mut file_path = pb_dir.join(format!("{slug}.md"));
    let mut counter = 1u32;
    while file_path.exists() {
        file_path = pb_dir.join(format!("{slug}-{counter}.md"));
        counter += 1;
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let org_val = org.as_deref().unwrap_or("null");
    let tags_str = tags.join(", ");

    let file_content = format!(
        "---\ntitle: {title}\ntags: [{tags_str}]\nforked_from: null\norg: {org_val}\ncreated: {today}\n---\n\n## steps\n\n{content}\n"
    );

    std::fs::write(&file_path, &file_content).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let pb = nichinichi_parser::playbook::parse_playbook_file(&file_content, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_playbook(&pb).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(pb)
}

#[tauri::command]
pub async fn save_digest_from_ai(
    app: tauri::AppHandle,
    digest_type: String,
    period_start: String,
    period_end: String,
    org: Option<String>,
    content: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Digest, String> {
    let state = state.lock().await;
    let config = &state.config;

    let digests_dir = config.repo.join("digests");
    std::fs::create_dir_all(&digests_dir).map_err(|e| e.to_string())?;

    let mut file_path = digests_dir.join(format!("{period_end}-{digest_type}.md"));
    let mut counter = 1u32;
    while file_path.exists() {
        file_path = digests_dir.join(format!("{period_end}-{digest_type}-{counter}.md"));
        counter += 1;
    }

    let generated = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let org_val = org.as_deref().unwrap_or("null");

    let file_content = format!(
        "---\ntype: {digest_type}\nperiod_start: {period_start}\nperiod_end: {period_end}\nentries: 0\norg: {org_val}\ngenerated: {generated}\n---\n\n{content}\n"
    );

    std::fs::write(&file_path, &file_content).map_err(|e| e.to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let digest = nichinichi_parser::digest::parse_digest_file(&file_content, &path_str)
        .map_err(|e| e.to_string())?;
    let target = LocalSqlite::new(state.pool.clone());
    target.upsert_digest(&digest).await.map_err(|e| e.to_string())?;
    let _ = app.emit("sync-update", ());

    Ok(digest)
}

// ── Orgs ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_orgs(state: State<'_, Mutex<AppState>>) -> Result<Vec<String>, String> {
    let state = state.lock().await;
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT org FROM entries WHERE org IS NOT NULL ORDER BY org",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|(o,)| o).collect())
}

// ── Helpers ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct EntryRow {
    id: String,
    date: String,
    time: String,
    body: String,
    detail: Option<String>,
    #[sqlx(rename = "type")]
    entry_type: String,
    tags: String,
    project: Option<String>,
    org: Option<String>,
    approximate: i64,
    raw_line: String,
}

// ── Setup status ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SetupStatus {
    pub has_ai_config: bool,
    pub has_entries: bool,
    pub repo_path: String,
}

#[tauri::command]
pub async fn get_setup_status(
    state: State<'_, Mutex<AppState>>,
) -> Result<SetupStatus, String> {
    let state = state.lock().await;

    let has_ai_config = !state.config.ai.api_key.is_empty();

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM entries")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    let has_entries = count.0 > 0;

    let repo_path = state.config.repo.to_string_lossy().to_string();

    Ok(SetupStatus { has_ai_config, has_entries, repo_path })
}

fn row_to_entry(row: EntryRow) -> ParsedEntry {
    use nichinichi_types::EntryType;
    let entry_type = row.entry_type.parse::<EntryType>().unwrap_or(EntryType::Log);
    let tags: Vec<String> = serde_json::from_str(&row.tags).unwrap_or_default();
    ParsedEntry {
        id: row.id,
        date: row.date,
        time: row.time,
        body: row.body,
        detail: row.detail,
        entry_type,
        tags,
        project: row.project,
        org: row.org,
        approximate: row.approximate != 0,
        raw_line: row.raw_line,
    }
}
