Status: ready-for-agent

# Emit Finding evidence artifacts

## What to build

Change discovery dry-run output from trusted candidate data to bounded-recall Finding evidence artifacts. A dry-run should produce compact run metadata plus raw Findings, a Finding index, a Finding manifest, mechanical dedupe data, and structural fingerprints suitable for later worker planning.

## Acceptance criteria

- [x] Dry-run output uses Finding terminology instead of Candidate terminology for new discovery artifacts.
- [x] Dry-run writes raw Findings, a compact Finding index, and a Finding manifest under the discovery run directory.
- [x] Findings contain structural evidence, anchors, deterministic metadata, and fingerprints, but no semantic recommendations, tags, summaries, or final actions.
- [x] The CLI performs only mechanical dedupe, such as exact anchor, symbol, signature, import, call, or fingerprint duplication.
- [x] Large dry-run outputs are stored as files and summarized by paths/counts rather than printed inline.
- [x] Regression coverage proves full and changed dry-runs emit the new Finding artifacts and do not mutate the Project Index.

## Blocked by

- [01 Document agent-orchestrated discovery workflow](./01-document-agent-orchestrated-discovery-workflow.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-09
- Scope: `.scratch/tool-catalog-agent-discovery/issues/02-emit-finding-evidence-artifacts.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md`, `docs/adr/0039-use-lightweight-structural-scanning-first.md`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md`, current user instructions
- CONTEXT.md: a Finding is structural evidence, not a recommendation, decision, or Catalog Entry; Evidence Harvest collects Findings without deciding whether they become Catalog Entries (`CONTEXT.md:21`, `CONTEXT.md:29`).
- docs/adr: CLI dry-run emits Findings, structural metadata, simple deterministic dedupe, and fingerprints; Findings must not include final actions, semantic tags, summaries, selection descriptions, usage notes, limitations, or recommendations (`docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:3`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:8`, `docs/adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md:9`).
- docs/adr: keep scanning lightweight and structural, using paths, packages, imports, annotations, exports, signatures, call-site patterns, and fingerprints; store run artifacts under the user cache and keep stdout compact by reporting paths/counts (`docs/adr/0039-use-lightweight-structural-scanning-first.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:3`, `docs/adr/0034-store-discovery-run-files-in-user-cache.md:9`).
- Discussion: no backward compatibility with old candidate-centric dry-run output is required for this new implementation line.

### Execution start - 2026-06-09

- Dispatch profile: default execute-issues profile; model `gpt-5.4`; worker-specific reasoning selected by issue risk; TDD decided by worker; concurrency cap 4.
- User instructions: give subagents enough task context; `ace-tool` is unavailable; pass `model` and `reasoning_effort` despite schema display, and treat selection as unavailable only after actual dispatch failure.
- Dependency context: blocked until issue 01 completes implementation and required review/repair successfully.
- Dispatch Constraints: existing block reused without freshness inference.

### Progress - 2026-06-09

- Read required context and current CLI/test implementation.
- Confirmed current dry-run still emits candidate-centric payloads inline and only writes `candidates.json`, `review-pack.md`, and `decisions.template.json`.
- Implementing a finding-centric dry-run summary plus run-file artifacts for raw Findings, compact Finding index, and Finding manifest, while keeping apply-related behavior out of scope for this issue.

### Terminal report - 2026-06-09

- Status: completed
- Summary:
  - Switched discover dry-run output to a finding-centric summary that reports counts, mechanical dedupe totals, and run-file paths instead of dumping raw candidate payloads inline.
  - Added run-directory artifacts for `findings.json`, `finding-index.json`, and `finding-manifest.json`, with deterministic fingerprints and mechanical dedupe metadata on every Finding.
  - Kept a compatibility candidate payload file for existing apply-path regression coverage without reintroducing candidate-centric stdout/json dry-run output.
  - Updated CLI regression coverage to validate the new Finding artifacts, confirm forbidden semantic fields are absent, and prove dry-run does not mutate the project index SQLite file.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/02-emit-finding-evidence-artifacts.md`
- Commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
- Remaining risks:
  - The compatibility candidate payload is intentionally retained for the current apply regression path; later issues should decide when that bridge can be removed.
  - Skill/docs/static-check alignment for the new finding-centric workflow is still outside this issue scope and may still be in flight elsewhere.
- Review worker needed: no additional review worker requested for this issue-local change.

### Review report - 2026-06-09

- Status: completed
- Result: failed
- Findings:
  - Medium - `discover --help` and top-level help still advertise candidate-centric dry-run behavior, which contradicts the new Finding-centric dry-run contract required by this issue. The current help text says `--dry-run` emits reviewable candidates and `--json` prints dry-run candidates, while the implementation now emits Finding summaries plus run-file paths (`tools/tool-catalog-cli/bin/tool-catalog.mjs:36`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:71`, `tools/tool-catalog-cli/bin/tool-catalog.mjs:81`).
  - Low - Regression coverage did not guard this contract surface, so the stale help text shipped unnoticed. The suite asserts root help, tags help, and query help, but does not assert discover help terminology or dry-run help text (`tools/tool-catalog-cli/tests/regression.mjs:458`, `tools/tool-catalog-cli/tests/regression.mjs:463`, `tools/tool-catalog-cli/tests/regression.mjs:466`).
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` -> passed
  - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed (`Tool Catalog CLI fixture regression passed.`)
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help` -> failed review expectation; output still says `--dry-run         Emit reviewable candidates without mutating the project index.` and `--json prints dry-run candidates or apply summary data as structured JSON.`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help` -> failed review expectation; top-level command summary still says `discover          Extract reviewable discovery candidates or apply reviewed decisions.`
  - `rg -n "Emit reviewable candidates|prints dry-run candidates|candidate data|Finding Index|Raw Findings|Finding Manifest" tools/tool-catalog-cli/bin/tool-catalog.mjs` -> confirmed stale candidate wording remains alongside new Finding artifact wording
- Remaining risks:
  - External consumers reading help output can still infer the old candidate-centric dry-run contract even though runtime JSON/Markdown now routes through Finding summaries and run files.
  - Because regression does not pin discover help text, future refactors can keep drifting on this contract surface without failing CI.
- Repair worker needed: Yes

### Repair terminal report - 2026-06-09

- Status: completed
- Result: completed
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/02-emit-finding-evidence-artifacts.md`
- Commands run and results:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` -> passed
  - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed (`Tool Catalog CLI fixture regression passed.`)
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help` -> passed; `--dry-run`/`--json` help now uses `Finding evidence artifacts` and `Finding summaries and evidence artifact paths`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help` -> passed; top-level `discover` summary now says `Harvest discovery Findings and evidence artifacts or apply reviewed decisions.`
  - `rg -n "Emit reviewable candidates|prints dry-run candidates|Extract reviewable discovery candidates|Harvest discovery Findings and evidence artifacts|Emit Finding evidence artifacts|Finding summaries and evidence artifact paths" tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs` -> passed; only new Finding-centric phrases remain in CLI/test assertions, old candidate-centric help phrases are absent from the CLI source
- Remaining risks:
  - This repair intentionally covers only help-contract wording and regression pinning; apply-path compatibility cleanup remains outside issue 02 repair scope.
  - Other docs or issue-local reports outside the CLI help surface may still mention the older candidate-centric wording until their own scoped follow-up work lands.
- Another review needed: No

### Re-review report - 2026-06-09

- Status: completed
- Result: passed
- Findings:
  - None
- Verification:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` -> passed
  - `node tools/tool-catalog-cli/tests/regression.mjs` -> passed (`Tool Catalog CLI fixture regression passed.`)
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs discover --help` -> passed; help now says `Emit Finding evidence artifacts without mutating the project index.` and `--json prints dry-run Finding summaries and evidence artifact paths or apply summary data as structured JSON.`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs --help` -> passed; top-level help now says `discover          Harvest discovery Findings and evidence artifacts or apply reviewed decisions.`
  - `rg -n "Emit reviewable candidates|prints dry-run candidates|Extract reviewable discovery candidates|Harvest discovery Findings and evidence artifacts|Finding summaries and evidence artifact paths" tools/tool-catalog-cli/bin/tool-catalog.mjs tools/tool-catalog-cli/tests/regression.mjs` -> passed; old candidate-centric help phrases are absent from CLI source, and regression now asserts the new Finding-centric wording
- Remaining risks:
  - The compatibility bridge artifact `tool_catalog_discovery_candidate_compat` remains by design for apply-path coverage; this re-review did not reassess bridge removal because it was not part of the prior repair findings.
  - Candidate-centric wording may still exist in historical issue comments or out-of-scope docs, but the reviewed CLI help contract and regression surface are now aligned.
- Another repair worker needed: No

### Orchestrator result - 2026-06-09

- Status: completed
- Result: accepted after review, repair, and re-review.
- Review outcome: initial review failed on stale candidate-centric help text and missing help regression coverage; repair completed; focused re-review passed with no findings.
- Changed files:
  - `tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
  - `.scratch/tool-catalog-agent-discovery/issues/02-emit-finding-evidence-artifacts.md`
- Verification summary:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs` passed.
  - `node tools/tool-catalog-cli/tests/regression.mjs` passed.
  - `discover --help` and root help now expose Finding-centric dry-run wording.
- Downstream: issues 03 and 06 are unblocked once their other dependencies are satisfied.
