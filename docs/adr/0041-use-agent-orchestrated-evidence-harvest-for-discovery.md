# Use agent-orchestrated evidence harvest for discovery

Tool Catalog discovery treats the CLI dry-run as a bounded-recall evidence harvest, not as a trusted semantic candidate generator. The CLI emits mechanical Findings, structural metadata, simple deterministic dedupe, and fingerprints; worker subagents perform review grouping, cross-shard merge, local gap audit, semantic finalization, decision review, repair, and apply verification. The main agent is the only dispatcher: it owns the workflow DAG, ready queue, concurrency, worker supervision, durable run artifacts, and user I/O, but it does not perform concrete discovery or final catalog decisions itself.

**Consequences**

- The old candidate-centric discovery model is superseded for new implementation work; backward compatibility with the current unusable implementation is not required.
- CLI output is called a Finding, not a Candidate. Findings are untrusted evidence and must not include accept, ignore, defer, capability tags, summaries, selection descriptions, usage notes, limitations, or recommended actions.
- CLI dry-run optimizes bounded recall and mechanical dedupe. Semantic dedupe, reusable-boundary decisions, business-specific risk judgment, and catalog prose belong to workers.
- Discovery uses a durable run directory as the shared channel. Workers write structured artifacts and minimal `status.md` files; narrative reports are not required.
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
