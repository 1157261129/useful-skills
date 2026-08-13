---
name: java-spring-engineering
description: Provides progressive Java and Spring engineering guidance for implementation, refactoring, review, testing, concurrency, performance, architecture, REST contracts, and security. Use for Java or Spring tasks when the user does not explicitly invoke a compatibility alias.
---

# Java/Spring Engineering

Use progressive disclosure so the task gets the smallest relevant guidance.

## Workflow

1. Inspect the changed code, project conventions, tests, and public boundaries before choosing guidance.
2. Select one primary reference from the routing table below.
3. Read an additional specialist reference only when the code or request clearly crosses that concern.
4. Read the matching examples file only when an example, implementation pattern, or output format needs clarification.
5. Preserve behavior, public APIs, security controls, transaction boundaries, and existing project conventions unless the user requests a change.

## Routing

| Task signal | Primary reference |
| --- | --- |
| Task signal | Primary reference | Examples when needed |
| --- | --- | --- |
| General Java/Spring review or pre-merge review | [java-code-review](references/java-code-review.md) | [examples](references/java-code-review-examples.md) |
| Readability, naming, focused refactoring, or complexity reduction | [java-clean-code](references/java-clean-code.md) | [examples](references/java-clean-code-examples.md) |
| Threads, locks, async work, schedulers, or shared state | [java-concurrency-review](references/java-concurrency-review.md) | [examples](references/java-concurrency-review-examples.md) |
| Latency, allocation, memory churn, CPU hotspots, or large-volume processing | [java-performance-smell-detection](references/java-performance-smell-detection.md) | [examples](references/java-performance-smell-detection-examples.md) |
| JUnit, Mockito, fixtures, coverage, or test design | [java-test-quality](references/java-test-quality.md) | [examples](references/java-test-quality-examples.md) |
| Controllers, services, repositories, DTOs, validation, configuration, or transactions | [spring-boot-patterns](references/spring-boot-patterns.md) | [examples](references/spring-boot-patterns-examples.md) |
| Package structure, module boundaries, layering, or dependency direction | [spring-architecture-review](references/spring-architecture-review.md) | [examples](references/spring-architecture-review-examples.md) |
| REST methods, status codes, versioning, pagination, or compatibility | [spring-contract-review](references/spring-contract-review.md) | [examples](references/spring-contract-review-examples.md) |
| Authentication, authorization, injection, secrets, deserialization, or OWASP risks | [spring-security-audit](references/spring-security-audit.md) | [examples](references/spring-security-audit-examples.md) |

## Loading Rules

- Start with one primary reference; do not load every reference by default.
- Add `java-code-review` for a broad review when a specialist review is also needed.
- Add `spring-boot-patterns` when a Spring implementation concern is present alongside an API, architecture, or security concern.
- Add `java-test-quality` only when tests are changed, missing coverage is part of the risk, or test design is requested.
- Add performance or concurrency guidance only when code evidence supports the concern; do not infer a hotspot from style alone.
- Read a `*-examples.md` file only for the selected concern and only when examples materially help.

## Universal Guardrails

- Report correctness, security, data-loss, and compatibility risks before style suggestions.
- Use evidence from code, tests, configuration, and runtime boundaries; distinguish measured issues from hypotheses.
- Prefer the smallest behavior-preserving fix that matches existing ownership and layering.
- Preserve exception causes, useful logging context, validation, authorization, transaction semantics, and resource ownership.
- Keep generated code, framework conventions, and language-level assumptions aligned with the project.

## Output

For implementation or refactoring, state the behavior preserved or changed and the focused verification performed.

For review or audit, lead with actionable findings ordered by severity, including location, impact, and minimal fix. Mention residual test or runtime risk when no findings remain.
