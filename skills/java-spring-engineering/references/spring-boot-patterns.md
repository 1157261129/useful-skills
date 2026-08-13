# Spring Boot Patterns

Follow the project's existing Java/Spring Boot layering first. Keep framework concerns in the appropriate boundary.

## Workflow

1. Identify existing controller, service, repository, DTO, exception, config, and test conventions.
2. Place new behavior in the current owner rather than creating parallel structure.
3. Preserve public API, transaction boundaries, validation behavior, and error shape.
4. Add focused tests for changed web, service, or persistence behavior.

## Checks

- Controllers validate input, map HTTP concerns, and delegate business logic.
- Services/use cases own business rules and transactions.
- Repositories encapsulate persistence queries and avoid leaking entity internals unnecessarily.
- DTOs separate API payloads from entities.
- Validation uses Bean Validation and explicit service checks where needed.
- Exceptions map through existing global handling and do not expose internals.
- Configuration uses typed properties for non-trivial settings.
- Transactions are placed at service boundaries and avoid remote calls inside long transactions.
- Constructor injection is used; field injection is avoided.
- Tests match scope: slice tests for web/persistence, unit tests for service rules, integration tests for wiring or DB behavior.
- Request/response mapping follows existing mapper style, such as manual mapping or MapStruct.
- `@Transactional` is not placed on controllers and is not relied on across self-invocation.
- Profiles and configuration properties have defaults, validation, and environment-specific overrides where needed.
- Repository queries are explicit when derived method names become ambiguous or too long.

## Output

When generating code, match existing package names, annotations, Lombok usage, response types, and test style. When reviewing, report behavioral risks before style.

See [spring-boot-patterns-examples.md](spring-boot-patterns-examples.md) for Spring Boot examples.
