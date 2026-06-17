---
name: java-concurrency-review
description: Reviews Java or Spring concurrency for thread safety, race conditions, deadlocks, async boundaries, executor use, virtual threads, and CompletableFuture behavior. Use when Java/Spring code uses threads, locks, shared mutable state, @Async, schedulers, CompletableFuture, parallel streams, or virtual threads.
---

# Java Concurrency Review

Treat Java/Spring concurrency bugs as correctness issues first. Prefer evidence, simple ownership, and bounded execution.

## Workflow

1. Identify shared mutable state, thread boundaries, executors, locks, caches, transactions, and request/security context propagation.
2. Determine which code may run concurrently and which invariants must hold.
3. Check for correctness before performance tuning.
4. Recommend simpler synchronization or ownership changes before broad async rewrites.

## Checks

- Shared mutable state is confined, immutable, synchronized, or backed by concurrent structures.
- Check-then-act operations are atomic where required.
- Visibility is guaranteed with synchronization, volatile, final fields, or thread-safe containers.
- Locks use consistent ordering and do not call external code while held.
- Executors are bounded or deliberately virtual-thread based; blocking work is not placed on small CPU pools.
- `@Async` methods are public, called through Spring proxy, and use an explicit executor when load matters.
- `@EnableAsync` is present when Spring async behavior is expected.
- Self-invocation does not bypass `@Async`, `@Transactional`, or other proxy-based behavior.
- Security, locale, MDC, transaction, and request context are propagated only when needed and cleared after use.
- `CompletableFuture` chains handle exceptions, timeouts, cancellation, and executor choice.
- `CompletableFuture.allOf` and composed futures do not drop individual failures or results.
- Virtual threads are used for blocking I/O, not as a shortcut for CPU-bound parallelism.
- Parallel streams are not used for blocking work, small collections, or code with side effects.
- `ThreadLocal` usage is reviewed carefully with pools, virtual threads, and request reuse.
- Tests or stress checks cover high-risk race paths when feasible.

## Output

Classify as likely bug, load risk, or maintainability risk. Include the interleaving or thread path when reporting a race.

See [EXAMPLES.md](EXAMPLES.md) for Java/Spring concurrency examples.
