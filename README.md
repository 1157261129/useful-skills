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

## Tool Catalog Verification

Run these repository checks before changing the Tool Catalog CLI or skill contracts:

```bash
node --check tools/tool-catalog-cli/bin/tool-catalog.mjs
node tools/tool-catalog-cli/tests/regression.mjs
node scripts/check-tool-catalog-skills.mjs
bash -n scripts/sync-skills.sh
```

The documented Tool Catalog command surface is:

```text
tool-catalog doctor
tool-catalog config project-id <id> [--root <path>] [--json]
tool-catalog config info [--root <path>] [--json]
tool-catalog discover --full --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
tool-catalog discover --changed <paths...> --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
tool-catalog discover --apply <decisions.json> [--root <path>] [--json]
tool-catalog query --goal <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
tool-catalog show <selector> [--root <path>] [--json]
tool-catalog verify <selector> [--root <path>] [--json]
```
