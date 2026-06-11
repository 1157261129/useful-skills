PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '3', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
