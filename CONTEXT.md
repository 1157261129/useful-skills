# Glossary

## Project Index

A catalog of accepted reusable entries, suppressions, and discovery fingerprints for one target project. Multiple working trees that represent the same target project share one project index.

## Target Project

The codebase whose project-owned utility artifacts and external utility selectors are being discovered or consulted.

Example: `costs` is one target project even when it is checked out into multiple branch-specific working trees.

## Catalog Entry

A final accepted reusable item stored in the project index, such as a project-owned utility artifact or an external utility class or module selector.

## Catalog Selector

An agent-facing stable identifier for a catalog entry. Selectors use `artifact:<fully-qualified-class-or-relative-module>` for project-owned utilities and `external:<fully-qualified-class-or-module>` for external utilities.

## Finding

A structural evidence record produced during discovery. A finding is not a recommendation, decision, or catalog entry.

## Finding Evidence Pack

A structurally validated collection of discovery evidence produced by Evidence Harvest. Its schema and anchors must be checkable, but its semantic content is not trusted as a catalog decision.

## Artifact Sanity Gate

A dispatcher-owned validation step that confirms a Finding Evidence Pack is structurally usable before worker review. It does not decide whether any Finding should become a Catalog Entry.

## Review Group

A worker-organized collection of findings that appear to describe the same reusable boundary or external utility selector.

## Evidence Harvest

The discovery stage that collects findings from a target project without deciding whether they should become catalog entries.

## Tool Catalog CLI

The shared command-line interface to the Project Index. It provides deterministic database operations for discovery and consulting workflows.

## Utility Artifact

A language-neutral reusable code unit that contains no business logic and exposes multiple utility capabilities.

## Consulting Skill

The workflow skill that helps an agent query an existing project index while coding.

## Discovery Skill

The user-invoked skill that discovers project-owned utility artifacts, external utility selectors, and external origin priority data, then updates the project index.

## Discovery Review Pack

A Markdown discovery artifact grouped around findings or review groups so discovery workers can organize evidence before final catalog decisions are made.

## Discovery Decision File

A structured JSON artifact created after worker review that records final catalog entries and suppressions as database-ready data. Discovery apply consumes this file when updating the project index.

## Suppression

A recorded discovery decision at the project utility artifact, external utility selector, or external utility origin layer that prevents unchanged non-entry evidence from repeatedly consuming discovery review effort. A suppression is not a catalog entry and is not consulted for reuse.

## Discovery Fingerprint

A deterministic opaque string written by discovery to help a later discovery run identify obviously unchanged catalog entries or suppressions.

## Utility Class

A Java utility artifact implemented as a class.

## Utility Origin

A normalized owner used for utility ordering and provenance. Project-owned utility priority belongs to the utility artifact, while external utility priority belongs to the external library or module origin.

## External Origin Usage Count

A discovery-produced count of distinct target project source files that use an external utility origin. Multiple imports or calls in the same source file count once for the same origin.

## Capability Tag

A canonical lowercase label assigned to a project-owned utility artifact or external utility class or module selector to describe its reusable capability domain, such as date, reflection, string, or array.

## Capability Tag Vocabulary

A read-only view of canonical capability tags already attached to accepted catalog entries. Discovery and consulting agents handle synonym normalization outside the CLI.

## Selection Description

A concise English catalog summary that explains when a reusable entry should be selected, including its fit, boundary, or distinction from nearby alternatives.

## Entry Context Metadata

Stable filtering metadata stored on accepted catalog entries. `language` is required on project-owned utility artifacts and external utility selectors; `artifact_type` is required only on project-owned utility artifacts; `framework` is optional on both entry kinds; `module_path` is optional only on project-owned utility artifacts.

## Artifact Priority

A persisted integer ordering value assigned during discovery to a project-owned utility artifact or an external utility module. Lower numeric values indicate higher priority during consulting.

## Working Tree

A filesystem checkout of a target project. A target project can have multiple working trees.
