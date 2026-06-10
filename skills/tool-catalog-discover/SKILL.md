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
6. Run the Artifact Sanity Gate with `node scripts/validate-evidence-pack.mjs <finding-manifest.json> --json` from this skill directory; it validates `manifest.run_files.run_id`, `finding-index.items[]`, run file locations, counts, relative anchors, and absence of semantic decision fields.
7. Discover the active surface's subagent dispatch tools, including deferred tool discovery when supported, then route the structurally validated Finding Evidence Pack through the worker flow below. Treat subagents as unavailable only after tool discovery or an actual dispatch attempt fails; then write dispatcher `status.md`, report harvest artifacts, and do not apply.

## Run Contract

- Discovery uses one durable run directory under the user-level Tool Catalog cache. The Target Project working tree must stay free of transient discovery artifacts.
- The main agent runs Evidence Harvest and the Artifact Sanity Gate. The worker DAG starts at the Shard Planner Worker.
- Treat CLI dry-run output as a structurally validated Finding Evidence Pack, not trusted semantic recommendations.
- The main agent is the only dispatcher. It owns the workflow DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O.
- Default worker concurrency is at most 2. Maintain a ready queue; when a worker reaches terminal status or a slot opens, recompute readiness and fill open dispatch capacity immediately until the pool is full or no work is ready.
- Dispatch profiles are role-specific: review and merge workers may prefer economical models; finalizer, review, and repair profiles increase model strength or `reasoning_effort` with ambiguity, risk, dependency depth, and verification burden. Do not statically assign every worker to a strong model.
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
- Minimal `status.md` files are required for dispatcher and worker handoff.
- The dispatcher writes root `status.md`; every worker writes a concise terminal `workers/<work_item_id>/status.md`.
- `status.md` must record `terminal_status`, `outcome`, `artifacts`, `readiness`, and `next_worker`.
- `terminal_status` is one of `completed`, `failed`, or `blocked`.
- Review and merge artifacts must preserve Review Groups, conflicts, traceability, and coverage.
- Final catalog decisions are written only as a JSON Discovery Decision File.
- Decision files are entry-centric and apply consumes them deterministically.
- Narrative reports are not required.

## Worker Flow

1. Shard Planner Worker: read the validated harvest manifest/index, produce bounded shard work items, assign `coverage`, and route any oversized shard to a Chunk Planner Worker instead of one oversized prompt. Shard Planner Worker must not over-split: prefer directory, module, and language shards; recurse to chunking only when bounded input limits require it.
2. Chunk Planner Worker: recursively split one oversized shard into bounded child work items and write Markdown plans only; it must not spawn subagents.
3. Shard Review Worker: clean mechanical noise, group Findings structurally, validate local anchors, and flag structural issues for one bounded shard or chunk.
4. Shard Review Worker outputs stay structural only: no accept/ignore/defer, semantic tags, summaries, usage notes, limitations, or final catalog decisions.
5. Shard Aggregator Worker: merge reviewed chunks back into one shard artifact, preserve traceability, and fail the shard if `coverage` shows missing or duplicate Finding coverage.
6. Cross-Shard Merge Worker: merge shard-level Review Groups, preserve conflicts and duplicate suggestions, and avoid final semantic decisions.
7. Catalog Finalizer Worker: inspect source anchors directly, own semantic decisions, run mandatory local gap audit for every Review Group considered for acceptance, decide suppressions and deferrals, and write the entry-centric Discovery Decision File.
8. Decision Review Worker: review the Discovery Decision File and upstream artifacts before apply, must not modify the Discovery Decision File, and return pass, repair needed, or blocking decision needed.
9. Finalizer Repair Worker: fix concrete Decision Review Worker findings, update finalizer-owned decision artifacts, and send the run back to the Decision Review Worker.
10. Decision Incorporation Worker: after explicit user direction on blocking findings, incorporate that decision into the Discovery Decision File and return the run to the Decision Review Worker.
11. Apply/Verify Worker: run by default only after the Decision Review Worker passes with no blockers, unless the user explicitly requested review-only mode, then apply and verify persisted Catalog Entries, Suppressions, Deferrals, and Discovery Fingerprints.

## Rules

- Do not edit Target Project source during discovery.
- Do not run Target Project builds or tests unless the user asks; discovery uses lightweight structural scanning.
- Store only relative source anchors from the Target Project.
- Findings are mechanical evidence, not semantic recommendations.
- The main agent must not directly choose final accept, ignore, or defer decisions from raw dry-run output.
- Workers must validate source anchors directly before relying on any Finding content.
- Do not run `tool-catalog discover --apply <decisions.json> --root <project> --json` without a Decision Review pass artifact, unless the user explicitly overrides review and the final report records that override.
- Keep catalog prose English and deterministic CLI inputs structured.
