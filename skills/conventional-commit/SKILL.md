---
name: conventional-commit
description: Drafts and validates Git commit messages that follow the Conventional Commits specification. Use when writing, reviewing, or fixing commit messages; choosing types or scopes; marking breaking changes; adding bodies or issue footers.
---

# Conventional Commit

Use this skill to produce concise, accurate Conventional Commit messages.
Derive the message from the actual diff, issue, or user-provided summary.
If the change mixes unrelated work, recommend separate commits before drafting one broad message.

## Core Format

```text
type(scope): description
type: description
type(scope)!: description
```

Rules:

- `type` and `description` are required.
- `scope` is optional; use it only when it clarifies the changed area.
- `!` marks a breaking change and must not be used for ordinary changes.
- Keep the description specific, imperative, and free of a trailing period.
- Prefer one logical change per commit.

## Type Reference

Use repository-specific types when they exist. Otherwise use this common set:

| Type | When to use | Example |
|------|-------------|---------|
| `feat` | User-facing feature or capability | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(api): handle empty user response` |
| `refactor` | Code change without behavior change | `refactor(db): extract query builder` |
| `perf` | Performance improvement | `perf(search): add email lookup index` |
| `docs` | Documentation only | `docs: update API examples` |
| `test` | Tests only | `test(auth): cover token refresh` |
| `style` | Formatting only | `style: format source files` |
| `build` | Build system or dependency packaging | `build: switch to hatch` |
| `ci` | CI configuration or automation | `ci: add Python 3.12 job` |
| `chore` | Maintenance that does not fit other types | `chore: update lockfile` |
| `revert` | Revert a prior commit | `revert: revert "feat(auth): add OAuth2 login"` |

## Body and Footers

Add a body when the header does not explain the rationale, impact, or main
implementation details. Separate the header, body, and footers with blank lines.

```text
feat(auth): add JWT authentication

- Add login and registration endpoints
- Store passwords with argon2 hashing
- Protect authenticated routes with middleware

Closes #42
```

Footer guidance:

- Use `Closes #42` or `Fixes #42` when merging should close the issue.
- Use `Refs #42` when the commit only relates to the issue.
- Use `Co-authored-by: Name <email>` for co-authored work.

## Breaking Changes

Mark breaking changes only when consumers must change usage, configuration, or
integration code.

Use `!` in the header for visibility. Add a `BREAKING CHANGE:` footer when
migration context is useful.

```text
feat(api)!: require bearer tokens

BREAKING CHANGE: API clients must send an Authorization: Bearer header instead
of the previous X-API-Key header.
```

## Drafting Workflow

1. Inspect the diff, issue, or user-provided change summary.
2. Choose the narrowest accurate type.
3. Add a scope only if it improves clarity.
4. Write a short, imperative description.
5. Add a body for non-obvious rationale or impact.
6. Add breaking-change and issue footers when required.

## Verification Checklist

- [ ] Header follows `type(scope): description`, `type: description`, or `type(scope)!: description`
- [ ] Commit type matches the actual nature of the change
- [ ] Scope is short and meaningful, or omitted
- [ ] Description is concise, imperative, and specific
- [ ] Body explains non-obvious context when needed
- [ ] Breaking change marker is present only when required
- [ ] Issue footer closes or references issues intentionally
