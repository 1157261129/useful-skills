PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

ALTER TABLE artifacts ADD COLUMN framework TEXT;
ALTER TABLE template_patterns ADD COLUMN framework TEXT;
ALTER TABLE observed_external_usages ADD COLUMN language TEXT;
ALTER TABLE observed_external_usages ADD COLUMN framework TEXT;

INSERT INTO metadata (key, value, updated_at)
VALUES ('schema_version', '2', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

COMMIT;
