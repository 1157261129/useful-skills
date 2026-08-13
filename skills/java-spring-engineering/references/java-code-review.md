# Java Code Review

Review Java/Spring code for defects first, then maintainability. Findings must be concrete and tied to code.

## Workflow

1. Understand intent, changed surface area, and tests.
2. Inspect behavior, error paths, integration contracts, and backward compatibility.
3. Report only actionable issues.
4. Keep summaries short and after findings.

## Checks

- Nullability assumptions are explicit; public boundaries validate inputs.
- Exceptions preserve cause, context, and correct abstraction level.
- Collections and streams avoid unintended mutation, ordering assumptions, side effects, or expensive repeated work.
- Resources use try-with-resources or lifecycle-managed ownership.
- Public APIs have stable names, types, validation, and compatibility.
- Java idioms fit the active language level without forcing migrations unrelated to the diff.
- Concurrency-sensitive code avoids unsafe shared state and ambiguous executor behavior.
- Logging uses placeholders, avoids secrets, and records useful context.
- Transactions, retries, caching, and idempotency are correct where applicable.
- Performance concerns are tied to hot paths, data volume, or measurable risk.
- Tests cover normal path, edge cases, failure path, and integration contracts affected by the diff.
- Findings use severity based on runtime impact: correctness/security/data loss before style.
- Positive observations are optional and never replace actionable findings.

## Output

Lead with findings ordered by severity.

```text
[severity] [file:line]: [issue]
Impact: [runtime/user/API effect]
Fix: [minimal change]
```

If no issues: say so and mention residual test or runtime risks.

See [java-code-review-examples.md](java-code-review-examples.md) for Java code review examples.
