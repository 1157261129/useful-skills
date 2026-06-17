---
name: spring-architecture-review
description: Reviews Spring or Java application architecture for package structure, module boundaries, dependency direction, layering, and framework coupling. Use when reviewing Spring project structure, clean or hexagonal architecture, package organization, module ownership, or cross-layer dependency changes.
---

# Spring Architecture Review

Review Java/Spring macro structure before local code style. Focus on ownership, boundaries, and dependency direction.

## Workflow

1. Map modules, packages, layers, entrypoints, domain code, infrastructure code, and shared utilities.
2. Identify intended architecture from README, ADRs, package names, build modules, and existing conventions.
3. Check changed code against the existing architecture before recommending new patterns.
4. Prefer minimal moves or dependency fixes over broad rewrites.

## Checks

- Package layout communicates ownership: by feature/domain where project already favors it, by layer only when established.
- Dependencies point inward or downward according to the chosen architecture.
- Cyclic dependencies between packages, modules, or Maven artifacts are treated as architecture bugs.
- Domain/application code does not depend on controllers, persistence adapters, web DTOs, or framework-only classes unless the project already accepts that coupling.
- Controllers delegate orchestration and do not contain business rules.
- Services/use cases do not leak transport concerns or ORM-specific details across boundaries.
- Repositories/adapters hide persistence details behind existing project contracts.
- Shared utilities are cohesive, named by responsibility, and not a dumping ground.
- Large mixed-purpose packages, god services, and catch-all `common` modules are flagged with concrete split points.
- Anemic domain models are flagged only when behavior clearly belongs with domain state in this project style.
- Modules expose narrow APIs and avoid cyclic dependencies.
- Configuration, bootstrapping, and infrastructure stay outside core business logic.
- Tests enforce or at least reflect critical module boundaries.

## Output

Use concrete paths and dependency evidence.

```text
[severity] [file/package]: [boundary issue]
Why it matters: [architecture impact]
Minimal fix: [move, invert dependency, rename package, or introduce existing abstraction]
```

See [EXAMPLES.md](EXAMPLES.md) for Java/Spring architecture examples.
