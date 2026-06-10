#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FORBIDDEN_SEMANTIC_FIELDS = [
  'action',
  'decision',
  'capability_tags',
  'tags',
  'summary',
  'catalog_prose',
  'description',
  'usage_notes',
  'limitations',
  'suggested_action',
  'recommended_action',
  'risk_flags',
  'risks',
];

const FINDING_GROUPS = [
  'utility_artifacts',
  'observed_external_usages',
  'template_patterns',
];

function usage() {
  return `Usage: validate-evidence-pack.mjs <finding-manifest.json> [--json]\n`;
}

function fail(message) {
  throw new Error(message);
}

function expandHome(value) {
  if (value === '~') {
    return os.homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function readJsonFile(filePath, label) {
  const resolved = path.resolve(expandHome(filePath));
  try {
    return {
      path: resolved,
      data: JSON.parse(fs.readFileSync(resolved, 'utf8')),
    };
  } catch (error) {
    fail(`Unable to read ${label} ${resolved}: ${error.message}`);
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} mismatch: expected ${expected}, got ${actual}.`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertInside(parent, child, label) {
  if (!isInside(parent, child)) {
    fail(`${label} must be inside ${parent}: ${child}`);
  }
}

function assertNotInside(parent, child, label) {
  if (isInside(parent, child)) {
    fail(`${label} must not be inside Target Project root ${parent}: ${child}`);
  }
}

function normalizeStoredPath(value, label) {
  assertString(value, label);
  return path.resolve(expandHome(value));
}

function assertExistingRunFile(filePath, label, catalogHome, projectRoot) {
  const resolved = normalizeStoredPath(filePath, label);
  assertInside(catalogHome, resolved, label);
  assertNotInside(projectRoot, resolved, label);
  if (!fs.existsSync(resolved)) {
    fail(`${label} must exist: ${resolved}`);
  }
  return resolved;
}

function assertSafeRelativePath(value, label) {
  if (value == null) {
    return;
  }
  assertString(value, label);
  if (path.isAbsolute(value)) {
    fail(`${label} must be relative: ${value}`);
  }
  if (value.split(/[\\/]+/).includes('..')) {
    fail(`${label} must not traverse outside the Target Project: ${value}`);
  }
}

function assertAnchor(anchor, label) {
  if (anchor == null) {
    return;
  }
  assertPlainObject(anchor, label);
  assertSafeRelativePath(anchor.path, `${label}.path`);
}

function assertNoSemanticFields(value, label) {
  assertPlainObject(value, label);
  for (const field of FORBIDDEN_SEMANTIC_FIELDS) {
    if (Object.hasOwn(value, field)) {
      fail(`${label} must not include semantic field '${field}'.`);
    }
  }
}

function allFindings(findingsPayload) {
  assertPlainObject(findingsPayload.findings, 'findings.findings');
  return FINDING_GROUPS.flatMap((group) => {
    const values = findingsPayload.findings[group] ?? [];
    assertArray(values, `findings.findings.${group}`);
    return values;
  });
}

function countFindings(findingsPayload) {
  const counts = {};
  for (const group of FINDING_GROUPS) {
    const values = findingsPayload.findings[group] ?? [];
    assertArray(values, `findings.findings.${group}`);
    counts[group] = values.length;
  }
  counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return counts;
}

function assertFinding(finding) {
  assertPlainObject(finding, `Finding ${finding?.finding_id ?? '<unknown>'}`);
  assertString(finding.finding_id, 'finding.finding_id');
  assertString(finding.finding_type, `${finding.finding_id}.finding_type`);
  assertString(finding.discovery_fingerprint, `${finding.finding_id}.discovery_fingerprint`);
  assertNoSemanticFields(finding, `Finding ${finding.finding_id}`);
  assertAnchor(finding.source_anchor, `${finding.finding_id}.source_anchor`);
  assertAnchor(finding.call_anchor, `${finding.finding_id}.call_anchor`);
  for (const member of finding.members ?? []) {
    assertAnchor(member.source_anchor, `${finding.finding_id}.member.source_anchor`);
    assertNoSemanticFields(member, `${finding.finding_id}.member`);
  }
  for (const instance of finding.instances ?? []) {
    assertAnchor(instance.source_anchor, `${finding.finding_id}.instance.source_anchor`);
  }
}

function assertRunFilesMatch(payload, runFiles, label) {
  assertPlainObject(payload.run_files, `${label}.run_files`);
  for (const key of ['run_id', 'run_directory', 'findings_path', 'finding_index_path', 'finding_manifest_path']) {
    assertEqual(payload.run_files[key], runFiles[key], `${label}.run_files.${key}`);
  }
}

function validateEvidencePack(manifestPath) {
  const manifestFile = readJsonFile(manifestPath, 'finding manifest');
  const manifest = manifestFile.data;
  assertPlainObject(manifest, 'finding manifest');
  assertEqual(manifest.kind, 'tool_catalog_discovery_finding_manifest', 'manifest.kind');
  assertEqual(manifest.dry_run, true, 'manifest.dry_run');
  assertEqual(manifest.index_mutated, false, 'manifest.index_mutated');
  assertPlainObject(manifest.project, 'manifest.project');
  assertPlainObject(manifest.finding_counts, 'manifest.finding_counts');
  assertPlainObject(manifest.run_files, 'manifest.run_files');

  const catalogHome = path.resolve(expandHome(process.env.TOOL_CATALOG_HOME ?? path.join(os.homedir(), '.tool-catalog')));
  const projectRoot = normalizeStoredPath(manifest.project.root_path, 'manifest.project.root_path');
  const runFiles = manifest.run_files;
  assertString(runFiles.run_id, 'manifest.run_files.run_id');
  const runDirectory = assertExistingRunFile(runFiles.run_directory, 'run_directory', catalogHome, projectRoot);
  const findingsPath = assertExistingRunFile(runFiles.findings_path, 'findings_path', catalogHome, projectRoot);
  const findingIndexPath = assertExistingRunFile(runFiles.finding_index_path, 'finding_index_path', catalogHome, projectRoot);
  const findingManifestPath = assertExistingRunFile(runFiles.finding_manifest_path, 'finding_manifest_path', catalogHome, projectRoot);
  assertEqual(findingManifestPath, manifestFile.path, 'manifest path');
  assertInside(runDirectory, findingsPath, 'findings_path');
  assertInside(runDirectory, findingIndexPath, 'finding_index_path');
  assertInside(runDirectory, findingManifestPath, 'finding_manifest_path');

  const findings = readJsonFile(findingsPath, 'findings').data;
  const findingIndex = readJsonFile(findingIndexPath, 'finding index').data;
  assertEqual(findings.kind, 'tool_catalog_discovery_findings', 'findings.kind');
  assertEqual(findingIndex.kind, 'tool_catalog_discovery_finding_index', 'finding-index.kind');
  assertRunFilesMatch(findings, runFiles, 'findings');
  assertRunFilesMatch(findingIndex, runFiles, 'finding-index');
  assertArray(findingIndex.items, 'finding-index.items');

  const counts = countFindings(findings);
  assertEqual(counts.utility_artifacts, manifest.finding_counts.utility_artifacts, 'utility artifact count');
  assertEqual(counts.observed_external_usages, manifest.finding_counts.observed_external_usages, 'observed external usage count');
  assertEqual(counts.template_patterns, manifest.finding_counts.template_patterns, 'template pattern count');
  assertEqual(counts.total, manifest.finding_counts.total, 'total finding count');
  assertEqual(findingIndex.items.length, counts.total, 'finding-index.items length');

  const seenIndexIds = new Set();
  for (const item of findingIndex.items) {
    assertPlainObject(item, 'finding-index item');
    assertString(item.finding_id, 'finding-index item.finding_id');
    if (seenIndexIds.has(item.finding_id)) {
      fail(`finding-index.items contains duplicate finding_id: ${item.finding_id}`);
    }
    seenIndexIds.add(item.finding_id);
    assertSafeRelativePath(item.path, `${item.finding_id}.path`);
    assertString(item.discovery_fingerprint, `${item.finding_id}.discovery_fingerprint`);
    assertArray(item.dedupe_keys, `${item.finding_id}.dedupe_keys`);
  }

  for (const finding of allFindings(findings)) {
    assertFinding(finding);
    if (!seenIndexIds.has(finding.finding_id)) {
      fail(`Finding is missing from finding-index.items: ${finding.finding_id}`);
    }
  }

  const reviewQueue = manifest.preclassification?.review_queue ?? [];
  assertArray(reviewQueue, 'manifest.preclassification.review_queue');
  assertEqual(
    reviewQueue.length,
    manifest.preclassification?.finding_counts?.review_queue ?? 0,
    'review queue length',
  );

  return {
    ok: true,
    run_id: runFiles.run_id,
    run_directory: runDirectory,
    findings: counts.total,
    review_queue: reviewQueue.length,
    artifacts: {
      findings_path: findingsPath,
      finding_index_path: findingIndexPath,
      finding_manifest_path: findingManifestPath,
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const json = args.includes('--json');
  const positional = args.filter((arg) => arg !== '--json');
  if (positional.length !== 1) {
    process.stderr.write(usage());
    return 2;
  }

  try {
    const result = validateEvidencePack(positional[0]);
    if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`Finding Evidence Pack OK: ${result.run_id} (${result.findings} findings, ${result.review_queue} queued)\n`);
    }
    return 0;
  } catch (error) {
    if (json) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    } else {
      process.stderr.write(`Finding Evidence Pack invalid: ${error.message}\n`);
    }
    return 2;
  }
}

process.exitCode = main();
