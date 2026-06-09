PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS discovery_fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_family TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  record_key TEXT NOT NULL,
  source_anchor TEXT NOT NULL,
  source_paths TEXT NOT NULL,
  match_keys TEXT NOT NULL,
  structural_fingerprint TEXT NOT NULL,
  fingerprint_algorithm TEXT NOT NULL DEFAULT 'sha256',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, record_family, record_kind, record_key)
);

CREATE INDEX IF NOT EXISTS idx_discovery_fingerprints_project_family
ON discovery_fingerprints(project_id, record_family, record_kind);

CREATE INDEX IF NOT EXISTS idx_discovery_fingerprints_project_key
ON discovery_fingerprints(project_id, record_key);

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '5', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
