use async_trait::async_trait;
use devlog_types::{AiConversation, Config, Digest, Goal, ParsedEntry, Playbook};
use serde_json;
use sqlx::SqlitePool;

use crate::{rebuild::rebuild_from_disk, sync_target::SyncTarget, SyncError};

pub struct LocalSqlite {
    pub pool: SqlitePool,
}

impl LocalSqlite {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SyncTarget for LocalSqlite {
    async fn upsert_entry(&self, e: &ParsedEntry) -> Result<(), SyncError> {
        let tags = serde_json::to_string(&e.tags).unwrap_or_else(|_| "[]".into());
        let approx: i64 = if e.approximate { 1 } else { 0 };
        let entry_type = e.entry_type.as_str().to_string();

        sqlx::query(
            r#"
            INSERT INTO entries
                (id, date, time, body, detail, type, tags, project, org, approximate, raw_line, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sync', datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                body        = excluded.body,
                detail      = excluded.detail,
                type        = excluded.type,
                tags        = excluded.tags,
                project     = excluded.project,
                org         = excluded.org,
                approximate = excluded.approximate,
                raw_line    = excluded.raw_line,
                updated_at  = datetime('now')
            "#,
        )
        .bind(&e.id)
        .bind(&e.date)
        .bind(&e.time)
        .bind(&e.body)
        .bind(&e.detail)
        .bind(entry_type)
        .bind(tags)
        .bind(&e.project)
        .bind(&e.org)
        .bind(approx)
        .bind(&e.raw_line)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_goal(&self, goal: &Goal) -> Result<(), SyncError> {
        let goal_type = goal.goal_type.as_ref().map(|t| t.to_string());
        let status = goal.status.to_string();

        sqlx::query(
            r#"
            INSERT INTO goals (id, title, type, horizon, status, why, org, file_path, completion_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                title           = excluded.title,
                type            = excluded.type,
                horizon         = excluded.horizon,
                status          = excluded.status,
                why             = excluded.why,
                org             = excluded.org,
                file_path       = excluded.file_path,
                completion_date = excluded.completion_date,
                updated_at      = datetime('now')
            "#,
        )
        .bind(&goal.id)
        .bind(&goal.title)
        .bind(goal_type)
        .bind(&goal.horizon)
        .bind(status)
        .bind(&goal.why)
        .bind(&goal.org)
        .bind(&goal.file_path)
        .bind(&goal.completion_date)
        .bind(&goal.created_at)
        .execute(&self.pool)
        .await?;

        // Delete existing steps and progress, then re-insert
        sqlx::query("DELETE FROM goal_steps WHERE goal_id = ?")
            .bind(&goal.id)
            .execute(&self.pool)
            .await?;

        for step in &goal.steps {
            let step_status = step.status.to_string();
            sqlx::query(
                "INSERT INTO goal_steps (id, goal_id, title, status, notes, due_date, position)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&step.id)
            .bind(&step.goal_id)
            .bind(&step.title)
            .bind(step_status)
            .bind(&step.notes)
            .bind(&step.due_date)
            .bind(step.position)
            .execute(&self.pool)
            .await?;
        }

        sqlx::query("DELETE FROM goal_progress WHERE goal_id = ?")
            .bind(&goal.id)
            .execute(&self.pool)
            .await?;

        for p in &goal.progress {
            let signal = p.signal.to_string();
            sqlx::query(
                "INSERT INTO goal_progress (id, goal_id, period_start, period_end, signal, note, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&p.id)
            .bind(&p.goal_id)
            .bind(&p.period_start)
            .bind(&p.period_end)
            .bind(signal)
            .bind(&p.note)
            .bind(&p.created_at)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    async fn upsert_playbook(&self, pb: &Playbook) -> Result<(), SyncError> {
        let tags = serde_json::to_string(&pb.tags).unwrap_or_else(|_| "[]".into());

        sqlx::query(
            r#"
            INSERT INTO playbooks (id, title, content, tags, org, forked_from, file_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                title       = excluded.title,
                content     = excluded.content,
                tags        = excluded.tags,
                org         = excluded.org,
                forked_from = excluded.forked_from,
                file_path   = excluded.file_path,
                updated_at  = datetime('now')
            "#,
        )
        .bind(&pb.id)
        .bind(&pb.title)
        .bind(&pb.content)
        .bind(tags)
        .bind(&pb.org)
        .bind(&pb.forked_from)
        .bind(&pb.file_path)
        .bind(&pb.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_digest(&self, d: &Digest) -> Result<(), SyncError> {
        let dtype = d.digest_type.to_string();

        sqlx::query(
            r#"
            INSERT INTO digests (id, type, content, period_start, period_end, entry_count, org, file_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content      = excluded.content,
                period_start = excluded.period_start,
                period_end   = excluded.period_end,
                entry_count  = excluded.entry_count,
                org          = excluded.org,
                file_path    = excluded.file_path
            "#,
        )
        .bind(&d.id)
        .bind(dtype)
        .bind(&d.content)
        .bind(&d.period_start)
        .bind(&d.period_end)
        .bind(d.entry_count)
        .bind(&d.org)
        .bind(&d.file_path)
        .bind(&d.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_ai_conversation(&self, ai: &AiConversation) -> Result<(), SyncError> {
        sqlx::query(
            r#"
            INSERT INTO digests (id, type, content, period_start, period_end, org, file_path, created_at)
            VALUES (?, 'review', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content   = excluded.content,
                org       = excluded.org,
                file_path = excluded.file_path
            "#,
        )
        .bind(&ai.id)
        .bind(&ai.content)
        .bind(&ai.date)
        .bind(&ai.date)
        .bind(&ai.org)
        .bind(&ai.file_path)
        .bind(&ai.date)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete_entry(&self, id: &str) -> Result<(), SyncError> {
        sqlx::query("DELETE FROM entries WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn rebuild(&self, repo: &std::path::Path, config: &Config) -> Result<(), SyncError> {
        rebuild_from_disk(&self.pool, repo, config).await
    }
}
