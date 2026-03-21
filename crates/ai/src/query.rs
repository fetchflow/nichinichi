use crate::AiError;
use devlog_types::{EntryType, OrgScope, ParsedEntry};
use sqlx::SqlitePool;

/// Search entries using SQLite FTS5 and return results ranked by relevance.
pub async fn search_entries(
    pool: &SqlitePool,
    query: &str,
    org: &OrgScope,
    limit: usize,
) -> Result<Vec<ParsedEntry>, AiError> {
    let fts_query = build_fts_query(query);

    let rows = match org {
        OrgScope::All => {
            sqlx::query_as::<_, EntryRow>(
                r#"
                SELECT e.id, e.date, e.time, e.body, e.detail, e.type,
                       e.tags, e.project, e.org, e.approximate, e.raw_line
                FROM entries e
                JOIN entries_fts ON entries_fts.rowid = e.rowid
                WHERE entries_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                "#,
            )
            .bind(&fts_query)
            .bind(limit as i64)
            .fetch_all(pool)
            .await?
        }
        OrgScope::Personal => {
            sqlx::query_as::<_, EntryRow>(
                r#"
                SELECT e.id, e.date, e.time, e.body, e.detail, e.type,
                       e.tags, e.project, e.org, e.approximate, e.raw_line
                FROM entries e
                JOIN entries_fts ON entries_fts.rowid = e.rowid
                WHERE entries_fts MATCH ?
                  AND (e.org IS NULL OR e.org = 'personal')
                ORDER BY rank
                LIMIT ?
                "#,
            )
            .bind(&fts_query)
            .bind(limit as i64)
            .fetch_all(pool)
            .await?
        }
        OrgScope::Org(org_name) => {
            sqlx::query_as::<_, EntryRow>(
                r#"
                SELECT e.id, e.date, e.time, e.body, e.detail, e.type,
                       e.tags, e.project, e.org, e.approximate, e.raw_line
                FROM entries e
                JOIN entries_fts ON entries_fts.rowid = e.rowid
                WHERE entries_fts MATCH ?
                  AND e.org = ?
                ORDER BY rank
                LIMIT ?
                "#,
            )
            .bind(&fts_query)
            .bind(org_name)
            .bind(limit as i64)
            .fetch_all(pool)
            .await?
        }
    };

    Ok(rows.into_iter().map(row_to_entry).collect())
}

/// Build a safe FTS5 MATCH query from free-form user input.
/// Wraps the query in double quotes to treat it as a phrase, with fallback
/// to individual terms if the query contains no special chars.
fn build_fts_query(q: &str) -> String {
    // Strip FTS5 special characters to avoid injection
    let sanitised: String = q
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-' || *c == '_')
        .collect();
    let trimmed = sanitised.trim();
    if trimmed.is_empty() {
        return "*".to_string();
    }
    // Build OR query across all terms
    trimmed
        .split_whitespace()
        .map(|w| w.to_string())
        .collect::<Vec<_>>()
        .join(" OR ")
}

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
