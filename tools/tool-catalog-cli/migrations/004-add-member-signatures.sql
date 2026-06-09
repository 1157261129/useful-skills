PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS member_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES artifact_members(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  source_anchor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, source_anchor)
);

INSERT INTO member_signatures (
  member_id, signature, source_anchor, created_at, updated_at
)
SELECT
  artifact_members.id,
  artifact_members.signature,
  artifact_members.source_anchor,
  datetime('now'),
  datetime('now')
FROM artifact_members
WHERE artifact_members.signature IS NOT NULL
  AND artifact_members.source_anchor IS NOT NULL
ON CONFLICT(member_id, source_anchor) DO UPDATE SET
  signature = excluded.signature,
  updated_at = datetime('now');

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '4', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
