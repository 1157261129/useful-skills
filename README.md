# Skills Library

This repository stores agent skills in the standard directory layout:

```text
skills/
  <skill-name>/
    SKILL.md
```

Each skill directory name must match the `name` field in its `SKILL.md` frontmatter.
Optional skill resources such as `agents/`, `scripts/`, `references/`, and `assets/` stay inside the skill directory.

## Sync

```bash
scripts/sync-skills.sh
scripts/sync-skills.sh --check
```

The legacy `scripts/sync-execute-issues.sh` entrypoint delegates to `scripts/sync-skills.sh`.
