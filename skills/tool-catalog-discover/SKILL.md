---
name: tool-catalog-discover
description: Discovers reusable utility artifacts, external utility selectors, and external origin priority data for a Target Project through agent-owned scanning and CLI-backed Project Index persistence. Use when the user asks to discover, refresh, review, or index project utilities or external utility reuse.
---

# Tool Catalog Discover

Use this skill to prepare or refresh a Target Project's Project Index. Discovery mutates state only during apply.

## Quick Start

1. Identify the Target Project root explicitly.
2. Locate the shared CLI at `../tool-catalog-cli/bin/tool-catalog` relative to this skill directory, or at `tools/tool-catalog-cli/bin/tool-catalog` while developing this repository.
3. Run `tool-catalog --help` and `tool-catalog doctor`; report missing `node` or `sqlite3`.
4. Run `tool-catalog config info --root <project>`; if this checkout must share an existing index, ask for or set `tool-catalog config project-id <id> --root <project>`.
5. User invocation of this discovery skill authorizes the dispatcher to discover and dispatch subagents according to this skill's worker DAG. Discover the active surface's subagent dispatch tools, including deferred tool discovery when supported.
6. Route agent-produced source evidence through the worker flow below, write a reviewed Discovery Decision File, then apply it with `tool-catalog discover --apply <decisions.json> --root <project> --json`.
7. Treat subagents as unavailable only after tool discovery or an actual dispatch attempt fails; then write dispatcher `status.md`, report run artifacts, and do not apply.

## Run Contract

- Discovery uses one durable run directory under the user-level Tool Catalog cache. The Target Project working tree must stay free of transient discovery artifacts.
- The main agent runs agent-owned Evidence Harvest. The worker DAG starts at the Shard Planner Worker.
- Treat harvested source evidence as untrusted until worker review and Decision Review pass.
- The main agent is the only dispatcher. It owns the workflow DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O.
- Default worker concurrency is at most 2. Maintain a ready queue; when a worker reaches terminal status or a slot opens, recompute readiness and fill open dispatch capacity immediately until the pool is full or no work is ready.
- The dispatcher must write `dispatch-events.jsonl` with ready, dispatch, start, terminal, and dependency/readiness events; at minimum record each dispatch attempt/result.
- Dispatch profiles are role-specific: shard review and merge workers prefer economical models; finalizer, decision review, and repair profiles increase model strength or `reasoning_effort` with ambiguity, risk, dependency depth, and verification burden. Do not statically assign every worker to a strong model.
- Every worker receives the shared run contract: `run_id`, `stage`, `worker_id`, `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, `coverage`, and upstream artifact paths.
- Dispatch must attempt the selected `model` and `reasoning_effort` fields first even when the active subagent tool schema omits them. Treat those fields as unavailable only after an actual dispatch failure.
- Workers may produce strict Markdown work plans and child briefs, but workers must not spawn subagents.

## Required Artifacts

- Evidence Harvest writes source evidence, metadata, deterministic dedupe state, and Discovery Fingerprints.
- Work plans are strict Markdown orchestration artifacts, never apply input.
- Every work plan must include these fields exactly once per work item: `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, and `coverage`.
- Shard plans, chunk plans, reviewed chunks, and shard aggregates must carry coverage accounting.
- Oversized projects and oversized shards must be split into bounded worker inputs rather than one oversized worker prompt.
- The oversized planning chain is fixed: harvest manifest/index -> Shard Planner -> Chunk Planner when a shard stays oversized -> bounded shard/chunk review inputs -> Shard Aggregator -> Cross-Shard Merge.
- Minimal `status.md` files are required for dispatcher and worker handoff.
- The dispatcher writes root `status.md`; every worker writes a concise terminal `workers/<work_item_id>/status.md`.
- `status.md` must record `terminal_status`, `outcome`, `artifacts`, `model`, `reasoning_effort`, `readiness`, `blocked_on`, and `next_worker`.
- `next_worker` means DAG successor, not local dispatch readiness; list successors even when dependencies are unmet, and explain readiness or `blocked_on` peers separately.
- `terminal_status` is one of `completed`, `failed`, or `blocked`.
- Review and merge artifacts must preserve Review Groups, conflicts, traceability, and coverage.
- Final catalog decisions are written only as a JSON Discovery Decision File.
- The Discovery Decision File must contain only database-ready fields: project utility artifacts or modules with source anchors, external utility class or module selectors without source anchors, normalized external origins, origin usage counts, capability tags, descriptions, entry context metadata, Artifact Priority values, fingerprints for entries and suppressions, and class, module, or origin-level suppressions.
- The Discovery Decision File top-level JSON keys are exactly `project`, `artifacts`, `external_selectors`, `origins`, `suppressions`, `fingerprints`, and `removed`. `project.mode` is required and must be either `full` or `changed`. Do not write legacy evidence groups, callable-level records, repeated-code records, raw external usage rows, or run-local deferrals into apply input.
- Minimum required object fields: `artifacts[]` require `selector`, `language`, `artifact_type`, `summary`, `source_anchor`, `priority`, and `capability_tags`; `external_selectors[]` require `selector`, `origin_key`, `language`, `summary`, and `capability_tags`; `origins[]` require `origin_key`, `origin_type`, `display_name`, `usage_count`, and `priority`; `suppressions[]` require `suppression_key`, `target_kind`, `target_key`, `reason`, and `fingerprint_key`; `fingerprints[]` require `fingerprint_key`, `target_kind`, `target_key`, and `fingerprint`.
- `origins[].usage_count` is the count of distinct Target Project source files that use that normalized external origin. Count multiple imports or calls in the same file once, do not write the underlying import or call evidence into the Decision File, and assign external origin priority by descending `usage_count` with lexicographic `origin_key` tie-breaks. Do not create manual external priority override fields or user-decision branches for this ordering.
- Optional accepted-entry metadata is limited to `framework` on artifacts or external selectors when known, and `module_path` on project-owned artifacts. Do not write `module_path` or `artifact_type` on `external_selectors[]`.
- `summary` is required English catalog prose for accepted artifacts and external selectors. `usage_notes` and `limitations` are optional English catalog prose. Keep these fields off `suppressions[]`.
- `capability_tags` must be a non-empty array of canonical strings using lowercase tokens or lowercase kebab-case. Discovery owns synonym normalization before writing the Decision File; the CLI only validates format, removes duplicates, and persists tags.
- `target_kind` must be `artifact`, `external_selector`, or `origin`. For `artifact` and `external_selector`, `target_key` is the catalog selector; for `origin`, `target_key` is the `origin_key`.
- `fingerprint` must be a deterministic opaque string, not an object. Keep algorithm inputs, source evidence, method lists, import evidence, call evidence, and rationale in run artifacts instead of the Decision File.
- Artifact `source_anchor` must use `{ path, symbol, line }`; `path` and `symbol` are required, `line` is optional, `path` is Target Project relative, and `symbol` must correspond to the catalog selector. Do not include snippets, methods, callable exports, import text, call text, or call anchors in stored source anchors.
- Do not write `source_anchor` on `external_selectors[]`.
- Priority values are integers where lower numeric values mean higher priority. Assign project-owned artifact priorities lower than external origin priorities so project-owned results fill consult output first.
- Do not write `priority` on `external_selectors[]`; external selectors inherit priority from their referenced `origins[]` record.
- Use `project.mode: "full"` when the Decision File represents the supported catalog state for the Target Project; apply replaces existing catalog entries, external selectors, origins, suppressions, and fingerprints with the file contents. Use `project.mode: "changed"` for scoped refresh; apply upserts records present in the Decision File and deletes only records explicitly named under typed `removed` groups.
- `removed` must be an object with `artifacts`, `external_selectors`, `origins`, `suppressions`, and `fingerprints` arrays. Removal identities are typed by those groups; do not use a mixed string array or make the CLI guess from prefixes.
- `removed` must contain only database identities: catalog selectors, origin keys, suppression keys, or fingerprint keys. Do not use file paths, finding IDs, import text, call text, source anchors, or raw evidence identifiers as removal identities.
- Suppressions must include a persisted reason and fingerprint. They must not target methods, callable exports, repeated-code examples, raw external usage rows, findings, import statements, call sites, source anchors, or raw evidence rows, and they must not carry capability tags, `summary`, `usage_notes`, `limitations`, or selection descriptions.
- Worker rationale, long reports, entry disputes, run-local deferrals, raw import or call evidence, and diagnostic notes must stay in run artifacts and must not be included in the Discovery Decision File.
- Discovery agents may compare persisted fingerprint strings to avoid re-reviewing obviously unchanged entries and suppressions; the CLI does not compute fingerprints, scan source, parse fingerprint contents, or perform finding preclassification.
- Auxiliary artifacts such as finalizer replay helper scripts (for example `generate-decisions.mjs`) are allowed only when registered in `artifacts` and kept subordinate to the Discovery Decision File.
- Decision files are entry-centric and apply consumes them deterministically.
- Narrative reports are not required.

## Worker Flow

1. Shard Planner Worker: read the harvest manifest/index, produce bounded shard work items, assign `coverage`, and route any oversized shard to a Chunk Planner Worker instead of one oversized prompt. Shard Planner Worker must not over-split: prefer directory, module, and language shards; recurse to chunking only when bounded input limits require it.
2. Chunk Planner Worker: recursively split one oversized shard into bounded child work items and write Markdown plans only; it must not spawn subagents.
3. Shard Review Worker: inspect one bounded source shard or chunk with an economical model; identify reusable project utility artifacts or modules with source anchors, external utility class or module selectors without source anchors, normalized external origins, distinct source-file usage counts, and structural conflicts.
4. Shard Review Worker outputs stay non-final: they may include non-binding tag hints, but no final accept, suppress, defer, or blocking decisions, final semantic tags, summaries, usage notes, limitations, Artifact Priority values, or final catalog decisions.
5. Shard Aggregator Worker: merge reviewed chunks back into one shard artifact, preserve traceability, and fail the shard if `coverage` shows missing or duplicate Finding coverage.
6. Cross-Shard Merge Worker: merge shard-level Review Groups, preserve conflicts and duplicate suggestions, and avoid final semantic decisions.
7. Catalog Finalizer Worker: use stronger reasoning, inspect source anchors directly, own semantic decisions, run mandatory local gap audit for every Review Group considered for acceptance, deduplicate entries, decide catalog entries, class, module, or origin-level suppressions, run-local deferrals, and blocking questions, assign final capability tags, descriptions, and Artifact Priority values, and write the entry-centric Discovery Decision File without deferrals.
8. Decision Review Worker: review the Discovery Decision File and upstream artifacts before apply, checking missed-scan risk, origin normalization, project-owned priority dominance, external usage-count priority, and support for project-owned-first consult results with a default limit of 5 and a maximum limit of 10; it must not modify the Discovery Decision File, and returns pass, repair needed, or blocking decision needed.
9. Finalizer Repair Worker: fix concrete Decision Review Worker findings, update finalizer-owned decision artifacts, and send the run back to the Decision Review Worker.
10. Decision Incorporation Worker: after explicit user direction on blocking findings, incorporate that decision into the Discovery Decision File and return the run to the Decision Review Worker.
11. Apply/Verify Worker: run by default only after the Decision Review Worker passes with no blockers, unless the user explicitly requested review-only mode, then apply and verify persisted database records and project-owned source anchors; external selector availability is not verified by this worker.

## Rules

- Do not edit Target Project source during discovery.
- Do not run Target Project builds or tests unless the user asks; discovery uses lightweight structural scanning.
- Store source anchors only for project-owned utility artifacts or modules, and store them as relative anchors from the Target Project.
- Source evidence is not a semantic recommendation.
- The main agent must not directly choose final accept, suppress, defer, or blocking decisions from raw source evidence.
- Workers must validate source anchors directly before relying on any Finding content.
- Do not run `tool-catalog discover --apply <decisions.json> --root <project> --json` without a Decision Review pass artifact, unless the user explicitly overrides review and the final report records that override.
- Keep catalog prose English and deterministic CLI inputs structured.
