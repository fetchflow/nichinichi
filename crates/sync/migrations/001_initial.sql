-- entries (reconstructed from daily markdown files)
CREATE TABLE IF NOT EXISTS entries (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  body        TEXT NOT NULL,
  detail      TEXT,
  type        TEXT CHECK(type IN ('log','solution','decision','reflection','score','ai')),
  tags        TEXT DEFAULT '[]',
  project     TEXT,
  org         TEXT,
  approximate INTEGER DEFAULT 0,
  raw_line    TEXT,
  source      TEXT DEFAULT 'sync',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  body, detail, project, org, tags,
  content='entries',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync with entries
CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, body, detail, project, org, tags)
  VALUES (new.rowid, new.body, new.detail, new.project, new.org, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, body, detail, project, org, tags)
  VALUES ('delete', old.rowid, old.body, old.detail, old.project, old.org, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, body, detail, project, org, tags)
  VALUES ('delete', old.rowid, old.body, old.detail, old.project, old.org, old.tags);
  INSERT INTO entries_fts(rowid, body, detail, project, org, tags)
  VALUES (new.rowid, new.body, new.detail, new.project, new.org, new.tags);
END;

-- goals
CREATE TABLE IF NOT EXISTS goals (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  type            TEXT CHECK(type IN ('career','learning')),
  horizon         TEXT,
  status          TEXT CHECK(status IN ('active','paused','done','abandoned')) DEFAULT 'active',
  why             TEXT,
  org             TEXT,
  file_path       TEXT NOT NULL,
  completion_date TEXT,
  created_at      TEXT,
  updated_at      TEXT
);

-- goal steps
CREATE TABLE IF NOT EXISTS goal_steps (
  id        TEXT PRIMARY KEY,
  goal_id   TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  status    TEXT CHECK(status IN ('not_started','in_progress','done')) DEFAULT 'not_started',
  notes     TEXT,
  due_date  TEXT,
  position  INTEGER NOT NULL
);

-- goal step <-> entry links
CREATE TABLE IF NOT EXISTS goal_step_entries (
  step_id   TEXT REFERENCES goal_steps(id) ON DELETE CASCADE,
  entry_id  TEXT REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, entry_id)
);

-- goal progress
CREATE TABLE IF NOT EXISTS goal_progress (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  signal       TEXT CHECK(signal IN ('breakthrough','strong','steady','moderate','struggling','quiet')),
  note         TEXT,
  created_at   TEXT
);

-- playbooks
CREATE TABLE IF NOT EXISTS playbooks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT,
  tags        TEXT DEFAULT '[]',
  org         TEXT,
  forked_from TEXT,
  file_path   TEXT NOT NULL,
  created_at  TEXT,
  updated_at  TEXT
);

-- digests
CREATE TABLE IF NOT EXISTS digests (
  id           TEXT PRIMARY KEY,
  type         TEXT CHECK(type IN ('weekly','monthly','review')),
  content      TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  entry_count  INTEGER,
  org          TEXT,
  file_path    TEXT NOT NULL,
  created_at   TEXT
);

-- AI-generated goal suggestions (ephemeral, not written to markdown)
CREATE TABLE IF NOT EXISTS goal_suggestions (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  reason     TEXT NOT NULL,
  status     TEXT CHECK(status IN ('pending','accepted','dismissed')) DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- UI settings (not reconstructable from markdown)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS entries_date  ON entries(date);
CREATE INDEX IF NOT EXISTS entries_type  ON entries(type);
CREATE INDEX IF NOT EXISTS entries_org   ON entries(org);
CREATE INDEX IF NOT EXISTS entries_proj  ON entries(project);
CREATE INDEX IF NOT EXISTS goals_status  ON goals(status);
CREATE INDEX IF NOT EXISTS goals_org     ON goals(org);
CREATE INDEX IF NOT EXISTS digests_type  ON digests(type);
