---
name: spring-contract-review
description: Reviews Spring REST API contracts for HTTP semantics, versioning, compatibility, DTO boundaries, status codes, and error formats. Use when reviewing Spring controllers, Java/Spring API endpoints, OpenAPI specs, release readiness, or backward compatibility risk.
---

# Spring Contract Review

Review Java/Spring API behavior as a public contract. Prioritize compatibility, predictable semantics, and client usability.

## Workflow

1. Identify changed endpoints, methods, request bodies, response bodies, status codes, headers, pagination, and auth requirements.
2. Compare new behavior with existing clients, docs, tests, and OpenAPI contracts when present.
3. Flag only actionable contract risks. Avoid subjective style comments unless they affect interoperability.
4. Classify findings as breaking, risky, inconsistent, or documentation-only.

## Checks

- HTTP verbs match intent: `GET` reads, `POST` creates/actions, `PUT` replaces, `PATCH` partially updates, `DELETE` deletes.
- URLs use stable nouns and avoid implementation terms, verbs for CRUD, or ambiguous nested resources.
- Request DTOs are explicit, validated, and not persistence entities.
- Response DTOs are stable, minimal, and consistent across list/detail/create/update endpoints.
- API responses never return HTTP 200 with an error body for failed operations.
- Status codes distinguish success, validation failure, auth failure, conflicts, not found, and server errors.
- Error responses use one consistent shape with code, message, details, trace/correlation id when available, and no internal stack traces.
- Pagination, sorting, filtering, and empty results have documented behavior.
- Versioning strategy is consistent: path, header, or media type is not mixed without reason.
- Versioning and deprecation strategy are explicit for breaking changes.
- New fields are additive and optional where possible; removed or renamed fields are treated as breaking.
- Deprecations include replacement endpoint/field, migration window, and documentation update.
- Security-sensitive fields are never returned unless explicitly required.

## Output

Report findings first, ordered by client impact.

```text
[severity] [endpoint/method]: [contract risk]
Impact: [which clients or behavior break]
Fix: [minimal compatible change]
```

See [EXAMPLES.md](EXAMPLES.md) for Java/Spring API contract examples.
