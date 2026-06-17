---
name: java-test-quality
description: Improves Java test quality with JUnit 5, AssertJ, Mockito, fixtures, parameterized tests, integration scope, coverage judgment, and maintainable assertions. Use when adding Java tests, reviewing Java test classes, improving Java coverage, or designing Java unit and integration tests.
---

# Java Test Quality

Make Java tests prove behavior, not mirror implementation. Prefer clear failure messages and stable fixtures.

## Workflow

1. Identify behavior, edge cases, failure paths, and integration contracts affected by the change.
2. Choose the smallest test scope that catches the risk.
3. Use project-standard test libraries and naming.
4. Keep tests deterministic, isolated, and readable.

## Checks

- Test names describe scenario and expected behavior.
- Arrange/Act/Assert structure is visible.
- AssertJ assertions are specific and compare meaningful fields.
- Exceptions are asserted with type, message or important context, and side effects when relevant.
- Mocks verify externally visible collaboration only; avoid overspecifying internal calls.
- Fixtures are minimal and named by intent.
- Parameterized tests cover meaningful input partitions.
- Nested tests group behavior only when they improve scanability.
- Use soft assertions when multiple independent facts need one combined failure report.
- Tests avoid sleeps, shared mutable state, real clocks, random data without seed, and environment dependence.
- Integration tests cover wiring, persistence mapping, serialization, transactions, and external boundaries where unit tests cannot.
- Coverage targets business rules and risk, not line count alone.
- Mutation-prone business rules get explicit boundary and negative tests.
- Coverage config excludes generated code only when the project convention already allows it.

## Output

When adding tests, include normal path, edge path, and failure path if relevant. When reviewing, distinguish missing coverage from brittle or low-value tests.

See [EXAMPLES.md](EXAMPLES.md) for Java test examples.
