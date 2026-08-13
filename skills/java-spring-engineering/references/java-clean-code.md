# Java Clean Code

Improve Java clarity with minimal behavior change. Preserve public APIs unless user asks otherwise.

## Workflow

1. Understand existing behavior, tests, and local style before editing.
2. Remove accidental complexity before adding abstractions.
3. Keep changes small, behavior-preserving, and easy to review.
4. Add tests only when refactor risk or missing coverage justifies it.

## Principles

- KISS: choose straightforward control flow over clever composition.
- YAGNI: remove unused extension points, speculative interfaces, and future-only options.
- DRY: remove meaningful duplication; keep duplication when abstraction would hide important differences.
- Single responsibility: give each class/method one clear reason to change.
- Local consistency beats generic best-practice churn.
- Prefer guard clauses when they reduce nesting and expose the normal path.

## Checks

- Names reveal domain meaning and avoid vague terms like `data`, `info`, `manager`, or `helper` when a precise name exists.
- Methods are short enough to scan and avoid mixed abstraction levels.
- Branching is simplified with guard clauses where it improves readability.
- Parameters are limited; related arguments become existing DTO/value types only when that matches project style.
- Boolean flags do not hide multiple behaviors in one method.
- Repeated validation, mapping, or query fragments are extracted only when the abstraction has a clear owner.
- Comments explain intent, constraints, or non-obvious tradeoffs; obvious narration is removed.
- Magic values become named constants when they carry domain meaning.
- Primitive obsession is replaced with domain value types only when validation or behavior repeats.
- Null handling is explicit and consistent with project conventions.
- Exceptions preserve context without swallowing causes.
- Refactors do not alter logs, metrics, transactions, or security behavior unintentionally.

## Output

When reviewing, separate required fixes from optional readability improvements.

See [java-clean-code-examples.md](java-clean-code-examples.md) for Java clean-code examples.
