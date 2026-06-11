PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

DROP TABLE IF EXISTS entry_capability_tags;
DROP TABLE IF EXISTS capability_tags;
DROP TABLE IF EXISTS discovery_fingerprints;
DROP TABLE IF EXISTS suppressions;
DROP TABLE IF EXISTS external_selectors;
DROP TABLE IF EXISTS artifacts;
DROP TABLE IF EXISTS utility_origins;

DROP TABLE IF EXISTS origin_priorities;
DROP TABLE IF EXISTS artifact_members;
DROP TABLE IF EXISTS member_signatures;
DROP TABLE IF EXISTS template_instances;
DROP TABLE IF EXISTS template_patterns;
DROP TABLE IF EXISTS observed_external_usages;
DROP TABLE IF EXISTS ignored_candidates;
DROP TABLE IF EXISTS deferred_candidates;
DROP TABLE IF EXISTS fts_entries;

CREATE TABLE utility_origins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_key TEXT NOT NULL,
  origin_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, origin_key)
);

CREATE TABLE artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  selector TEXT NOT NULL,
  language TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  framework TEXT,
  module_path TEXT,
  summary TEXT NOT NULL,
  usage_notes TEXT,
  limitations TEXT,
  source_anchor TEXT NOT NULL,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, selector)
);

CREATE TABLE external_selectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  selector TEXT NOT NULL,
  origin_id INTEGER NOT NULL REFERENCES utility_origins(id) ON DELETE CASCADE,
  origin_key TEXT NOT NULL,
  language TEXT NOT NULL,
  framework TEXT,
  summary TEXT NOT NULL,
  usage_notes TEXT,
  limitations TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, selector)
);

CREATE TABLE suppressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suppression_key TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  fingerprint_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, suppression_key)
);

CREATE TABLE discovery_fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint_key TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, fingerprint_key)
);

CREATE TABLE capability_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, tag)
);

CREATE TABLE entry_capability_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  entry_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES capability_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, entry_type, entry_id, tag_id)
);

CREATE INDEX idx_artifacts_project_priority
ON artifacts(project_id, priority, selector);

CREATE INDEX idx_external_selectors_project_origin
ON external_selectors(project_id, origin_id, selector);

CREATE INDEX idx_origins_project_priority
ON utility_origins(project_id, priority, origin_key);

CREATE INDEX idx_entry_capability_tags_entry
ON entry_capability_tags(project_id, entry_type, entry_id);

CREATE INDEX idx_entry_capability_tags_tag
ON entry_capability_tags(project_id, tag_id);

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '6', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;

PRAGMA foreign_keys = ON;
