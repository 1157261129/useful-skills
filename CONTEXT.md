# Glossary

## Project Index

A catalog of accepted reusable entries, suppressions, deferrals, and discovery fingerprints for one target project. Multiple working trees that represent the same target project share one project index.

## Target Project

The codebase whose utility classes and recurring template code are being discovered or consulted.

Example: `costs` is one target project even when it is checked out into multiple branch-specific working trees.

## Template Code

A recurring code pattern that appears many times in the target project and is useful for agents to reuse as an implementation example.

## Catalog Entry

A final accepted reusable item stored in the project index, such as a utility artifact, utility member, template pattern, or observed external utility usage.

## Finding

A structural evidence record produced during discovery. A finding is not a recommendation, decision, or catalog entry.

## Finding Evidence Pack

A structurally validated collection of discovery evidence produced by Evidence Harvest. Its schema and anchors must be checkable, but its semantic content is not trusted as a catalog decision.

## Artifact Sanity Gate

A dispatcher-owned validation step that confirms a Finding Evidence Pack is structurally usable before worker review. It does not decide whether any Finding should become a Catalog Entry.

## Review Group

A worker-organized collection of findings that appear to describe the same reusable boundary, repeated pattern, or observed external usage.

## Evidence Harvest

The discovery stage that collects findings from a target project without deciding whether they should become catalog entries.

## Tool Catalog CLI

The shared command-line tool used by the discovery skill and consulting skill to manage and query project indexes.

## Utility Artifact

A language-neutral reusable code unit that contains no business logic and exposes multiple utility capabilities.

## Consulting Skill

The workflow skill that helps an agent query an existing project index while coding.

## Discovery Skill

The user-invoked skill that discovers utility classes and template code, then updates the project index.

## Discovery Review Pack

A Markdown discovery artifact grouped around findings or review groups so discovery workers can organize evidence before final catalog decisions are made.

## Discovery Decision File

A structured JSON artifact created after worker review that records final catalog entries, suppressions, and deferrals. Discovery apply consumes this file when updating the project index.

## Suppression

A recorded discovery decision that prevents unchanged non-entry evidence from repeatedly consuming discovery review effort.

## Deferral

A recorded discovery decision for evidence that is not ready to become a catalog entry but should remain visible to future discovery runs when relevant context changes.

## Discovery Fingerprint

A structural comparison key used to determine whether a catalog entry, suppression, deferral, or finding is unchanged, stale, or new in a later discovery run.

## Utility Class

A Java utility artifact implemented as a class.

## Utility Origin

The project, module, or dependency that provides a utility class.

## Capability Tag

A concise label assigned to a utility artifact, artifact member, or template entry to describe its reusable capability domain, such as date, reflection, string, or array. Entries may have multiple tags, but each tag should represent a core reuse dimension. Member-level tags support precise method selection, while artifact-level tags group related utilities.

## Capability Tag Vocabulary

An open controlled vocabulary of capability tags. Discovery may add project-specific tags, but synonymous terms must be normalized to one canonical tag.

## Selection Description

A concise catalog description that explains when a reusable entry should be selected, including its fit, boundary, or distinction from nearby alternatives.

## Working Tree

A filesystem checkout of a target project. A target project can have multiple working trees.
