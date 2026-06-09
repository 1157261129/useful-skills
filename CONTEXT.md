# Glossary

## Project Index

A catalog of non-business utility classes and recurring template code discovered for one target project. Multiple working trees that represent the same target project share one project index.

## Target Project

The codebase whose utility classes and recurring template code are being discovered or consulted.

Example: `costs` is one target project even when it is checked out into multiple branch-specific working trees.

## Template Code

A recurring code pattern that appears many times in the target project and is useful for agents to reuse as an implementation example.

## Tool Catalog CLI

The shared command-line tool used by the discovery skill and consulting skill to manage and query project indexes.

## Utility Artifact

A language-neutral reusable code unit that contains no business logic and exposes multiple utility capabilities.

## Consulting Skill

The workflow skill that helps an agent query an existing project index while coding.

## Discovery Skill

The user-invoked skill that discovers utility classes and template code, then updates the project index.

## Discovery Review Pack

A Markdown discovery artifact grouped by utility class or template pattern so the discovery agent can review candidates, decide accepted entries, and identify ambiguous items that need user confirmation.

## Discovery Decision File

A structured JSON artifact created after review that records final accepted, ignored, and deferred discovery decisions. Discovery apply consumes this file when updating the project index.

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
