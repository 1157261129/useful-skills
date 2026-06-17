---
name: java-design-patterns
description: Applies Java design patterns pragmatically, including Builder, Factory, Strategy, Observer, Template Method, Decorator, and Adapter. Use when designing Java components, removing Java conditionals, introducing object creation policies, or when user requests a Java-specific pattern.
---

# Java Design Patterns

Use Java patterns to reduce real complexity, not to decorate simple code. Prefer existing project idioms.

## Workflow

1. State the design pressure: object creation, algorithm variation, event notification, behavior extension, API compatibility, or duplication.
2. Check whether a simpler method, enum, function, or existing abstraction solves it.
3. Choose the smallest pattern that removes the pressure without hiding domain logic.
4. Keep naming domain-specific; avoid pattern names in class names unless the project already does so.

## Pattern Selection

- Builder: many optional construction inputs or readable test fixtures.
- Factory: creation requires policy, environment, subtype selection, or hidden dependencies.
- Strategy: interchangeable algorithms selected at runtime or by configuration.
- Template Method: stable algorithm skeleton with controlled subclass steps.
- Observer/Event: multiple independent reactions to a domain event.
- Decorator: optional behavior around the same interface without subclass explosion.
- Adapter: integrate incompatible external API without leaking it inward.
- Singleton: avoid for mutable state, hidden dependencies, tests, and application services already managed by Spring.

## Checks

- Pattern has at least two real variants or an explicit extension requirement.
- Abstraction reduces branching, duplication, or coupling.
- Interfaces are not single-use pass-through wrappers.
- Domain language remains visible.
- Factories do not become service locators.
- Strategies do not hide one-line conditionals behind unnecessary class hierarchies.
- Adapters stay at integration boundaries and do not leak external models into domain code.
- Tests cover each variation and default path.
- Public API compatibility is preserved unless migration is explicit.

## Output

Explain why the chosen pattern is necessary, what simpler option was rejected, and what code owns the extension point.

See [EXAMPLES.md](EXAMPLES.md) for Java pattern examples.
