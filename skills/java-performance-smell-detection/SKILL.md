---
name: java-performance-smell-detection
description: Detects Java code-level performance smells in strings, streams, boxing, regex, collections, allocation, caching, and hot-path control flow. Use when reviewing Java performance, latency, memory churn, CPU hotspots, or Java code that processes large volumes; measure before optimizing.
---

# Java Performance Smell Detection

Find plausible Java performance risks, then require measurement before invasive optimization.

## Workflow

1. Identify hot paths, data size, call frequency, latency budget, and allocation pressure.
2. Prefer profiler, benchmark, logs, metrics, or production evidence.
3. Flag low-risk improvements separately from changes that trade readability for speed.
4. Do not optimize cold code without evidence.

## Checks

- String concatenation in loops uses `StringBuilder` or equivalent.
- Simple non-loop string concatenation is not flagged as a problem without measurement.
- Regex patterns in repeated paths are precompiled.
- Streams do not add avoidable overhead in tight loops, primitive-heavy paths, or side-effecting code.
- Primitive streams are considered for numeric hot paths to avoid boxing churn.
- Boxing/unboxing is avoided in numeric hot paths when primitive alternatives are practical.
- Collections use appropriate type and capacity for expected size and access pattern.
- Nested loops over large collections use maps/sets or indexed lookups when semantics allow.
- Expensive objects are not repeatedly allocated in high-frequency paths.
- Caches have bounds, invalidation, and concurrency strategy.
- `String.format`, locale-aware formatting, and reflection are reviewed carefully inside hot paths.
- I/O, DB, network, and serialization costs are not hidden inside loops.
- Parallelism is justified by workload size and executor behavior.
- Do not recommend readability-reducing micro-optimizations for cold paths.

## Output

Classify each item as measured issue, likely hotspot risk, or minor cleanup. Include suggested measurement when evidence is missing.

See [EXAMPLES.md](EXAMPLES.md) for Java performance smell examples.
