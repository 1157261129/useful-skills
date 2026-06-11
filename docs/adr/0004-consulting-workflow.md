# Consulting Workflow Decisions

This file consolidates the consulting ADRs that previously lived as ADR 0004, 0021, 0022, and 0031.

## ADR 0004: Return Project-Owned Results Before External Results

Consulting first narrows results through canonical capability tags, selection descriptions, and optional context filters, then returns five entries by default, with `--limit` capped at ten. Query output is filled in two phases: matching project-owned `artifact:` entries are returned first, ordered by persisted Artifact Priority with lower numeric values first; external utility class or module selectors are queried only for the remaining result slots and are ordered by their referenced origin priority, also with lower numeric values first. Discovery still assigns project-owned artifact priorities lower than external origin priorities as a consistency check, but consulting does not rely on mixed priority sorting to preserve project-owned precedence.

Consequences:

- The consulting skill should be fast: it does not recompute priority from source or usage history.
- Text match, module proximity, and selector order are tie-breakers only among otherwise equal-priority entries.
- Missing or stale Artifact Priority is repaired through discovery, not by consulting.
- External results return the external utility class or module selector, inherit priority from the normalized library/module origin, and do not include import, call, or source-anchor evidence by default.
- Query results are minimal ranked list items: they include selector, kind, summary, capability tags, priority, language, optional framework, optional project-owned module path, and external origin metadata, but not source anchors, usage notes, or limitations.
- Selectors are stable class or module full names with `artifact:` or `external:` prefixes; internal database keys, hashes, and usage evidence keys are not agent-facing selectors.
- Origins are not returned as reusable entries by themselves; they only provide priority and provenance for external selectors.
- External results never displace matching project-owned results, even when an external origin has a lower numeric priority value because of bad discovery data.
- Suppressions are discovery-only state. Consulting does not return, show, verify, rank, or filter by suppressions.
- No query-time recommendation score is maintained.

## ADR 0021: Consulting Trigger Is Agent Discretion

The consulting skill does not prescribe when every coding workflow must use the catalog. Agents decide whether to invoke `tool-catalog-consult` based on their task, project context, and need for reuse guidance.

Consequences:

- The consulting skill defines how to query catalog results and verify project-owned source anchors once invoked.
- Coding workflows are not forced to run catalog lookup for every task.

## ADR 0022: Consult Before Coding With Progressive Verification

When invoked, the consulting skill identifies the project index, inspects the Capability Tag Vocabulary when the task involves reusable utilities, maps the task to canonical tags, queries project-owned utility artifacts and external utility class or module selectors, inspects relevant entries, verifies project-owned source anchors, reads source anchors for project-owned entries, and only then uses confirmed utilities in code. If the task names an exact project-owned catalog selector, class, or module, the skill may skip tag vocabulary lookup and go directly to show or verify. If the task names an external selector, the skill may skip tag vocabulary lookup and use show plus dependency and convention checks.

Consequences:

- Catalog results are navigation aids, not authoritative replacements for source inspection.
- `show` is the detail boundary: project-owned artifact details include source anchors, and external selector details include origin metadata without source anchors.
- CLI verify is for project-owned source anchors, not external utility selectors.
- Missing or weak indexes are reported as discovery needs rather than triggering full discovery from consulting.
- No-result tag queries may first remap to a better canonical tag from the vocabulary, then broaden once without tag filters.
- Persistent no-result outcomes are reported as no reusable catalog entry found.
- Tag-first lookup is the default reuse path, while exact symbol lookup remains available for known entries.

## ADR 0031: Query by Tags, Description, and Code Context

Catalog queries use exact capability tags or deterministic description text plus optional current file, language, framework, artifact type, and result limit. Description text is matched against persisted English catalog prose such as `summary`, `usage_notes`, and `limitations`. The current file is query context only and is not persisted on catalog entries. `language` filters both project-owned artifacts and external selectors, `framework` filters entries that carry known framework metadata, and `artifact_type` filters project-owned artifacts only because external selectors do not store an artifact type. Tags and descriptions drive fast candidate narrowing before priority sorting. `--goal` is not part of the query contract; at least one of `--tag` or `--description` is required. `--limit` defaults to five and is capped at ten.

Consequences:

- Query input stays compact enough for agents to generate reliably.
- Agents can progressively refine results by adding filters.
- Description text is deterministic query text matched against persisted catalog fields, not a semantic recommendation request.
