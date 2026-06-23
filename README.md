# Skills Library

This repository stores agent skills in the standard directory layout:

```text
skills/
  <skill-name>/
    SKILL.md
```

Each skill directory name must match the `name` field in its `SKILL.md` frontmatter.
Optional skill resources such as `agents/`, `scripts/`, `references/`, and `assets/` stay inside the skill directory.

## Imported Skills

The Java review and pattern skills are adapted from
[`decebals/claude-code-java`](https://github.com/decebals/claude-code-java),
`.claude/skills`, under the MIT License, Copyright (c) 2026 Decebal Suiu.

## Sync

```bash
scripts/sync-skills.sh
scripts/sync-skills.sh --check
```
