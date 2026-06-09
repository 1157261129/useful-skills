PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

ALTER TABLE artifacts ADD COLUMN usage_notes TEXT;
ALTER TABLE artifacts ADD COLUMN limitations TEXT;
ALTER TABLE artifact_members ADD COLUMN usage_notes TEXT;
ALTER TABLE artifact_members ADD COLUMN limitations TEXT;
ALTER TABLE template_patterns ADD COLUMN usage_notes TEXT;
ALTER TABLE template_patterns ADD COLUMN limitations TEXT;

CREATE TABLE IF NOT EXISTS capability_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, tag)
);

CREATE TABLE IF NOT EXISTS entry_capability_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  entry_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES capability_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, entry_type, entry_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_capability_tags_entry
ON entry_capability_tags(project_id, entry_type, entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_capability_tags_tag
ON entry_capability_tags(project_id, tag_id);

CREATE TABLE IF NOT EXISTS deferred_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  candidate_key TEXT NOT NULL,
  candidate_type TEXT NOT NULL,
  source_anchor TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, candidate_key)
);

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '3', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
