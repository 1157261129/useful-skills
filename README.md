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
tool-catalog discover --apply <decisions.json> [--root <path>] [--json]
tool-catalog tags [--root <path>] [--json]
tool-catalog query --tag <tag> [--description <text>] [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
tool-catalog query --description <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
tool-catalog show <selector> [--root <path>] [--json]
tool-catalog verify <selector> [--root <path>] [--json]
```

Discovery is agent-owned: agents should follow the bundled `tool-catalog-discover` skill, scan the Target Project through worker subagents, write a reviewed Discovery Decision File, then use `discover --apply` as the only CLI write path.

Consulting should inspect the Capability Tag Vocabulary with `tool-catalog tags`, query with exact `--tag` filters or `--description` text, then use `show` for returned entries and `verify` for project-owned source anchors before reuse. External utility class or module selectors are returned for agent judgment; dependency and convention checks are not a CLI verify responsibility. Suppressions are discovery-only state and are not returned by consulting commands. Repeated `--tag` filters use exact AND semantics.
Query result limits default to 5 and may be raised to at most 10. Description text is deterministic query text, not a semantic recommendation request. `--current-file` is query context only. `--artifact-type` narrows project-owned `artifact:` results; external selectors do not store artifact types.
Query output is a minimal ranked list and does not include source anchors, usage notes, or limitations. Use `show` for full entry details. `verify` accepts only project-owned `artifact:` selectors; external selectors must be checked by the agent against dependencies and local conventions.
