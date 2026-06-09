# Agent-Orchestrated Discovery Workflow

This document is the implementation-facing workflow contract for Tool Catalog discovery after [ADR 0041](./adr/0041-use-agent-orchestrated-evidence-harvest-for-discovery.md). ADR 0041 is the controlling architecture decision. The old candidate-centric discovery flow is superseded and must not be revived for new implementation work.

## Purpose

Tool Catalog discovery is an agent-orchestrated workflow that starts with a bounded-recall **Evidence Harvest** and ends with verified project-index updates. The CLI dry-run produces mechanical evidence only. Semantic grouping, reusable-boundary decisions, catalog prose, suppressions, deferrals, review, and apply verification all happen in the worker DAG coordinated by the main agent.

## Domain terms used by the workflow

Use these terms exactly as defined in `CONTEXT.md`:

- **Evidence Harvest**: the discovery stage that collects **Findings** from a target project without deciding whether they should become **Catalog Entries**.
- **Finding**: a structural evidence record produced during discovery. A Finding is not a recommendation, decision, or Catalog Entry.
- **Review Group**: a worker-organized collection of Findings that appear to describe the same reusable boundary, repeated pattern, or observed external usage.
- **Catalog Entry**: a final accepted reusable item stored in the **Project Index**.
- **Suppression**: a recorded discovery decision that prevents unchanged non-entry evidence from repeatedly consuming discovery review effort.
- **Deferral**: a recorded discovery decision for evidence that is not ready to become a Catalog Entry but should remain visible to future discovery runs when relevant context changes.
- **Discovery Fingerprint**: a structural comparison key used to determine whether a Catalog Entry, Suppression, Deferral, or Finding is unchanged, stale, or new in a later discovery run.
- **Discovery Decision File**: a structured JSON artifact created after worker review that records final Catalog Entries, Suppressions, and Deferrals. Discovery apply consumes this file when updating the Project Index.

## Dispatch model

- The main agent is the only dispatcher.
- The main agent owns the static DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O.
- Workers may write work plans, child briefs, structured artifacts, and minimal status files.
- Workers must not spawn subagents.
- Worker outputs are inputs to later DAG stages; they are not independent side channels.

## Static worker DAG

The workflow is intentionally static. Later issues may refine file names or artifact schemas, but they must preserve this stage ordering and responsibility split.

```text
Main Agent
  -> Evidence Harvest
  -> Shard Planner Workers
  -> Chunk Planner Workers
  -> Shard Review Workers
  -> Shard Aggregator Workers
  -> Cross-Shard Merge Workers
  -> Catalog Finalizer Workers
  -> Decision Review Worker
     -> Finalizer Repair Worker (only when review finds fixable issues)
     -> User Decision -> Decision Incorporation Worker (only when review finds blocking decisions)
  -> Apply/Verify Worker
```

### 1. Evidence Harvest

- Triggered by the main agent.
- Executes CLI dry-run as bounded-recall Evidence Harvest.
- Produces mechanical Findings, structural metadata, deterministic dedupe output, and Discovery Fingerprints.
- Must not emit semantic decisions or candidate-style recommendation fields.
- Large harvests must be partitioned by manifest or index files so later stages can use recursive map-reduce chunking rather than loading an oversized full run into one worker.

### 2. Shard Planner and Chunk Planner Workers

- Shard Planner Workers read harvest manifests or index files and emit strict Markdown shard work plans for downstream workers.
- Every shard or chunk work item must include `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, and `coverage` exactly once.
- Oversized dry-runs must be planned as `harvest manifest/index -> Shard Planner -> Chunk Planner when a shard stays oversized -> bounded shard/chunk review inputs -> Shard Aggregator -> Cross-Shard Merge`; they must not be handed to one oversized worker prompt.
- Chunk Planner Workers recurse only by emitting smaller bounded child work items for the same shard. They write plans and briefs only; they must not spawn subagents.

### 3. Shard Review Workers

- Consume one bounded shard or chunk of harvested Findings plus the shard brief prepared by the main agent.
- Use economical models.
- Clean up mechanical noise, enforce structural consistency, organize Findings into Review Groups, and flag structural issues.
- Must not emit semantic accept/reject/defer decisions.
- Must not write Catalog Entries, Suppressions, Deferrals, or final prose fields.

### 4. Shard Aggregator Workers

- Merge reviewed chunks back into one shard artifact.
- Preserve traceability from shard artifacts to the reviewed chunk outputs that produced them.
- Block downstream handoff when coverage accounting shows missing or duplicate Finding coverage.

### 5. Cross-Shard Merge Workers

- Merge Review Groups that span shard boundaries.
- Preserve ambiguity and conflicts for later resolution.
- Consume shard aggregates only; they must not read oversized raw harvest payloads directly.
- May reorganize Findings and Review Groups, but still must not finalize semantic decisions.

### 6. Catalog Finalizer Workers

- Use stronger reasoning than shard review.
- Inspect source anchors directly.
- Perform mandatory local gap audit for every Review Group considered for acceptance before finalizing decisions.
- Own source inspection, semantic decisions, suppressions, deferrals, and Discovery Decision File generation.
- Transform merged Review Groups and relevant Findings into final Catalog Entries, Suppressions, and Deferrals.
- Write the entry-centric JSON Discovery Decision File.

### 7. Decision Review Worker

- Mandatory before apply.
- Reviews the Discovery Decision File together with upstream structured artifacts.
- Must not modify the Discovery Decision File.
- Returns one of three outcomes:
  - Pass: continue to apply unless the user requested review-only mode.
  - Repair needed: send concrete defects to a Finalizer Repair Worker, then re-run review.
  - Blocking decision needed: route through explicit user decision, then a Decision Incorporation Worker, before re-review.

### 7a. Finalizer Repair Worker

- Runs only for fixable Decision Review Worker findings.
- Repairs finalizer-owned decision artifacts only.
- Returns the updated decision artifacts to the Decision Review Worker for another mandatory review pass.

### 7b. Decision Incorporation Worker

- Runs only after an explicit user decision resolves blocking review findings.
- Incorporates the user-directed blocking decision into the Discovery Decision File without bypassing review.
- Returns the updated decision artifacts to the Decision Review Worker for another mandatory review pass.

### 8. Apply/Verify Worker

- Runs only after Decision Review passes with no blockers, unless the user explicitly requested review-only mode.
- Applies the Discovery Decision File to the Project Index.
- Verifies that Catalog Entries, Suppressions, Deferrals, and Discovery Fingerprints were persisted as intended.

## Worker artifact boundaries

Each stage writes durable artifacts into the run directory. Artifact formats are split by purpose.

### Structured work artifacts

- Evidence Harvest outputs mechanical structured artifacts for Findings, metadata, dedupe state, and Discovery Fingerprints.
- Shard review and merge stages output structured review artifacts that preserve Findings, Review Groups, conflicts, and traceability.
- These artifacts are evidence channels, not final project-index mutation requests.

### Strict Markdown work plans

- The main agent may prepare strict Markdown work plans or briefs for workers.
- Workers may refine or extend worker-facing Markdown briefs for downstream stages.
- Markdown plans are orchestration artifacts only. They explain scope, shard assignment, invariants, and expected outputs.
- Work plans must keep every shard or chunk input bounded and make `coverage` specific enough to prove missing or duplicate Finding coverage before merge.
- Markdown plans must not be treated as apply input.

### Minimal status files

- Every worker writes a minimal `status.md`.
- Status files exist for progress, handoff, and recovery. They should stay concise and factual.
- Narrative reports are optional and are not the workflow contract.

### JSON decision files

- Final decisions are written only as JSON Discovery Decision Files.
- The Discovery Decision File is entry-centric, not Finding-centric.
- Final identity is based on entry keys and source anchors, not on raw CLI Finding provenance.
- Discovery apply consumes the JSON decision file, never raw harvest output and never Markdown work plans.

## Invariants that later implementation must preserve

- CLI dry-run remains bounded-recall Evidence Harvest, not trusted semantic candidate generation.
- Findings remain mechanical evidence only.
- Semantic decisions are deferred to finalizer and review stages.
- Decision Review is mandatory before apply.
- The main agent remains the only dispatcher.
- Workers never spawn subagents.
- Large runs continue to use manifest/index based recursive map-reduce chunking.
- Project Index persistence continues to include Catalog Entries, Suppressions, Deferrals, and Discovery Fingerprints so unchanged evidence can be pre-classified in later runs.

## Non-goals for this document

- This document does not change CLI behavior.
- This document does not change skill behavior.
- This document does not define final file names for every run artifact.
- This document does not relax ADR 0041 or preserve backward compatibility with the superseded candidate-centric implementation.
