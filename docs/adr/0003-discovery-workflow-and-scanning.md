# Discovery Workflow and Scanning Decisions

This file consolidates the discovery ADRs that previously lived as ADR 0005, 0006, 0014, 0015, 0016, 0017, 0020, 0029, 0030, 0032, 0033, 0036, 0039, and 0041.

## ADR 0005: Support Java and TypeScript Vue Projects First

The first version of the tool catalog supports Java Spring Boot Maven projects, general TypeScript and JavaScript utility modules, and Vue projects. The concept model remains language-neutral so later detectors can add React, Python, and other ecosystems without redefining utility artifacts, but React-specific and Python-specific detectors are not part of the first version.

Consequences:

- Discovery uses language-specific detectors instead of one generic parser.
- Index records need language and framework metadata so consulting can filter results by the current coding context.
- Backend and frontend records share one target project index instead of separate databases.
- Vue discovery targets Vue 3 common structures, utility modules, composables, and recurring template patterns; Vue 2 mixins and page-level component analysis are outside the first version.

## ADR 0006: Discovery Suggests Extraction but Does Not Edit Code

When recurring template code appears extractable into a utility artifact, the discovery skill reports the opportunity only if the pattern is frequent, non-business-specific, has no equivalent existing utility, and can be extracted behind a stable method signature. Code changes require user approval and should be handled by a separate implementation subagent. After a successful extraction, the main agent triggers incremental rediscovery for the changed files or modules.

Consequences:

- Discovery does not modify target project code.
- Extraction recommendations must include the repeated pattern, affected references, missing equivalent utility, and the proposed utility shape.
- Failed extraction attempts do not update the index.

## ADR 0014: Batch Discovery Decisions After Scanning

The discovery skill scans first, then routes Findings through the worker DAG before presenting compact blocking decisions. User decisions are focused on unresolved utility origin priorities, unresolved Review Group conflicts, business-specific template risk, and extraction opportunities.

Consequences:

- High-confidence accepted entries, suppressions, and deferrals do not require user confirmation after Decision Review passes.
- SQLite is updated after required user decisions are resolved.
- Catalog Finalizer workers classify Review Groups as accepted entries, suppressions, deferrals, or blocking questions. The main agent does not choose final semantic actions from raw dry-run output.
- Discovery workers finish bounded review and merge before asking the user, then batch the highest-impact blocking decisions instead of interrupting on each Finding.

## ADR 0015: Scope Discovery Cleanup to Refresh Mode

Discovery cleanup is scoped by refresh mode. A full discovery may remove or downgrade entries that no longer exist or no longer qualify in the supported project scope, while a changed-path discovery only refreshes and cleans entries tied to the provided paths.

Consequences:

- Incremental rediscovery after subagent work cannot accidentally prune unrelated catalog entries.
- Users can run full discovery when they want the current working tree to become the source of truth for the catalog.

## ADR 0016: Index Only Observed External Utility Usage

External utility origins are indexed only when the target project already imports or calls them. The catalog does not crawl or document full external library APIs, because its purpose is to capture project reuse practice rather than replace general dependency documentation.

Consequences:

- Project-owned utility artifacts can be indexed from source with richer metadata.
- External utility entries are based on observed imports, calls, examples, and file anchors.

## ADR 0017: Use Conservative Utility Discovery

Discovery automatically indexes only high-confidence project-owned utility artifacts after worker review and Decision Review. Ambiguous Findings are reported for Review Group handling instead of being written to the project index.

Consequences:

- Utility discovery favors precision over recall.
- Language-specific detectors use structural evidence such as package or path, exported methods, framework annotations, business dependencies, and cross-file usage.
- Explicit utility naming and shared utility package paths are default inclusion signals.
- Business-package helper methods are not indexed by default unless the discovery agent accepts them as non-business reusable utilities.

## ADR 0020: Use Controlled Template Pattern Discovery

The first version does not perform general-purpose clone detection. Template discovery uses language-specific structural fingerprints and controlled pattern detectors, then relies on the worker review and Catalog Finalizer flow to decide whether frequent Findings represent useful Template Code.

Consequences:

- Discovery favors reusable implementation patterns over raw textual similarity.
- Common business-flow similarity is not enough to create a template entry.

## ADR 0029: Exclude Dependencies, Build Output, and Generated Files

Discovery excludes common dependency directories, build output, coverage output, generated sources, IDE metadata, minified files, source maps, and lockfiles by default. In Git projects it also respects `.gitignore` by using tracked and unignored files as the scan base. Include and exclude overrides can adjust the scan scope.

Consequences:

- Catalog entries are less likely to come from generated or third-party copied code.
- Agents can override scan scope for unusual project layouts.

## ADR 0030: Discovery Does Not Run Builds or Tests by Default

Discovery scans files, extracts structural Findings, counts references, verifies symbol presence, and updates SQLite. It does not run project builds or test suites by default.

Consequences:

- Catalog refresh remains lightweight.
- Code-changing workflows, such as utility extraction, are responsible for their own verification.

## ADR 0032: Discover Supports Full, Changed, Dry-Run, and Scope Filters

The discover command supports full refresh, changed-path refresh, dry-run reporting, language filters, and include or exclude scope overrides. These modes keep full cleanup, incremental rediscovery, and review-only scans explicit.

Consequences:

- Agents can inspect Findings and worker review artifacts before writing index changes.
- Incremental refresh after implementation can target only changed paths.

## ADR 0033: Use Two-Phase Discovery Apply

Discovery is a two-phase workflow. The CLI first runs Evidence Harvest in dry-run mode, producing machine-readable Findings plus manifest and index artifacts. The worker DAG reviews those facts, groups them into Review Groups, performs local gap audit for accepted entries, and writes a structured Discovery Decision File. Discovery apply consumes the decision file, not raw dry-run output, when updating the project index.

Consequences:

- Unreviewed Findings are not written to the project index.
- The CLI remains deterministic while the skill handles semantic judgment.
- Discovery agents default to reading the manifest and index before bounded worker review inputs.
- Worker review artifacts avoid semantic recommendations until the Catalog Finalizer stage.
- Review artifacts include compact structural facts: utility class names, source anchors, paths or packages, method signatures, short snippets, template pattern keys, representative instances, and instance anchors.
- Dry-run writes Finding artifacts only; legacy compatibility artifacts are not part of the current CLI contract.
- Discovery Decision Files store accepted entries in their final catalog shape, while suppressions and deferrals preserve enough Finding traceability for future preclassification.

## ADR 0036: Report Discovery Results as an Actionable Summary

Discovery reports summarize project identity, index path, updated counts, required decisions, risks, and follow-up commands. It does not print the full catalog.

Consequences:

- Users can quickly see what changed and what still needs a decision.
- Detailed entries remain available through query and show commands.

## ADR 0039: Use Lightweight Structural Scanning First

The first version does not depend on Java, TypeScript, or Vue parser libraries. Discovery uses file paths, package names, imports, annotations, exports, method signatures, call-site patterns, and structural fingerprints to identify high-confidence Findings.

Consequences:

- Installation stays simple and dependency-light.
- Ambiguous structures are reported for review instead of being force-indexed.

## ADR 0041: Use Agent-Orchestrated Evidence Harvest for Discovery

Tool Catalog discovery treats the CLI dry-run as a bounded-recall evidence harvest, not as a trusted semantic generator. The CLI emits mechanical Findings, structural metadata, simple deterministic dedupe, and fingerprints; worker subagents perform review grouping, cross-shard merge, local gap audit, semantic finalization, decision review, repair, and apply verification. The main agent is the only dispatcher: it owns the workflow DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O, but it does not perform concrete discovery or final catalog decisions itself.

Consequences:

- The old candidate-centric discovery model is superseded for new implementation work; backward compatibility with the current unusable implementation is not required.
- CLI output is called a Finding, not a Candidate. Findings are untrusted evidence and must not include accept, ignore, defer, capability tags, summaries, selection descriptions, usage notes, limitations, or recommended actions.
- CLI dry-run optimizes bounded recall and mechanical dedupe. Semantic dedupe, reusable-boundary decisions, business-specific risk judgment, and catalog prose belong to workers.
- Discovery uses a durable run directory as the shared channel. Workers write structured artifacts and minimal `status.md` files; narrative reports are not required.
- The dispatcher writes the run root `status.md`; workers write terminal status files under `workers/<work_item_id>/status.md` so concurrent worker handoff cannot overwrite dispatcher or peer state.
- The main agent is the sole subagent dispatcher. Workers may produce Markdown work plans and child briefs, but workers must not spawn subagents.
- Work plans use strict Markdown because agents handle Markdown better than JSON for orchestration; final Decision Files use JSON because CLI apply needs deterministic structured input.
- Large dry-runs are handled by manifest/index files plus recursive map-reduce chunking. No LLM worker should consume an oversized full dry-run directly.
- Shard Review Workers use economical models and only clean, mechanically dedupe, group, and flag structural issues. They do not output final actions or semantic catalog fields.
- Cross-Shard Merge Workers merge review groups and preserve conflicts without final semantic decisions.
- Catalog Finalizer Workers use stronger reasoning, inspect source anchors, perform mandatory local gap audit, create semantic catalog entries, suppressions, deferrals, and write the entry-centric JSON Decision File.
- Decision Review Workers are mandatory before apply. They review the Decision File and structured artifacts; fixable findings go to repair workers, blocking findings go through user decision and incorporation workers.
- Review passing with no blockers triggers Apply/Verify Worker by default unless the user requested review-only mode.
- The final Decision File is entry-centric: final identity is based on entry keys and source anchors, not CLI finding provenance.
- Project Index state should persist catalog entries, suppressions, deferrals, and structural fingerprints. Later discovery runs use these records for pre-classification so unchanged entries, unchanged suppressions, and unchanged deferrals do not repeatedly consume worker context.
- Dispatch profiles are role-specific. Review and merge workers default to economical models, finalizer workers use stronger reasoning, and default concurrency is capped. If a subagent tool schema omits model or reasoning fields, dispatch still attempts to pass them first; only an actual dispatch failure proves selection is unavailable on that surface.
