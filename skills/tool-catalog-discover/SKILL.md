---
name: tool-catalog-discover
description: Discovers reusable utility artifacts and recurring template code for a Target Project through a two-phase Tool Catalog CLI workflow. Use when the user asks to discover, refresh, review, or index project utilities, observed external utility usage, or recurring template patterns.
---

# Tool Catalog Discover

Use this skill to prepare or refresh a Target Project's Project Index. Discovery mutates state only during apply.

## Quick Start

1. Identify the Target Project root explicitly.
2. Locate the shared CLI at `../tool-catalog-cli/bin/tool-catalog` relative to this skill directory, or at `tools/tool-catalog-cli/bin/tool-catalog` while developing this repository.
3. Run `tool-catalog --help` and `tool-catalog doctor`; report missing `node` or `sqlite3`.
4. Run `tool-catalog config info --root <project>`; if this checkout must share an existing index, ask for or set `tool-catalog config project-id <id> --root <project>`.
5. Run Evidence Harvest with `tool-catalog discover --full --dry-run --root <project> --json` or `tool-catalog discover --changed <paths...> --dry-run --root <project> --json`.
6. Read `finding-manifest.json` and `finding-index.json`, then route Findings through the worker flow below. If subagents are unavailable, stop after reporting the harvest artifacts and do not apply.

## Run Contract

- Discovery uses one durable run directory under the user-level Tool Catalog cache. The Target Project working tree must stay free of transient discovery artifacts.
- Treat CLI dry-run output as Finding evidence, not trusted semantic recommendations.
- The main agent is the only dispatcher. It owns the workflow DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O.
- Every worker receives the shared run contract: `run_id`, `stage`, `worker_id`, `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, `coverage`, and upstream artifact paths.
- Dispatch must attempt the selected `model` and `reasoning_effort` fields first even when the active subagent tool schema omits them. Treat those fields as unavailable only after an actual dispatch failure.
- Workers may produce strict Markdown work plans and child briefs, but workers must not spawn subagents.

## Required Artifacts

- Evidence Harvest writes mechanical Findings, metadata, deterministic dedupe state, and Discovery Fingerprints.
- Work plans are strict Markdown orchestration artifacts, never apply input.
- Every work plan must include these fields exactly once per work item: `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, and `coverage`.
- Shard plans, chunk plans, reviewed chunks, and shard aggregates must carry coverage accounting.
- Oversized dry-runs and oversized shards must be split into bounded worker inputs rather than one oversized worker prompt.
- The oversized planning chain is fixed: harvest manifest/index -> Shard Planner -> Chunk Planner when a shard stays oversized -> bounded shard/chunk review inputs -> Shard Aggregator -> Cross-Shard Merge.
- Minimal `status.md` files are required for worker handoff.
- Every worker writes a concise terminal `status.md` in the run directory.
- `status.md` must record `terminal_status`, `outcome`, `artifacts`, `readiness`, and `next_worker`.
- `terminal_status` is one of `completed`, `failed`, or `blocked`.
- Review and merge artifacts must preserve Review Groups, conflicts, traceability, and coverage.
- Final catalog decisions are written only as a JSON Discovery Decision File.
- Decision files are entry-centric and apply consumes them deterministically.
- Narrative reports are not required.

## Worker Flow

1. Evidence Harvest Worker: run the dry-run CLI, write Findings plus manifest/index references, and treat the output as bounded-recall evidence only.
2. Shard Planner Worker: read harvest manifests, produce bounded shard work items, assign `coverage`, and route any oversized shard to a Chunk Planner Worker instead of one oversized prompt.
3. Chunk Planner Worker: recursively split one oversized shard into bounded child work items and write Markdown plans only; it must not spawn subagents.
4. Shard Review Worker: clean mechanical noise, group Findings structurally, validate local anchors, and flag structural issues for one bounded shard or chunk.
5. Shard Review Worker outputs stay structural only: no accept/ignore/defer, semantic tags, summaries, usage notes, limitations, or final catalog decisions.
6. Shard Aggregator Worker: merge reviewed chunks back into one shard artifact, preserve traceability, and fail the shard if `coverage` shows missing or duplicate Finding coverage.
7. Cross-Shard Merge Worker: merge shard-level Review Groups, preserve conflicts and duplicate suggestions, and avoid final semantic decisions.
8. Catalog Finalizer Worker: inspect source anchors directly, own semantic decisions, run mandatory local gap audit for every Review Group considered for acceptance, decide suppressions and deferrals, and write the entry-centric Discovery Decision File.
9. Decision Review Worker: review the Discovery Decision File and upstream artifacts before apply, must not modify the Discovery Decision File, and return pass, repair needed, or blocking decision needed.
10. Finalizer Repair Worker: fix concrete Decision Review Worker findings, update finalizer-owned decision artifacts, and send the run back to the Decision Review Worker.
11. Decision Incorporation Worker: after explicit user direction on blocking findings, incorporate that decision into the Discovery Decision File and return the run to the Decision Review Worker.
12. Apply/Verify Worker: run by default only after the Decision Review Worker passes with no blockers, unless the user explicitly requested review-only mode, then apply and verify persisted Catalog Entries, Suppressions, Deferrals, and Discovery Fingerprints.

## Rules

- Do not edit Target Project source during discovery.
- Do not run Target Project builds or tests unless the user asks; discovery uses lightweight structural scanning.
- Store only relative source anchors from the Target Project.
- Findings are mechanical evidence, not semantic recommendations.
- The main agent must not directly choose final accept, ignore, or defer decisions from raw dry-run output.
- Do not run `tool-catalog discover --apply <decisions.json> --root <project> --json` without a Decision Review pass artifact, unless the user explicitly overrides review and the final report records that override.
- Keep catalog prose English and deterministic CLI inputs structured.
