# Skill, CLI, and Output Contract Decisions

This file consolidates the skill and CLI contract ADRs that previously lived as ADR 0003, 0007, 0008, 0009, 0010, 0011, 0013, and 0037.

## ADR 0003: Separate Discovery and Consulting Skills

The tool catalog uses two skills with different responsibilities: the discovery skill updates the project index, while the consulting skill reads the existing index during coding workflows. This keeps expensive or mutating discovery work out of ordinary implementation flow and lets agents treat consulting results as focused reuse guidance.

Consequences:

- The consulting skill does not perform full-project discovery by default.
- Shared CLI commands may support both workflows, but the skill contracts remain separate.
- The consulting skill is strictly read-only in the first version; stale entries are repaired through discovery.

## ADR 0007: Install Two Skills With One Shared CLI

The tool catalog is distributed as `tool-catalog-discover`, `tool-catalog-consult`, and one shared CLI directory. The sync script installs both skills and one CLI copy per agent root so each agent surface can run the tool without duplicating command code inside each skill.

Consequences:

- The sync script must install shared tools in addition to skill directories.
- Skill instructions reference the shared CLI rather than embedding separate CLI copies.
- CLI copies installed for different agent roots read and write the same `~/.tool-catalog/` database root.

## ADR 0008: Implement the CLI as Node.js ESM Without a Build Step

The shared Tool Catalog CLI is implemented as Node.js ESM JavaScript and runs directly without a TypeScript compilation step. This keeps skill installation simple while still fitting TypeScript, JavaScript, and Vue file scanning.

Consequences:

- The CLI source is executable JavaScript, not generated build output.
- Heavy parser dependencies are avoided in the first version unless a detector proves they are necessary.

## ADR 0009: Keep the Initial CLI Command Surface Minimal

The initial Tool Catalog CLI command surface was later extended by ADR 0040 to include `tags`, and retains `doctor` as a diagnostic command. Discovery owns index updates, query and show support consulting, verify checks indexed references, config stores project identity and utility origin priorities, and tags exposes the read-only Capability Tag Vocabulary.

Consequences:

- Pruning is part of discovery rather than a separate first-version command.
- Export, import, daemon, and watch modes are outside the first version.

## ADR 0010: Return Compact Markdown With a JSON Option

The Tool Catalog CLI returns compact Markdown by default so agents can read query and show results directly. It also supports JSON output for automation, but skill workflows use Markdown unless they need structured integration.

Consequences:

- Results include fully qualified names or equivalent identifiers, concise usage notes, minimal examples, and file anchors.
- Template code results include representative snippets and references, not long pasted code blocks.

## ADR 0011: Use English for Catalog Prose

Generated catalog descriptions, usage notes, limitations, capability tags, and Markdown query output use concise professional English. Source identifiers remain unchanged, and JSON field names and CLI arguments are also English.

Consequences:

- Catalog entries remain portable across projects and agents.
- User-facing conversation may be in Chinese, but stored catalog prose is English.
- Agents may map Chinese user intent to English canonical tags during consulting.

## ADR 0013: Keep LLM Reasoning in Skills, Not the CLI

The Tool Catalog CLI performs deterministic scanning, storage, querying, and verification. Semantic classification, false-positive filtering, English catalog prose, and user-facing priority questions are handled by the agent running the discovery or consulting skill.

Consequences:

- The CLI has no model key, model provider, or LLM retry dependency.
- Skills pass structured accepted entries back to the CLI for persistence.

## ADR 0037: Test the CLI With Fixtures and Skill Static Checks

The Tool Catalog CLI is tested against fixture projects for Java, Vue, external utility usage, and recurring template patterns. Skill Markdown files are checked statically for frontmatter, naming, required workflow steps, and CLI command consistency.

Consequences:

- Discovery and consulting behavior can be verified without scanning real user projects in tests.
- Skill documentation stays aligned with the CLI command contract.
