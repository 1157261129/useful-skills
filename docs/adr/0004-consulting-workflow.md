# Consulting Workflow Decisions

This file consolidates the consulting ADRs that previously lived as ADR 0004, 0021, 0022, and 0031.

## ADR 0004: Rank Consulting Results by Match, Then Priority

Consulting results are selected first by how well the utility class or method matches the coding goal, then ranked by configured priority. Utilities owned by the target project are preferred ahead of external utility origins, and external utilities are ordered by the configured origin priority.

Consequences:

- A preferred utility origin does not outrank a poor functional match.
- The consulting skill may return multiple results so the agent can verify the best fit before coding.
- No separate recommendation score is maintained.
- Missing external origin priorities are resolved during discovery when possible; consulting reads existing priorities and degrades by returning multiple results with a warning.
- Module proximity may be used only as a weak tie-breaker among otherwise equivalent results.

## ADR 0021: Consulting Trigger Is Agent Discretion

The consulting skill does not prescribe when every coding workflow must use the catalog. Agents decide whether to invoke `tool-catalog-consult` based on their task, project context, and need for reuse guidance.

Consequences:

- The consulting skill defines how to query and verify catalog results once invoked.
- Coding workflows are not forced to run catalog lookup for every task.

## ADR 0022: Consult Before Coding With Progressive Verification

When invoked, the consulting skill identifies the project index, inspects the Capability Tag Vocabulary when the task involves reusable utilities or templates, maps the task to canonical tags, queries results, inspects or verifies relevant entries, reads source anchors, and only then uses confirmed utilities or templates in code. If the task names an exact catalog selector, class, or method, the skill may skip tag vocabulary lookup and go directly to show or verify.

Consequences:

- Catalog results are navigation aids, not authoritative replacements for source inspection.
- Missing or weak indexes are reported as discovery needs rather than triggering full discovery from consulting.
- No-result tag queries may first remap to a better canonical tag from the vocabulary, then broaden once without tag filters.
- Persistent no-result outcomes are reported as no reusable catalog entry found.
- Tag-first lookup is the default reuse path, while exact symbol lookup remains available for known entries.

## ADR 0031: Query by Goal and Code Context

Catalog queries use a goal description plus optional current file, language, framework, artifact type, and result limit. The current file helps infer module and framework context, while the goal drives functional matching.

Consequences:

- Query input stays compact enough for agents to generate reliably.
- Agents can progressively refine results by adding filters.
