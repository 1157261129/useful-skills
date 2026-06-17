---
name: spring-security-audit
description: Audits Spring or Java application security across validation, injection, authn/authz, secrets, deserialization, dependencies, headers, CSRF, XSS, and logging. Use when reviewing Spring security-sensitive code, vulnerabilities, OWASP risks, release readiness, or authentication and authorization changes.
---

# Spring Security Audit

Review exploitable Java/Spring behavior and data exposure. Do not include secrets in prompts, logs, tests, or examples.

## Workflow

1. Identify trust boundaries: HTTP, messaging, files, DB, external services, config, and admin paths.
2. Trace untrusted input through validation, authorization, persistence, output, and logging.
3. Prioritize findings by exploitability and impact.
4. Recommend minimal fixes and required tests.

## Checks

- Inputs use allowlist validation and type constraints at public boundaries.
- SQL/JPQL/native queries use parameters, not string concatenation.
- Native queries, dynamic sort fields, and search filters validate identifiers separately from values.
- Output encoding and content type prevent XSS where applicable.
- Content Security Policy and security headers are checked when the app serves browser-facing content.
- CSRF protection matches auth mechanism and browser exposure.
- Authentication verifies credentials safely and never logs secrets.
- Authorization is enforced server-side for object, tenant, role, and ownership checks.
- Password storage uses a dedicated password hashing algorithm, not general-purpose hashes.
- Secrets are not hardcoded, committed, logged, or returned in API responses.
- Deserialization avoids unsafe polymorphic or native Java serialization of untrusted data.
- Jackson polymorphic typing and default typing are reviewed as deserialization risk.
- Dependencies and plugins are checked for known vulnerabilities.
- Security headers and TLS assumptions are explicit at the right layer.
- Error handling avoids stack traces and internal implementation details in client responses.
- Security events log enough context for investigation without leaking sensitive data.

## Output

Use severity, exploit path, impact, and minimal fix.

```text
[severity] [file:line]: [security issue]
Exploit path: [input -> vulnerable operation -> impact]
Fix: [specific control]
```

See [EXAMPLES.md](EXAMPLES.md) for Java/Spring security examples.
