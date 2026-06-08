Status: ready-for-agent

# Finalize skill instructions and regression checks

## What to build

Finalize the two Tool Catalog skill documents using the write-a-skill guidance, then add fixture-based CLI tests and static checks that keep the skill instructions aligned with the CLI contract.

## Acceptance criteria

- [x] `tool-catalog-discover` follows the approved two-phase discovery workflow and keeps `SKILL.md` concise.
- [x] `tool-catalog-consult` follows the approved query, show, verify, source-anchor, and read-only workflow and keeps `SKILL.md` concise.
- [x] Skill descriptions clearly state when an agent should load each skill.
- [x] Fixture tests cover Java utility discovery, TypeScript or Vue utility discovery, observed external usage, template threshold behavior, project identity, relative anchors, ignored candidates, and query/show/verify.
- [x] Static checks validate skill frontmatter, directory/name consistency, shared CLI installation, and documented command availability.
- [x] The repository verification command set is documented in the final issue comment or README update.

## Blocked by

- [05 Implement consulting query, show, and verify workflow](./05-implement-consulting-query-show-and-verify-workflow.md)

## Comments

### Dispatch Constraints

- Prepared: 2026-06-08
- Scope: `.scratch/tool-catalog/issues/06-finalize-skill-instructions-and-regression-checks.md`
- Sources checked: `CONTEXT.md`, `docs/adr/0003-separate-discovery-and-consulting-skills.md`, `docs/adr/0007-install-two-skills-with-one-shared-cli.md`, `docs/adr/0011-use-english-for-catalog-prose.md`, `docs/adr/0013-keep-llm-reasoning-in-skills-not-cli.md`, `docs/adr/0021-consulting-trigger-is-agent-discretion.md`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md`, `docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md`, `write-a-skill` instructions, current user instructions.
- CONTEXT.md: use established terms for `Discovery Skill`, `Consulting Skill`, `Tool Catalog CLI`, `Utility Artifact`, `Template Code`, and `Utility Origin` (`CONTEXT.md:17`, `CONTEXT.md:21`, `CONTEXT.md:29`, `CONTEXT.md:37`).
- docs/adr: skill contracts stay separate: discovery updates the project index, consulting reads it during coding and remains read-only (`docs/adr/0003-separate-discovery-and-consulting-skills.md:3`, `docs/adr/0003-separate-discovery-and-consulting-skills.md:9`).
- docs/adr: distribute `tool-catalog-discover`, `tool-catalog-consult`, and one shared CLI copy per agent root; skill docs reference the shared CLI rather than embedding code (`docs/adr/0007-install-two-skills-with-one-shared-cli.md:3`, `docs/adr/0007-install-two-skills-with-one-shared-cli.md:8`).
- docs/adr: stored catalog prose and Markdown output are English; CLI is deterministic and LLM reasoning belongs in the skills, not inside the CLI (`docs/adr/0011-use-english-for-catalog-prose.md:3`, `docs/adr/0013-keep-llm-reasoning-in-skills-not-cli.md:3`).
- docs/adr: consulting trigger is agent discretion; the consulting skill defines how to query and verify once invoked, not when every coding workflow must invoke it (`docs/adr/0021-consulting-trigger-is-agent-discretion.md:3`, `docs/adr/0021-consulting-trigger-is-agent-discretion.md:7`).
- docs/adr: consulting instructions must include progressive verification and no-result behavior (`docs/adr/0022-consult-before-coding-with-progressive-verification.md:3`, `docs/adr/0022-consult-before-coding-with-progressive-verification.md:9`).
- docs/adr: fixture tests and static checks must keep CLI behavior and skill Markdown aligned (`docs/adr/0037-test-cli-with-fixtures-and-skill-static-checks.md:3`).
- Discussion: user explicitly required using `write-a-skill`; follow its structure, description, split-file, and review checklist guidance (`/home/jing/.agents/skills/write-a-skill/SKILL.md:16`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:37`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:60`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:100`, `/home/jing/.agents/skills/write-a-skill/SKILL.md:108`).

### Execution start - 2026-06-08

- Dispatch profile: default worker dispatch profile accepted by user on 2026-06-08.
- Model: inherited current Codex worker model through the active subagent tool; the active tool schema has no explicit model field.
- Reasoning: selected by main agent per issue risk; issue 06 uses high caution because it finalizes skill contracts and regression checks across the full CLI.
- TDD policy: worker decides whether TDD is warranted; relevant verification is required.
- Concurrency: at most 2 active implementation/review/repair workers.
- Dependency context: blocked until issue 05 completes successfully, including any required review/repair.
- Dispatch Constraints: existing block reused without freshness inference.

### Implementation progress - 2026-06-08

- accepted issue 06 worker brief and confirmed dependencies 01-05 are reported complete, including issue 04/05 repair and second review gates.
- read `CLAUDE.md`, `CONTEXT.md`, required ADRs, issue Dispatch Constraints, existing Tool Catalog skill docs, CLI command surface, sync script, and `/home/jing/.agents/skills/write-a-skill/SKILL.md`.
- no stale or conflicting Dispatch Constraints anchors found; scope remains limited to final skill docs, regression/static checks, verification documentation, and issue write-back.
- planned committed checks: fixture-driven CLI regression for discover/apply/query/show/verify and a static skill/install/command-alignment check.

### Implementation terminal report - 2026-06-08

- status: completed.
- changed files:
  - `README.md`
  - `.scratch/tool-catalog/issues/06-finalize-skill-instructions-and-regression-checks.md`
  - `skills/tool-catalog-discover/SKILL.md`
  - `skills/tool-catalog-consult/SKILL.md`
  - `scripts/check-tool-catalog-skills.mjs`
  - `tools/tool-catalog-cli/tests/regression.mjs`
- implementation summary:
  - finalized `tool-catalog-discover` as a concise English two-phase dry-run/review/apply workflow with explicit project identity, decisions JSON, relative-anchor, English-prose, and no-source-edit rules.
  - finalized `tool-catalog-consult` as a concise English read-only query/show/verify workflow with source-anchor verification, broaden-once no-result behavior, and stale-index handoff to discovery.
  - added fixture CLI regression covering Java utility discovery, TypeScript utility discovery, observed external VueUse usage, template threshold behavior, explicit project identity, relative anchors, ignored candidates, apply, query, show, verify, read-only consulting, and stale external-call verification.
  - added static checks for frontmatter, directory/name consistency, Tool Catalog skill contract text, documented command availability, CLI help availability, and temp-root shared CLI install plus `--check`.
  - documented the repository Tool Catalog verification command set and command surface in `README.md`.
- commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node --check scripts/check-tool-catalog-skills.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs doctor`
  - `git diff --check`
- verification results:
  - CLI syntax check passed.
  - fixture regression passed.
  - skill static checks passed, including isolated `scripts/sync-skills.sh` install and `--check` against temp agent roots.
  - sync script shell syntax passed.
  - `doctor` passed with Node `24.15.0` and sqlite3 `3.45.1`.
  - whitespace diff check passed.
- remaining risks:
  - fixture regression is intentionally small and deterministic; it does not replace broad real-project discovery validation.
  - query ranking remains the issue 05 local FTS/metadata heuristic, not semantic embedding.
  - static checks validate the documented contract text, but they cannot prove agents will always choose the skill at the right time.
- review worker recommendation: recommended. This issue finalizes user-facing skill contracts and adds the committed regression safety net for the full Tool Catalog workflow.

### Main-agent implementation result - 2026-06-08

- result: implementation completed; durable worker terminal report reviewed.
- changed files: `.scratch/tool-catalog/issues/06-finalize-skill-instructions-and-regression-checks.md`, `README.md`, `skills/tool-catalog-discover/SKILL.md`, `skills/tool-catalog-consult/SKILL.md`, `scripts/check-tool-catalog-skills.mjs`, `tools/tool-catalog-cli/tests/regression.mjs`.
- verification summary: worker reported passing syntax checks for CLI/regression/static scripts, fixture regression, static skill checks including isolated sync install/check, sync shell syntax, `doctor`, and diff whitespace checks.
- review/repair decision: review worker required because the implementation worker explicitly recommended review for finalized skill contracts and committed regression safety net.

### Review terminal report - 2026-06-08

- status: review completed.
- review-duplication skill: unavailable in the local skills directory; review still covered duplicate functionality, reinvented utilities, missed shared helpers, and project-pattern drift manually.
- findings: none.
- acceptance review:
  - `tool-catalog-discover` is concise English and follows the dry-run, candidate review, all-decisions-resolved, apply workflow with relative anchor and no-source-edit rules (`skills/tool-catalog-discover/SKILL.md:19`, `skills/tool-catalog-discover/SKILL.md:26`, `skills/tool-catalog-discover/SKILL.md:29`, `skills/tool-catalog-discover/SKILL.md:37`).
  - `tool-catalog-consult` is concise English and follows query, broaden-once no-result handling, show, verify, source-anchor, read-only, and stale-index handoff rules (`skills/tool-catalog-consult/SKILL.md:19`, `skills/tool-catalog-consult/SKILL.md:22`, `skills/tool-catalog-consult/SKILL.md:24`, `skills/tool-catalog-consult/SKILL.md:27`, `skills/tool-catalog-consult/SKILL.md:36`).
  - skill descriptions clearly state trigger conditions through `Use when` frontmatter (`skills/tool-catalog-discover/SKILL.md:3`, `skills/tool-catalog-consult/SKILL.md:3`).
  - regression fixture covers Java discovery, TypeScript utility discovery, observed external usage, template threshold behavior, explicit project identity, relative anchors, ignored candidates, and query/show/verify (`tools/tool-catalog-cli/tests/regression.mjs:226`, `tools/tool-catalog-cli/tests/regression.mjs:231`, `tools/tool-catalog-cli/tests/regression.mjs:241`, `tools/tool-catalog-cli/tests/regression.mjs:246`, `tools/tool-catalog-cli/tests/regression.mjs:209`, `tools/tool-catalog-cli/tests/regression.mjs:151`, `tools/tool-catalog-cli/tests/regression.mjs:236`, `tools/tool-catalog-cli/tests/regression.mjs:285`).
  - static checks validate frontmatter, directory/name consistency, documented command availability, CLI help availability, and isolated shared CLI sibling installation (`scripts/check-tool-catalog-skills.mjs:76`, `scripts/check-tool-catalog-skills.mjs:91`, `scripts/check-tool-catalog-skills.mjs:127`, `scripts/check-tool-catalog-skills.mjs:159`).
  - repository verification commands and command surface are documented in `README.md` (`README.md:23`, `README.md:34`).
  - skill docs keep judgement/reasoning in skills while tests/static checks introduce no model/API dependency or CLI behavior change (`skills/tool-catalog-discover/SKILL.md:26`, `skills/tool-catalog-consult/SKILL.md:39`).
- verification commands run:
  - `node --check tools/tool-catalog-cli/bin/tool-catalog.mjs`
  - `node --check tools/tool-catalog-cli/tests/regression.mjs`
  - `node --check scripts/check-tool-catalog-skills.mjs`
  - `node tools/tool-catalog-cli/tests/regression.mjs`
  - `node scripts/check-tool-catalog-skills.mjs`
  - `bash -n scripts/sync-skills.sh`
  - `node tools/tool-catalog-cli/bin/tool-catalog.mjs doctor`
  - `git diff --check`
  - `rg --files /home/jing/.agents/skills --glob *review-duplication*`
  - `rg -n "Stub|Until .*implemented|TODO|FIXME|OpenAI|Anthropic|LLM|model|api key|API key|embedding" README.md skills/tool-catalog-discover/SKILL.md skills/tool-catalog-consult/SKILL.md scripts/check-tool-catalog-skills.mjs tools/tool-catalog-cli/tests/regression.mjs`
- repair worker needed: no.
- remaining risks:
  - fixture coverage is deterministic and intentionally small; it does not prove recall across large real projects.
  - static checks verify required contract text and command availability, but cannot prove future agents will invoke the correct skill in every ambiguous coding task.
  - query ranking remains the prior local FTS/metadata heuristic, outside issue 06 scope.
- conclusion: all requested issues are complete.

### Main-agent review result - 2026-06-08

- result: review completed successfully; no repair worker required.
- review findings: none.
- verification summary: review worker reran CLI/regression/static syntax checks, fixture regression, static skill checks, sync shell syntax, doctor, diff whitespace checks, and targeted content searches.
- dependency decision: no downstream issue remains; all requested issues are complete.
