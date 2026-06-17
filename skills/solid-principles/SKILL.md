---
name: solid-principles
description: Reviews and applies SOLID principles in Java class design, responsibilities, extension points, substitutability, interfaces, and dependency direction. Use when checking SOLID in Java code, refactoring large Java classes, reviewing object design, or evaluating SRP, OCP, LSP, ISP, or DIP concerns.
---

# SOLID Principles

Use SOLID on Java class design as a diagnostic tool, not a reason to add abstractions automatically.

## Workflow

1. Identify class responsibilities, collaborators, variants, and reasons to change.
2. Check current project style before introducing interfaces or inheritance.
3. Prefer simpler extraction, composition, or naming fixes before pattern-heavy changes.
4. Preserve behavior and public API unless migration is explicit.

## Checks

- SRP: class has one cohesive responsibility and one primary reason to change.
- OCP: new variants do not require editing central conditional logic when extension is a real requirement.
- LSP: subclasses preserve base contracts, invariants, exceptions, and return expectations.
- ISP: clients do not depend on methods they cannot use or implement meaningfully.
- DIP: high-level policy depends on abstractions or stable ports when multiple implementations or test seams exist.
- Interfaces are not added for a single implementation unless required by framework, API boundary, or explicit extension plan.
- Composition is preferred over inheritance for optional behavior.
- Constructors expose required dependencies and avoid hidden global state.
- Spring DI is not treated as DIP by itself; dependency direction and policy ownership still matter.
- LSP issues include methods that throw unsupported exceptions for valid base-type calls.
- ISP issues include broad service interfaces implemented only partially by consumers.
- Tests prove behavior across variants and contract boundaries.

## Output

Name the violated principle only after explaining concrete harm.

```text
[principle] [file:line]: [design problem]
Impact: [change risk/testability/correctness]
Fix: [minimal refactor]
```

See [EXAMPLES.md](EXAMPLES.md) for Java SOLID examples.
