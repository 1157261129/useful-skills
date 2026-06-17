---
name: prepare-dispatch-constraints
description: Prepares concise per-issue Dispatch Constraints for worker issue execution by reading only issue-relevant CONTEXT.md, ADRs, and current user instructions. Use when `execute-issues` is dispatching requested issues that lack a reusable Dispatch Constraints block or need an explicitly allowed refresh.
---

# Prepare Dispatch Constraints

Use this skill before dispatching issue workers when one or more requested issues do not already contain `Dispatch Constraints` in their shared channel.

The goal is to give each worker the minimum project and discussion constraints needed for its issue without pushing unrelated context into the worker brief.

## Inputs

- Require explicit issue paths, issue numbers, or issue references.
- Use issue `## Comments` as the default shared channel unless the user provides a different status file or memory key.
- Read only the requested issue files first.

## Skip Rules

- If an issue already contains a `Dispatch Constraints` block in its shared channel, do not regenerate, refresh, rewrite, or append a duplicate unless the refresh conditions below are met.
- Prepare constraints only for requested issues that lack the block.
- Do not scan whole issue directories or unrelated docs by default.
- Treat existing constraints as cached instructions. Do not infer staleness from age, issue size, or changed surrounding discussion.
- Refresh existing constraints only when the user explicitly asks for refresh/rebuild, the existing block is explicitly marked `stale`, `superseded`, or `invalid`, or a worker reports concrete conflicts with exact anchors.
- If refresh is allowed, replace the existing block when editing is available. If the shared channel is append-only, append one clearly labeled refresh block and state that it supersedes the old block.

## Workflow

For each issue that lacks constraints or meets a refresh condition:

1. Read the issue title, acceptance criteria, touched subsystem hints, and `Blocked by` section.
2. Ensure the issue has a `## Comments` section; create it if missing.
3. Inspect the target repository's `CONTEXT.md` only if it exists. Extract only issue-relevant rules and cite each with a `path:line` anchor.
4. Inspect the minimum relevant files under `docs/adr/` only when the issue, subsystem, or `CONTEXT.md` points to them. Cite each reused rule with a `path:line` anchor.
5. Distill current user instructions into issue-specific constraints. Preserve file anchors when an instruction comes from a local file.
6. Write one short `Dispatch Constraints` block with preparation metadata. For allowed refreshes, replace the old block when possible; otherwise append one clearly labeled superseding refresh block.

## Block Format

Keep the block imperative and concise:

```markdown
### Dispatch Constraints

- Prepared: YYYY-MM-DD
- Scope: [issue path or identifier]
- Sources checked: `CONTEXT.md`, `docs/adr/...`, current user instructions
- CONTEXT.md: [rule summary] (`CONTEXT.md:12`)
- docs/adr: [rule summary] (`docs/adr/0001-example.md:8`)
- Discussion: [user/session rule summary]
```

If a source is absent or has no relevant rule, record that explicitly:

```markdown
### Dispatch Constraints

- Prepared: YYYY-MM-DD
- Scope: [issue path or identifier]
- Sources checked: `CONTEXT.md`, `docs/adr/`, current user instructions
- CONTEXT.md: not found.
- docs/adr: no relevant ADR found.
- Discussion: no additional issue-specific constraints.
```

## Output

- Report which issues already had constraints and were skipped.
- Report which issues received new constraints.
- Do not start worker implementation. Return control to `execute-issues` for dispatch.
