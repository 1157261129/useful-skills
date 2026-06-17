---
name: maven-dependency-audit
description: Audits Java Maven dependencies for outdated versions, vulnerabilities, unused dependencies, transitive conflicts, plugin drift, and release risk. Use when checking Java `pom.xml` files, Maven dependency trees, Dependabot alerts, CVEs, Maven plugin updates, or pre-release dependency health.
---

# Maven Dependency Audit

Audit Java Maven dependencies conservatively. Prefer security and compatibility over latest-version churn.

## Workflow

1. Inspect `pom.xml`, parent BOMs, dependency management, plugins, repositories, and build profiles.
2. Run narrow Maven commands when available; do not invent results if commands cannot run.
3. Separate security fixes, patch/minor upgrades, major migrations, conflicts, and cleanup.
4. Recommend smallest safe changes first.

## Useful Commands

```bash
mvn versions:display-dependency-updates
mvn versions:display-plugin-updates
mvn dependency:tree
mvn dependency:analyze
mvn org.owasp:dependency-check-maven:check
```

## Checks

- Vulnerable dependencies have fixed versions or documented mitigations.
- BOM-managed versions are not overridden without reason.
- Transitive conflicts resolve to expected versions.
- Unused direct dependencies are removed only after confirming reflection, annotation processing, runtime loading, or plugin usage.
- Major upgrades include migration notes and test scope.
- Maven plugins are updated with build compatibility in mind.
- Repositories do not include unsafe or unnecessary external sources.
- Scopes (`compile`, `runtime`, `test`, `provided`, `optional`) match usage.
- License or policy constraints are noted when visible.
- Patch and security updates are separated from major framework migrations.
- Dependency exclusions include the exact parent path that pulls the transitive dependency.
- Conservative, aggressive, and selective update strategies are named when recommending upgrade batches.
- Reports identify whether evidence came from Maven output, advisory metadata, or static `pom.xml` inspection.

## Output

Group by security, conflicts, outdated dependencies, unused dependencies, and recommended next changes. Include commands run and failures.

See [EXAMPLES.md](EXAMPLES.md) for Maven audit examples.
