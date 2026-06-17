---
name: spring-logging-patterns
description: Guides Spring or Java bilingual Chinese-English logging with SLF4J, structured fields, log levels, MDC, request correlation, and safe exception logging. Use when adding Spring logs, improving observability, debugging flow from logs, reviewing logging quality, or preventing secret leakage.
---

# Spring Logging Patterns

Make Java/Spring logs explain production behavior in Chinese and English without exposing secrets or creating noise.

## Workflow

1. Identify the diagnostic question the log must answer.
2. Place logs at boundaries, state changes, external calls, and failure handling.
3. Choose level and fields before adding bilingual Chinese-English message text.
4. Verify logs do not duplicate exception reporting or leak sensitive data.

## Checks

- Use SLF4J placeholders: `log.info("订单已创建 | Order created orderId={}", orderId)`.
- Write log message text in Chinese and English, using one stable message template per event.
- Do not concatenate log strings or eagerly serialize expensive objects.
- Use `ERROR` for failures requiring attention, `WARN` for degraded or unexpected recoverable behavior, `INFO` for business milestones, `DEBUG/TRACE` for local diagnostics.
- Include stable identifiers: request id, correlation id, user/account id when safe, entity id, external system, duration, result.
- Exclude secrets, tokens, passwords, credentials, PII unless explicitly approved and masked.
- Log exceptions once at the ownership boundary with stack trace and useful context.
- Preserve MDC across async boundaries only when needed and clear it after use.
- Use consistent English field names for structured JSON logs across services.
- Prefer structured fields over parsing message text for request tracing and external-call timing.
- Record start/end or duration for slow external calls, jobs, and retries.
- Avoid logging both at catch-and-rethrow sites and at global handlers unless each log adds different context.
- High-volume logs are sampled, debug-level, or guarded by conditions.
- Tests or docs cover critical audit/security logging when required.

## Output

For code changes, include exact log level, message template, fields, and reason. For review, flag missing, noisy, unsafe, or misleading logs.

See [EXAMPLES.md](EXAMPLES.md) for Java/Spring logging examples.
