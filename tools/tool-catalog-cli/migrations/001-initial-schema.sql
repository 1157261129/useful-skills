PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  identity_source TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  catalog_home TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS utility_origins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_key TEXT NOT NULL,
  origin_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  module_path TEXT,
  source_anchor TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, origin_key)
);

CREATE TABLE IF NOT EXISTS origin_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_id INTEGER REFERENCES utility_origins(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, origin_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_id INTEGER REFERENCES utility_origins(id) ON DELETE SET NULL,
  artifact_key TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT,
  module_path TEXT,
  source_anchor TEXT NOT NULL,
  summary TEXT,
  snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, artifact_key)
);

CREATE TABLE IF NOT EXISTS artifact_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  member_key TEXT NOT NULL,
  name TEXT NOT NULL,
  member_type TEXT NOT NULL,
  signature TEXT,
  source_anchor TEXT NOT NULL,
  summary TEXT,
  snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(artifact_id, member_key)
);

CREATE TABLE IF NOT EXISTS template_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pattern_key TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT,
  module_path TEXT,
  summary TEXT,
  snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, pattern_key)
);

CREATE TABLE IF NOT EXISTS template_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_id INTEGER NOT NULL REFERENCES template_patterns(id) ON DELETE CASCADE,
  source_anchor TEXT NOT NULL,
  module_path TEXT,
  snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pattern_id, source_anchor)
);

CREATE TABLE IF NOT EXISTS observed_external_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_id INTEGER REFERENCES utility_origins(id) ON DELETE SET NULL,
  artifact_id INTEGER REFERENCES artifacts(id) ON DELETE SET NULL,
  usage_key TEXT NOT NULL,
  source_anchor TEXT NOT NULL,
  import_text TEXT,
  call_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, usage_key)
);

CREATE TABLE IF NOT EXISTS ignored_candidates (
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

CREATE VIRTUAL TABLE IF NOT EXISTS fts_entries USING fts5(
  project_id UNINDEXED,
  entry_type UNINDEXED,
  artifact_id UNINDEXED,
  member_id UNINDEXED,
  pattern_id UNINDEXED,
  title,
  body,
  source_anchor UNINDEXED,
  tokenize = 'unicode61'
);

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '1', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
