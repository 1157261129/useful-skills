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

The shared Tool Catalog CLI is implemented as Node.js ESM JavaScript and runs directly without a TypeScript compilation step. This keeps skill installation simple while supporting deterministic Project Index database operations.

Consequences:

- The CLI source is executable JavaScript, not generated build output.
- Heavy parser dependencies are avoided because source scanning belongs to the discovery skill.

## ADR 0009: Keep the Initial CLI Command Surface Minimal

The initial Tool Catalog CLI command surface was later extended by ADR 0040 to include `tags`, and retains `doctor` as a diagnostic command. Discovery writes through `discover --apply`, query and show support consulting, verify checks indexed project-owned source references, config stores project identity, and tags exposes the derived read-only Capability Tag Vocabulary.

Consequences:

- Pruning is part of discovery rather than a separate first-version command.
- Export, import, daemon, and watch modes are outside the first version.

## ADR 0010: Return Compact Markdown With a JSON Option

The Tool Catalog CLI returns compact Markdown by default so agents can read query and show results directly. It also supports JSON output for automation, but skill workflows use Markdown unless they need structured integration.

Consequences:

- `query` output is a ranked list, not a full entry view. Each item includes only `selector`, `kind`, `summary`, `capability_tags`, `priority`, `language`, optional `framework`, optional project-owned `module_path`, and for external selectors the origin metadata `origin_key`, `display_name`, and `usage_count`.
- `query` output must not include `source_anchor`, `usage_notes`, or `limitations`; agents use `show` before relying on details.
- `show <selector>` returns the full persisted entry. Project-owned artifact output includes `source_anchor` and may include `usage_notes` and `limitations`; external selector output includes referenced origin metadata and may include `usage_notes` and `limitations`, but never includes `source_anchor`.
- `verify <selector>` accepts only project-owned `artifact:` selectors and checks the stored source anchor against the current working tree. `verify external:...` is rejected because dependency availability and local conventions are agent checks, not CLI source-anchor checks.

## ADR 0011: Use English for Catalog Prose

Generated catalog descriptions, usage notes, limitations, capability tags, and Markdown query output use concise professional English. Source identifiers remain unchanged, and JSON field names and CLI arguments are also English.

Consequences:

- Catalog entries remain portable across projects and agents.
- User-facing conversation may be in Chinese, but stored catalog prose is English.
- Agents may map Chinese user intent to English canonical tags during consulting.

## ADR 0013: Keep Discovery Reasoning and Scanning in Skills, Not the CLI

The Tool Catalog CLI performs deterministic Project Index database operations for discovery and consulting workflows. Project scanning, semantic classification, false-positive filtering, English catalog prose, and user-facing priority questions are handled by the agent running the discovery or consulting skill.

Consequences:

- The CLI has no model key, model provider, or LLM retry dependency.
- Skills pass structured catalog records back to the CLI for validation and persistence.
- Discovery apply input is database-object shaped, not evidence shaped. The top-level Discovery Decision File keys are `project`, `artifacts`, `external_selectors`, `origins`, `suppressions`, `fingerprints`, and `removed`; `project.mode` is either `full` or `changed`.
- Discovery apply validates minimum required fields before writing: artifacts require `selector`, `language`, `artifact_type`, `summary`, `source_anchor`, `priority`, and `capability_tags`; external selectors require `selector`, `origin_key`, `language`, `summary`, and `capability_tags`; origins require `origin_key`, `origin_type`, `display_name`, `usage_count`, and `priority`; suppressions require `suppression_key`, `target_kind`, `target_key`, `reason`, and `fingerprint_key`; fingerprints require `fingerprint_key`, `target_kind`, `target_key`, and `fingerprint`.
- Origin `usage_count` is the distinct source-file count produced by discovery for a normalized external origin. The CLI validates and persists the integer, but does not scan source, inspect import or call evidence, or recompute the count.
- Origin `priority` is supplied by discovery after deterministic ordering by descending `usage_count` and lexicographic `origin_key` tie-breaks. The CLI persists the value and does not accept separate external priority override metadata.
- Optional accepted-entry metadata is intentionally small: `framework` may appear on artifacts and external selectors when discovery can identify it, and `module_path` may appear only on project-owned artifacts. `artifact_type` must not be written on external selectors.
- `summary` is required English catalog prose for accepted artifacts and external selectors. `usage_notes` and `limitations` are optional English catalog prose. Suppressions must not include `summary`, `usage_notes`, or `limitations`.
- `capability_tags` must be a non-empty array of canonical strings. The CLI validates lowercase token or kebab-case format, removes duplicates, and persists the result, but does not perform synonym normalization.
- `target_kind` is limited to `artifact`, `external_selector`, or `origin`. For `artifact` and `external_selector`, `target_key` is the catalog selector; for `origin`, `target_key` is the `origin_key`.
- `fingerprint` is a deterministic opaque string produced by discovery. The CLI validates that it is present and persists it, but does not compute, parse, normalize, compare by subfield, or infer meaning from it.
- Artifact `source_anchor` values use `{ path, symbol, line }`; `path` and `symbol` are required, while `line` is optional. External selectors must not include `source_anchor`.
- Priority fields are integers. Lower numeric values sort before higher numeric values.
- External selector priority is not duplicated on the selector record. External selector results inherit priority from the referenced origin.
- Legacy evidence groupings such as `findings.utility_artifacts`, `findings.observed_external_usages`, `findings.template_patterns`, `members`, or `deferrals` are not accepted as discovery apply input.

## ADR 0037: Test the CLI With Fixtures and Skill Static Checks

The Tool Catalog CLI is tested against fixture projects for Java, Vue, and external utility usage. Skill Markdown files are checked statically for frontmatter, naming, required workflow steps, and CLI command consistency.

Consequences:

- Discovery and consulting behavior can be verified without scanning real user projects in tests.
- Skill documentation stays aligned with the CLI command contract.
