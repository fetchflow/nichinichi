use devlog_ai::{save_conversation, search_entries, AiClient};
use devlog_sync::{LocalSqlite, SyncTarget};
use devlog_types::{Config, Goal, OrgScope, ParsedEntry, Playbook};
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
    let entries = devlog_parser::entry::parse_entry_file(&content, &date, default_org)
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
            if let Ok(goal) = devlog_parser::goal::parse_goal_file(&content, &path_str) {
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
    }

    Ok(goals)
}

#[tauri::command]
pub async fn update_goal_step(
    step_id: String,
    done: bool,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let status = if done { "done" } else { "not_started" };
    sqlx::query("UPDATE goal_steps SET status = ? WHERE id = ?")
        .bind(status)
        .bind(&step_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn archive_goal(
    goal_id: String,
    status: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().await;
    let config = &state.config;

    let active_path = config.repo.join("goals").join("active").join(format!("{goal_id}.md"));
    if !active_path.exists() {
        return Err(format!("goal '{}' not found in goals/active/", goal_id));
    }

    let content = std::fs::read_to_string(&active_path).map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let updated = content
        .replacen("status: active", &format!("status: {status}"), 1)
        .replacen("status: paused", &format!("status: {status}"), 1);
    let updated = if updated.contains("completion_date:") {
        updated
    } else {
        updated.replacen("---\n\n#", &format!("completion_date: {today}\n---\n\n#"), 1)
    };

    let archive_dir = config.repo.join("goals").join("archive");
    std::fs::create_dir_all(&archive_dir).map_err(|e| e.to_string())?;
    let archive_path = archive_dir.join(format!("{goal_id}.md"));
    std::fs::write(&archive_path, &updated).map_err(|e| e.to_string())?;
    std::fs::remove_file(&active_path).map_err(|e| e.to_string())?;

    let path_str = archive_path.to_string_lossy().to_string();
    let goal = devlog_parser::goal::parse_goal_file(&updated, &path_str).map_err(|e| e.to_string())?;
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
        if let Ok(pb) = devlog_parser::playbook::parse_playbook_file(&content, &path_str) {
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
) -> Result<Vec<devlog_types::Digest>, String> {
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
        if let Ok(digest) = devlog_parser::digest::parse_digest_file(&content, &path_str) {
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
pub async fn sync_now(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().await;
    let target = LocalSqlite::new(state.pool.clone());
    target
        .rebuild(&state.config.repo, &state.config)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_at', datetime('now'))")
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn rebuild_db(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    sync_now(state).await
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
    org: Option<String>,
    window: Window,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let (pool, config) = {
        let state = state.lock().await;
        (state.pool.clone(), state.config.clone())
    };

    let org_scope = match org.as_deref() {
        None => OrgScope::All,
        Some("personal") => OrgScope::Personal,
        Some(o) => OrgScope::Org(o.to_string()),
    };

    let context = search_entries(&pool, &query, &org_scope, 20)
        .await
        .map_err(|e| e.to_string())?;

    let client = AiClient::new(config.ai.clone());
    let window_clone = window.clone();

    let response = client
        .ask(&query, &context, move |chunk| {
            let _ = window_clone.emit("ai-chunk", &chunk);
        })
        .await
        .map_err(|e| e.to_string())?;

    window.emit("ai-done", &response).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_conversation_cmd(
    query: String,
    response: String,
    org: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let repo = {
        let state = state.lock().await;
        state.config.repo.clone()
    };
    save_conversation(&repo, &query, &response, org.as_deref(), None)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
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

    Ok(ActivityPayload { weekly, monthly, yearly })
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

    // Write to ~/.devlog.yml
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let config_path = home.join(".devlog.yml");
    let content = if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?
    } else {
        format!(
            "repo: ~/devlog\nai:\n  base_url: https://api.anthropic.com\n  api_key: \"\"\n  model: claude-sonnet-4-5\n"
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

fn row_to_entry(row: EntryRow) -> ParsedEntry {
    use devlog_types::EntryType;
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
