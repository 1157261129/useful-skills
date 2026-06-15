# Discovery Workflow and Scanning Decisions

This file consolidates the discovery ADRs that previously lived as ADR 0005, 0006, 0014, 0015, 0016, 0017, 0020, 0029, 0030, 0032, 0033, 0036, 0039, and 0041.

## ADR 0005: Support Java and TypeScript Vue Projects First

The first version of the tool catalog supports Java Spring Boot Maven projects, general TypeScript and JavaScript utility modules, and Vue projects. The concept model remains language-neutral so later detectors can add React, Python, and other ecosystems without redefining utility artifacts, but React-specific and Python-specific detectors are not part of the first version.

Consequences:

- Discovery uses language-specific detectors instead of one generic parser.
- Index records need stable context metadata so consulting can filter results by the current coding context. Discovery must write `language` for accepted project-owned artifacts and external selectors, write `artifact_type` only for project-owned artifacts, write optional `framework` only when the framework is known, and write optional `module_path` only for project-owned artifacts.
- Backend and frontend records share one target project index instead of separate databases.
- Vue discovery targets Vue 3 utility modules and composables; Vue 2 mixins, page-level component analysis, and recurring template patterns are outside the Tool Catalog scope.

## ADR 0006: Discovery Does Not Suggest Template Extraction

Discovery does not look for recurring template code or suggest extracting it. Code-changing extraction work is outside the Tool Catalog discovery workflow.

Consequences:

- Discovery does not modify target project code.
- Discovery effort stays focused on reusable utility artifacts, external utility selectors, and external origin priority data.

## ADR 0014: Batch Discovery Decisions After Scanning

The discovery skill scans first, then routes Findings through the worker DAG before presenting compact blocking decisions. User decisions are focused on unresolved Artifact Priority questions and unresolved Review Group conflicts.

Consequences:

- High-confidence accepted entries and class, module, or origin-level suppressions do not require user confirmation after Decision Review passes.
- SQLite is updated by discovery apply after required user decisions are resolved.
- Catalog Finalizer workers classify Review Groups as accepted entries, suppressions, run-local deferrals, or blocking questions. Run-local deferrals stay in discovery artifacts and are not apply input. The main agent does not choose final semantic actions from raw source evidence.
- Discovery workers finish bounded review and merge before asking the user, then batch the highest-impact blocking decisions instead of interrupting on each Finding.

## ADR 0015: Scope Discovery Apply by Decision File Mode

Discovery cleanup is scoped by the Discovery Decision File `project.mode`. In `full` mode, the Decision File represents the supported catalog state for the target project, so apply replaces existing catalog entries, external selectors, origins, suppressions, and fingerprints with the file contents. In `changed` mode, apply upserts records present in the Decision File and deletes only records explicitly named under typed `removed` groups, leaving all unrelated existing records untouched.

Consequences:

- Incremental rediscovery after subagent work cannot accidentally prune unrelated catalog entries.
- Users can run full discovery when they want the current working tree to become the source of truth for the catalog.
- The CLI does not infer full or changed scope from scanned paths, because scanning belongs to the discovery agent.
- `project.mode` is required and must be either `full` or `changed`.
- `removed` is a typed object with `artifacts`, `external_selectors`, `origins`, `suppressions`, and `fingerprints` arrays. It contains database identities only: catalog selectors, origin keys, suppression keys, or fingerprint keys. It must not contain file paths, finding IDs, import text, call text, source anchors, or other raw evidence identifiers.
- Apply handles removals by type, not by guessing from mixed string prefixes. Entry removals are applied before orphan origin, suppression, and fingerprint cleanup.

## ADR 0016: Derive External Utility Entries From Observed Usage

External utility origins and selectors are indexed only when the target project already imports or calls them. The observed import and call evidence stays in discovery run artifacts and is not persisted as queryable Project Index data. The catalog does not crawl or document full external library APIs, because its purpose is to capture project reuse practice rather than replace general dependency documentation.

Consequences:

- Project-owned utility artifacts can be indexed from source with richer metadata.
- External utility entries are class-level or module-level entries based on observed imports and stable external identifiers.
- Observed external usage is run-artifact evidence only; external Artifact Priority belongs to the utility origin/module derived from that evidence.
- External imports and calls produce class or module selectors and are also normalized to library/module origins before priority assignment. Usage counts are aggregated by normalized origin as distinct target project source-file counts, then persisted on the origin; multiple imports or calls for the same origin in one file count once, and individual usage rows are not persisted.
- Discovery assigns external origin priority from `usage_count` in descending order, so origins used in more source files receive lower numeric priority values. Equal `usage_count` values are ordered by `origin_key` lexicographically. External origin priority is not a user-decision branch.
- Consulting output for external utilities uses the external class or module fully qualified name and does not include import, call, or source-anchor evidence by default. Java symbols use class FQCNs; JavaScript and TypeScript symbols use stable module identifiers such as `lodash/isEqual` or `@vueuse/core`. Function-level exports are not catalog selectors.

## ADR 0017: Use Conservative Utility Discovery

Discovery automatically indexes only high-confidence project-owned utility artifacts after worker review and Decision Review. Ambiguous Findings are reported for Review Group handling instead of being written to the project index.

Consequences:

- Utility discovery favors precision over recall.
- Language-specific detectors use structural evidence such as package or path, exported methods, framework annotations, business dependencies, and cross-file usage.
- Explicit utility naming and shared utility package paths are default inclusion signals.
- Business-package helper methods are not indexed by default unless the discovery agent accepts them as non-business reusable utilities.

## ADR 0020: Remove Template Pattern Discovery

The discovery workflow does not perform general-purpose clone detection or template-pattern discovery. Repeated implementation examples are not catalog entries.

Consequences:

- Discovery stays accurate and economical by focusing on utility artifacts, external utility selectors, and origin-level usage counts.
- Common business-flow similarity never creates a catalog entry.

## ADR 0029: Exclude Dependencies, Build Output, and Generated Files

Discovery excludes common dependency directories, build output, coverage output, generated sources, IDE metadata, minified files, source maps, and lockfiles by default. In Git projects it also respects `.gitignore` by using tracked and unignored files as the scan base. Include and exclude overrides can adjust the scan scope.

Consequences:

- Catalog entries are less likely to come from generated or third-party copied code.
- Agents can override scan scope for unusual project layouts.

## ADR 0030: Discovery Does Not Run Builds or Tests by Default

Discovery scans files, extracts structural Findings, counts references, and verifies symbol presence before writing a reviewed Decision File. SQLite is updated only during discovery apply. Discovery does not run project builds or test suites by default.

Consequences:

- Catalog refresh remains lightweight.
- Code-changing workflows, such as utility extraction, are responsible for their own verification.

## ADR 0032: Discovery Scope Belongs to the Agent Workflow

The discovery skill supports full refresh, changed-path refresh, language filters, and include or exclude scope overrides as agent workflow inputs. The CLI does not expose dry-run scanning modes; `discover --apply` is the only discovery write command.

Consequences:

- Agents can inspect worker review artifacts before writing index changes.
- Incremental refresh after implementation can target only changed paths through the discovery workflow.

## ADR 0033: Use Two-Phase Discovery Apply

Discovery is a two-phase workflow. Agent workers first harvest evidence from the Target Project and review it into accepted entries, suppressions, run-local deferrals, and blocking questions. Discovery apply consumes the reviewed Discovery Decision File when updating the Project Index.

Consequences:

- Unreviewed Findings are not written to the project index.
- The CLI remains deterministic while the skill handles semantic judgment.
- Discovery agents default to producing bounded worker review inputs before semantic finalization.
- Worker review artifacts avoid final semantic recommendations until the Catalog Finalizer stage. Economical shard review may include non-binding tag hints to reduce finalizer search cost.
- Review artifacts include compact structural facts: utility class or module names, source anchors, paths or packages, short snippets, observed imports, observed calls, and call anchors.
- Raw source evidence artifacts are agent workflow artifacts, not CLI output.
- Discovery Decision Files store only database-ready accepted entries, project-owned source anchors, class, module, or origin-level suppressions, normalized origins, origin usage counts, Artifact Priority values, capability tags, descriptions, entry context metadata, fingerprints for entries and suppressions, and explicit removal identities. The top-level JSON keys are `project`, `artifacts`, `external_selectors`, `origins`, `suppressions`, `fingerprints`, and `removed`; `project.mode` is either `full` or `changed`. Accepted artifacts and external selectors must include the minimum required fields defined by the CLI contract before apply. Worker rationale, long reports, entry disputes, run-local deferrals, raw import or call evidence, external usage anchors, current-file query context, and diagnostic notes stay in run artifacts and are not apply input.

## ADR 0036: Report Discovery Results as an Actionable Summary

Discovery reports summarize project identity, index path, updated counts, required decisions, risks, and follow-up commands. It does not print the full catalog.

Consequences:

- Users can quickly see what changed and what still needs a decision.
- Detailed entries remain available through query and show commands.

## ADR 0039: Use Agent-Owned Structural Scanning First

Discovery agents use economical source inspection first: file paths, package names, imports, annotations, exports, method signatures as evidence, call-site patterns, and structural fingerprints. The CLI does not scan Target Project source; it validates and persists structured discovery output.

Consequences:

- Installation stays simple and dependency-light.
- Ambiguous structures are routed through discovery workers instead of being force-indexed.

## ADR 0041: Use Agent-Owned Evidence Harvest for Discovery

Tool Catalog discovery treats source scanning as agent work, not CLI work. The discovery dispatcher coordinates economical worker subagents that inspect the Target Project and identify reusable project utilities, external utility class or module selectors, normalized external origins, distinct source-file usage counts, and non-binding tag hints. Stronger finalizer workers assign final capability tags, descriptions, Artifact Priority values, deduplicate entries, and write a structured Discovery Decision File. The CLI validates and persists that file into the Project Index.

Consequences:

- The old candidate-centric discovery model is superseded for new implementation work; backward compatibility with the current unusable implementation is not required.
- CLI discovery input is a structured decision artifact, not raw scanned source and not unreviewed Findings.
- Source scanning, reusable-boundary decisions, semantic dedupe, catalog prose, and priority assignment belong to workers, with stronger finalizer workers owning final semantic decisions.
- Discovery uses a durable run directory as the shared channel. Workers write structured artifacts and minimal `status.md` files; narrative reports are not required.
- The dispatcher writes the run root `status.md`; workers write terminal status files under `workers/<work_item_id>/status.md` so concurrent worker handoff cannot overwrite dispatcher or peer state.
- The main agent is the sole subagent dispatcher. Workers may produce Markdown work plans and child briefs, but workers must not spawn subagents.
- Work plans use strict Markdown because agents handle Markdown better than JSON for orchestration; final Decision Files use JSON because CLI apply needs deterministic structured input. Decision Files must not include worker reasoning or narrative reports.
- Decision Files are final database-object records, not old Finding Evidence Packs. They must not contain legacy evidence groups, callable-level records, repeated-code records, raw external usage rows, or deferrals.
- Large projects are handled by manifest/index files plus recursive map-reduce chunking. No LLM worker should consume an oversized full-project source listing directly.
- Evidence Harvest creates a deterministic Coverage Inventory for every covered source root before candidate selection. Bounded candidate lists are review inputs and cannot stand in for eligible-file accounting.
- A `full` run may use bounded review chunks, but every eligible file must reconcile through reviewed, excluded, deferred, or unreviewed coverage state. Missing counts and unjustified zero counts require repair before apply.
- Utility-heavy namespaces are mandatory gap-audit surfaces when present. Java discovery includes `util`, `utils`, `helper`, `common`, `core`, and `reflect` paths or packages; TypeScript and JavaScript discovery includes shared utility, helper, composable, and shared-module paths. These signals expand review coverage but do not force acceptance.
- Shard Review Workers use economical models and scan bounded source shards for reusable project utilities and observed external utility usage. They output structured review data only: project utility artifacts or modules, project-owned source anchors, external utility class or module selectors, normalized external origins, distinct source-file usage counts, and non-binding tag hints.
- Cross-Shard Merge Workers merge review groups and preserve conflicts without final semantic decisions.
- Catalog Finalizer Workers use stronger reasoning, inspect source anchors, perform a mandatory gap audit against the Coverage Inventory, create final semantic catalog entries, class, module, or origin-level suppressions, run-local deferrals, capability tags, descriptions, Artifact Priority values, and write the entry-centric JSON Decision File without deferrals. The audit checks utility-heavy namespaces and project-owned imports from accepted artifacts so imported utility-like symbols cannot silently disappear between candidate curation and finalization.
- Decision Review Workers are mandatory before apply. They review the Decision File and structured artifacts for Coverage Inventory reconciliation, missed-scan risk, utility-namespace coverage, project-owned import gaps, origin normalization, project-owned priority dominance, external usage-count priority, and whether consulting can return project-owned-first results with a default limit of five and a maximum limit of ten. A `full` run with missing counts, unjustified zero counts, unreconciled eligible files, or only manually curated candidates cannot pass; fixable findings go to repair workers, blocking findings go through user decision and incorporation workers.
- Review passing with no blockers triggers Apply/Verify Worker by default unless the user requested review-only mode; this verifies persisted database records and project-owned source anchors, not external selector availability.
- The final Decision File is entry-centric and database-ready: project-owned final identity is based on catalog selectors and source anchors, while external final identity is based on external selectors and normalized origins, not CLI finding provenance, worker reasoning, or old evidence group names.
- Project Index state should persist catalog entries, class, module, or origin-level suppressions, and discovery-written structural fingerprints for entries and suppressions. Later discovery agents may compare these records to avoid repeatedly reviewing obviously unchanged entries and suppressions. Suppressions and fingerprints must target only `artifact`, `external_selector`, or `origin`; they must not target methods, callable exports, repeated-code examples, raw external usage rows, findings, import statements, call sites, source anchors, or raw evidence rows.
- Fingerprints are discovery-only comparison aids and are stored as opaque strings. The CLI does not compute fingerprint values, inspect their source inputs, scan source, pre-classify findings, or expose fingerprints to consulting commands for query filtering, ranking, show, or verify behavior.
- Dispatch profiles are role-specific. Shard review and merge workers default to economical models, while finalizer, decision review, and repair workers use stronger reasoning as needed; default concurrency is capped. If a subagent tool schema omits model or reasoning fields, dispatch still attempts to pass them first; only an actual dispatch failure proves selection is unavailable on that surface.
