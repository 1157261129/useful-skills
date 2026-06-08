---
name: tool-catalog-discover
description: Discovers reusable utility artifacts and recurring template code for a Target Project through a two-phase Tool Catalog CLI workflow. Use when the user asks to discover, refresh, review, or index project utilities, observed external utility usage, or recurring template patterns.
---

# Tool Catalog Discover

Use this skill to prepare or refresh a Target Project's Project Index. Discovery is mutating only during apply.

## Quick Start

1. Identify the Target Project root explicitly.
2. Locate the shared CLI at `../tool-catalog-cli/bin/tool-catalog` relative to this skill directory, or at `tools/tool-catalog-cli/bin/tool-catalog` while developing this repository.
3. Run `tool-catalog --help` and `tool-catalog doctor`; report missing `node` or `sqlite3`.
4. Run `tool-catalog config info --root <project>`; if this checkout must share an existing index, ask for or set `tool-catalog config project-id <id> --root <project>`.

## Workflow

1. Dry run:
   - Full refresh: `tool-catalog discover --full --dry-run --root <project> --json`.
   - Changed refresh: `tool-catalog discover --changed <paths...> --dry-run --root <project> --json`.
   - Use `--language`, `--include`, and `--exclude` only to narrow the deterministic scan.
2. Review candidates:
   - Accept only observed Utility Artifacts, observed external utility usage, and Template Code.
   - Ignore false positives with a short reason; defer only when the user must decide.
   - Write concise English summaries, usage notes, and limitations. Keep semantic judgement in this skill, not in the CLI.
3. Apply:
   - Save a decisions JSON that includes the dry-run `scan`, candidate payloads, and `decisions` keyed by `candidate_id`.
   - Use actions `accept`, `ignore`, or `defer`; every candidate must be resolved before SQLite is updated.
   - Run `tool-catalog discover --apply <decisions.json> --root <project> --json`.
4. Report:
   - Summarize accepted entries, ignored candidates, cleanup scope, required decisions, and follow-up commands from the apply output.
   - If apply reports `index_mutated: false`, resolve required decisions and rerun apply.

## Rules

- Do not edit Target Project source during discovery.
- Do not run project builds or tests unless the user asks; discovery uses lightweight structural scanning.
- Store only relative source anchors from the Target Project.
- Keep catalog prose English and deterministic CLI inputs structured.
