#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../../..');
const cliPath = path.join(repoRoot, 'tools/tool-catalog-cli/bin/tool-catalog.mjs');

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      TOOL_CATALOG_HOME: options.catalogHome,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(
    result.status,
    options.expect ?? 0,
    `tool-catalog ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  return result;
}

function runCliJson(args, options = {}) {
  const result = runCli([...args, '--json'], options);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Unable to parse CLI JSON from ${args.join(' ')}: ${error.message}\n${result.stdout}`);
  }
}

function runSqliteJson(dbPath, sql) {
  const result = spawnSync('sqlite3', ['-json', dbPath, sql], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(
    result.status,
    0,
    `sqlite3 failed for ${dbPath}\nsql:\n${sql}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  try {
    return JSON.parse(result.stdout || '[]');
  } catch (error) {
    throw new Error(`Unable to parse sqlite3 JSON for ${dbPath}: ${error.message}\n${result.stdout}`);
  }
}

function writeProjectFile(rootPath, relativePath, text) {
  const absolutePath = path.join(rootPath, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${text.trim()}\n`, 'utf8');
}

function createFixture(rootPath) {
  writeProjectFile(rootPath, 'src/main/java/com/acme/common/StringUtils.java', `
package com.acme.common;

public final class StringUtils {
  private StringUtils() {
  }

  public static String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  public static String trimToEmpty(CharSequence value) {
    return value == null ? "" : value.toString().trim();
  }

  public static boolean hasText(String value) {
    return value != null && !value.trim().isEmpty();
  }
}
`);

  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    writeProjectFile(rootPath, `src/main/java/com/acme/web/${name}Controller.java`, `
package com.acme.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ${name}Controller {
  @GetMapping("/${name.toLowerCase()}")
  public String ${name.toLowerCase()}() {
    return "${name.toLowerCase()}";
  }
}
`);
  }

  writeProjectFile(rootPath, 'src/utils/request.ts', `
export function request(url: string) {
  return fetch(url).then((response) => response.json());
}

export const buildQuery = (params: Record<string, string>) => new URLSearchParams(params).toString();
`);

  writeProjectFile(rootPath, 'src/utils/legacy.ts', `
export function legacyFormat(value: string) {
  return value.trim().toUpperCase();
}
`);

  for (const [fileName, functionName, route] of [
    ['orders.ts', 'listOrders', '/api/orders'],
    ['users.ts', 'listUsers', '/api/users'],
    ['invoices.ts', 'listInvoices', '/api/invoices'],
  ]) {
    writeProjectFile(rootPath, `src/api/${fileName}`, `
import { request } from '../utils/request';

export async function ${functionName}() {
  return request('${route}');
}
`);
  }

  writeProjectFile(rootPath, 'src/views/Dashboard.vue', `
<script setup lang="ts">
import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const rows = ref([])
const refresh = useDebounceFn(() => {
  rows.value = []
}, 150)
</script>

<template>
  <el-table :data="rows"></el-table>
</template>
`);
}

function allFindings(output) {
  return [
    ...output.findings.utility_artifacts,
    ...output.findings.observed_external_usages,
    ...output.findings.template_patterns,
  ];
}

function decisionFinding(finding) {
  return {
    ...finding,
    candidate_id: finding.finding_id,
    candidate_type: finding.finding_type,
  };
}

function allDecisionFindings(output) {
  return allFindings(output).map((finding) => decisionFinding(finding));
}

function assertInsidePath(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  assert(
    relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath),
    `${label} must be under ${parentPath}: ${childPath}`,
  );
}

function assertNotInsidePath(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  assert(
    relativePath.startsWith('..') || path.isAbsolute(relativePath),
    `${label} must not be under ${parentPath}: ${childPath}`,
  );
}

function findDecisionFinding(items, predicate, label) {
  const found = items.find(predicate);
  assert(found, `Missing Finding fixture record: ${label}`);
  return found;
}

function assertRelativeAnchor(anchor, label) {
  assert(anchor, `Missing source anchor for ${label}`);
  assert(!path.isAbsolute(anchor.path), `Source anchor must be relative for ${label}: ${anchor.path}`);
  assert(!anchor.path.startsWith('../'), `Source anchor must stay inside project for ${label}: ${anchor.path}`);
  assert(anchor.text.startsWith(`${anchor.path}:`), `Source anchor text must include relative path for ${label}`);
}

function assertFindingAnchorsAreRelative(finding) {
  if (finding.source_anchor) {
    assertRelativeAnchor(finding.source_anchor, finding.finding_id);
  }
  if (finding.call_anchor) {
    assertRelativeAnchor(finding.call_anchor, `${finding.finding_id} call`);
  }
  for (const member of finding.members ?? []) {
    assertRelativeAnchor(member.source_anchor, member.member_key);
  }
  for (const instance of finding.instances ?? []) {
    assertRelativeAnchor(instance.source_anchor, finding.pattern_key ?? finding.finding_id);
  }
}

function loadFindingArtifacts(dryRun) {
  return {
    findings: JSON.parse(readFileSync(dryRun.run_files.findings_path, 'utf8')),
    findingIndex: JSON.parse(readFileSync(dryRun.run_files.finding_index_path, 'utf8')),
    findingManifest: JSON.parse(readFileSync(dryRun.run_files.finding_manifest_path, 'utf8')),
  };
}

function assertNoSemanticFindingFields(finding, label) {
  for (const forbiddenField of [
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
  ]) {
    assert(!(forbiddenField in finding), `${label} must not include ${forbiddenField}`);
  }
}

function assertDiscoveryRunFiles(dryRun, catalogHome, projectRoot, label) {
  assert(dryRun.run_files, `${label} must report dry-run file paths`);
  assertInsidePath(catalogHome, dryRun.run_files.run_directory, `${label} run directory`);
  assertNotInsidePath(projectRoot, dryRun.run_files.run_directory, `${label} run directory`);
  assert.equal('findings' in dryRun, false, `${label} must not print raw findings inline`);
  assert.equal('candidates' in dryRun, false, `${label} must not print raw candidates inline`);

  for (const [key, filePath] of [
    ['findings_path', dryRun.run_files.findings_path],
    ['finding_index_path', dryRun.run_files.finding_index_path],
    ['finding_manifest_path', dryRun.run_files.finding_manifest_path],
  ]) {
    assertInsidePath(catalogHome, filePath, `${label} ${key}`);
    assertNotInsidePath(projectRoot, filePath, `${label} ${key}`);
    assert(existsSync(filePath), `${label} ${key} must exist: ${filePath}`);
  }

  const artifacts = loadFindingArtifacts(dryRun);
  assert.equal(artifacts.findings.kind, 'tool_catalog_discovery_findings');
  assert.equal(artifacts.findingIndex.kind, 'tool_catalog_discovery_finding_index');
  assert.equal(artifacts.findingManifest.kind, 'tool_catalog_discovery_finding_manifest');
  assert.equal(artifacts.findings.project.project_id, dryRun.project.project_id);
  assert.equal(artifacts.findingIndex.items.length, dryRun.finding_counts.total);
  assert.equal(artifacts.findingManifest.finding_counts.total, dryRun.finding_counts.total);
  assert.equal(artifacts.findingManifest.run_files.findings_path, dryRun.run_files.findings_path);

  const seenIndexIds = new Set();
  for (const item of artifacts.findingIndex.items) {
    assert(!seenIndexIds.has(item.finding_id), `${label} finding index must be deduped: ${item.finding_id}`);
    seenIndexIds.add(item.finding_id);
    assert.equal(typeof item.discovery_fingerprint, 'string');
    assert(item.discovery_fingerprint.length > 0, `${label} finding index must include fingerprint`);
    assert(item.dedupe_keys.length > 0, `${label} finding index must include dedupe keys`);
  }

  for (const finding of allFindings(artifacts.findings)) {
    assertFindingAnchorsAreRelative(finding);
    assertNoSemanticFindingFields(finding, `${label} ${finding.finding_id}`);
    assert.equal(typeof finding.discovery_fingerprint, 'string');
    assert.equal(finding.fingerprint_algorithm, 'sha256');
    assert(Array.isArray(finding.structural_evidence), `${label} ${finding.finding_id} must include structural evidence`);
    assert(Array.isArray(finding.mechanical_dedupe.keys), `${label} ${finding.finding_id} must include dedupe keys`);
    assert(
      finding.mechanical_dedupe.keys.some((key) => key.kind === 'fingerprint' && key.value === finding.discovery_fingerprint),
      `${label} ${finding.finding_id} must expose fingerprint dedupe key`,
    );
  }

  return artifacts;
}

function assertTargetProjectClean(projectRoot) {
  for (const relativePath of [
    '.tool-catalog',
    'findings.json',
    'finding-index.json',
    'finding-manifest.json',
  ]) {
    assert(!existsSync(path.join(projectRoot, relativePath)), `Dry-run must not write ${relativePath} into the target project`);
  }
}

function fixtureTags(candidate) {
  if (candidate.candidate_type === 'template_pattern') {
    return ['api-client', 'request'];
  }
  if (candidate.language === 'java') {
    return ['string'];
  }
  if (candidate.language === 'typescript' || candidate.language === 'javascript') {
    return ['http', 'request'];
  }
  return ['utility'];
}

function fixtureMemberDecisions(candidate) {
  return (candidate.members ?? []).map((member) => ({
    member_key: member.member_key,
    summary: `Fixture-approved member ${member.name}.`,
    usage_notes: `Use fixture member ${member.name} when selecting this utility capability.`,
    limitations: 'Fixture member metadata is only used for regression coverage.',
    capability_tags: fixtureTags(candidate),
  }));
}

function candidateTraceAnchor(candidate) {
  return candidate.source_anchor ?? candidate.instances?.[0]?.source_anchor ?? candidate.call_anchor;
}

function fixtureEntryKey(candidate) {
  if (candidate.candidate_type === 'utility_artifact') {
    if (candidate.language === 'java') {
      return 'fixture-artifact:java:string-utils';
    }
    if (candidate.source_anchor?.path === 'src/utils/request.ts') {
      return 'fixture-artifact:typescript:request-utils';
    }
    if (candidate.source_anchor?.path === 'src/utils/legacy.ts') {
      return 'fixture-artifact:typescript:legacy-utils';
    }
  }
  if (candidate.candidate_type === 'observed_external_usage') {
    return 'fixture-external:vueuse:use-debounce-fn';
  }
  if (candidate.candidate_type === 'template_pattern') {
    return `fixture-template:${candidate.pattern_key}`;
  }

  throw new Error(`No fixture entry key mapping for candidate ${candidate.candidate_id}`);
}

function logicalUtilityMembers(members) {
  const grouped = new Map();

  for (const member of members ?? []) {
    const key = member.member_key ?? member.name;
    assert(key, 'Logical utility members require member_key or name');
    const signature = {
      signature: member.signature ?? member.name,
      source_anchor: member.source_anchor,
    };
    const existing = grouped.get(key);
    if (!existing) {
      const groupedMember = { ...member, signatures: [signature] };
      delete groupedMember.signature;
      delete groupedMember.source_anchor;
      grouped.set(key, groupedMember);
      continue;
    }

    if (!existing.signatures.some((item) => item.signature === signature.signature && item.source_anchor?.text === signature.source_anchor?.text)) {
      existing.signatures.push(signature);
    }
  }

  return [...grouped.values()];
}

function finalAcceptedEntry(candidate, decision) {
  const memberDecisions = new Map((decision.members ?? []).map((member) => [member.member_key, member]));
  const { action, ...entryDecision } = decision;
  const mergedMembers = candidate.members?.map((member) => ({
    ...member,
    ...(memberDecisions.get(member.member_key) ?? {}),
  }));
  const entryKey = fixtureEntryKey(candidate);
  const acceptedEntry = {
    ...entryDecision,
    name: candidate.name,
    qualified_name: candidate.qualified_name,
    language: candidate.language,
    framework: candidate.framework,
    module_path: candidate.module_path,
    source_anchor: candidate.source_anchor ?? candidate.call_anchor,
    import_text: candidate.import_text,
    call_text: candidate.call_text,
    snippet: candidate.snippet,
    discovery_fingerprint: candidate.discovery_fingerprint,
    members: candidate.candidate_type === 'utility_artifact'
      ? logicalUtilityMembers(mergedMembers)
      : mergedMembers,
    instances: candidate.instances,
    origin: candidate.origin,
    origin_key: candidate.origin_key,
  };

  if (candidate.candidate_type === 'utility_artifact') {
    acceptedEntry.artifact_key = entryKey;
  } else if (candidate.candidate_type === 'template_pattern') {
    acceptedEntry.pattern_key = entryKey;
  } else if (candidate.candidate_type === 'observed_external_usage') {
    acceptedEntry.usage_key = entryKey;
  }

  return acceptedEntry;
}

function selectFixtureFindings(findingsPayload) {
  const groupedFindings = {
    utility_artifacts: findingsPayload.findings.utility_artifacts.map((finding) => decisionFinding(finding)),
    observed_external_usages: findingsPayload.findings.observed_external_usages.map((finding) => decisionFinding(finding)),
    template_patterns: findingsPayload.findings.template_patterns.map((finding) => decisionFinding(finding)),
  };
  const javaUtility = findDecisionFinding(
    groupedFindings.utility_artifacts,
    (candidate) => candidate.language === 'java' && candidate.name === 'StringUtils' && candidate.members.length >= 2,
    'Java StringUtils utility',
  );
  const tsUtility = findDecisionFinding(
    groupedFindings.utility_artifacts,
    (candidate) => candidate.language === 'typescript' && candidate.source_anchor.path === 'src/utils/request.ts',
    'TypeScript request utility',
  );
  const ignoredUtility = findDecisionFinding(
    groupedFindings.utility_artifacts,
    (candidate) => candidate.source_anchor.path === 'src/utils/legacy.ts',
    'ignored TypeScript legacy utility',
  );
  const externalUsage = findDecisionFinding(
    groupedFindings.observed_external_usages,
    (candidate) => candidate.origin_key === '@vueuse/core' && candidate.call_text?.includes('useDebounceFn'),
    'VueUse observed external usage',
  );
  const templatePattern = findDecisionFinding(
    groupedFindings.template_patterns,
    (candidate) => candidate.pattern_key === 'typescript-api-client-request' && candidate.instance_count >= candidate.threshold,
    'TypeScript API request template',
  );

  return {
    javaUtility,
    tsUtility,
    ignoredUtility,
    externalUsage,
    templatePattern,
  };
}

function selectDeferredFinding(findingsPayload, acceptedIds, ignoredCandidateId) {
  const remaining = allDecisionFindings(findingsPayload)
    .filter((candidate) => !acceptedIds.has(candidate.candidate_id) && candidate.candidate_id !== ignoredCandidateId);
  const preferred = remaining.find((candidate) => candidate.candidate_type === 'utility_artifact')
    ?? remaining.find((candidate) => candidate.candidate_type === 'observed_external_usage')
    ?? remaining[0];
  assert(preferred, 'Fixture must include a second nonaccepted Finding for deferred traceability');
  return preferred;
}

function appendJsUtilityMutation(projectRoot, relativePath, exportName) {
  const absolutePath = path.join(projectRoot, relativePath);
  const text = readFileSync(absolutePath, 'utf8');
  writeFileSync(
    absolutePath,
    `${text.trimEnd()}

export function ${exportName}(value) {
  return value;
}
`,
    'utf8',
  );
}

function appendJavaUtilityMutation(projectRoot, relativePath, methodName) {
  const absolutePath = path.join(projectRoot, relativePath);
  const text = readFileSync(absolutePath, 'utf8');
  assert(text.trimEnd().endsWith('}'), `Java fixture file must end with a closing brace: ${relativePath}`);
  writeFileSync(
    absolutePath,
    `${text.trimEnd().slice(0, -1)}

  public static String ${methodName}(String value) {
    return value;
  }
}
`,
    'utf8',
  );
}

function mutateDeferredCandidate(projectRoot, candidate) {
  if (candidate.candidate_type === 'utility_artifact') {
    if (candidate.language === 'java') {
      appendJavaUtilityMutation(projectRoot, candidate.source_anchor.path, 'deferredRegressionUtility');
      return;
    }
    appendJsUtilityMutation(projectRoot, candidate.source_anchor.path, 'deferredRegressionUtility');
    return;
  }

  if (candidate.candidate_type === 'observed_external_usage') {
    const absolutePath = path.join(projectRoot, candidate.source_anchor.path);
    const text = readFileSync(absolutePath, 'utf8');
    assert(candidate.call_text, 'Observed external usage fixture must include call_text');
    writeFileSync(
      absolutePath,
      text.replace(candidate.call_text, candidate.call_text.replace('useDebounceFn', 'useThrottleFn')),
      'utf8',
    );
    return;
  }

  if (candidate.candidate_type === 'template_pattern') {
    const absolutePath = path.join(projectRoot, candidate.instances[0].source_anchor.path);
    const text = readFileSync(absolutePath, 'utf8');
    if (candidate.pattern_key === 'java-spring-mapping-method') {
      writeFileSync(
        absolutePath,
        text.replace('@GetMapping', '@RequestMapping'),
        'utf8',
      );
      return;
    }
    writeFileSync(
      absolutePath,
      text.replace("return request('/api/orders');", "return fetch('/api/orders').then((response) => response.json());"),
      'utf8',
    );
    return;
  }

  throw new Error(`Unsupported deferred candidate fixture type: ${candidate.candidate_type}`);
}

function assertPreclassificationReason(items, reason, predicate, label) {
  assert(
    items.some((item) => item.reason === reason && predicate(item)),
    label,
  );
}

function reviewedDecisionFile(decisions) {
  const reviewed = JSON.parse(JSON.stringify(decisions));
  return reviewed;
}

function buildDecisions(findingsPayload, acceptedCandidates) {
  const acceptedIds = new Set(acceptedCandidates.map((candidate) => candidate.candidate_id));
  const finalizerDecisions = new Map();

  for (const candidate of acceptedCandidates) {
    finalizerDecisions.set(candidate.candidate_id, {
      summary: `Fixture-approved ${candidate.candidate_type.replace(/_/g, ' ')}.`,
      usage_notes: candidate.candidate_type === 'observed_external_usage'
        ? undefined
        : `Use this ${candidate.candidate_type.replace(/_/g, ' ')} in fixture tests.`,
      limitations: candidate.candidate_type === 'observed_external_usage'
        ? undefined
        : 'Fixture metadata is only used for regression coverage.',
      capability_tags: candidate.candidate_type === 'observed_external_usage' ? undefined : fixtureTags(candidate),
      members: candidate.candidate_type === 'utility_artifact' ? fixtureMemberDecisions(candidate) : undefined,
      origin_display_name: candidate.origin_key === '@vueuse/core' ? 'VueUse core' : undefined,
      origin_priority: candidate.origin === 'external'
        ? { priority: 80, reason: 'Fixture project already uses this external utility.' }
        : { priority: 100, reason: 'Project-owned fixture utility.' },
    });
  }

  const accepted = {
    utility_artifacts: {},
    observed_external_usages: {},
    template_patterns: {},
  };

  for (const candidate of acceptedCandidates) {
    const entry = finalAcceptedEntry(candidate, finalizerDecisions.get(candidate.candidate_id));
    const entryKey = fixtureEntryKey(candidate);
    if (candidate.candidate_type === 'utility_artifact') {
      accepted.utility_artifacts[entryKey] = entry;
    } else if (candidate.candidate_type === 'observed_external_usage') {
      accepted.observed_external_usages[entryKey] = entry;
    } else if (candidate.candidate_type === 'template_pattern') {
      accepted.template_patterns[entryKey] = entry;
    }
  }

  return {
    kind: 'tool_catalog_discovery_decisions',
    version: 1,
    scan: findingsPayload.scan,
    accepted,
    suppressions: allDecisionFindings(findingsPayload)
      .filter((candidate) => !acceptedIds.has(candidate.candidate_id))
      .map((candidate) => ({
        finding_id: candidate.finding_id,
        finding_type: candidate.finding_type,
        source_anchor: candidateTraceAnchor(candidate),
        discovery_fingerprint: candidate.discovery_fingerprint,
        reason: 'Fixture regression intentionally leaves this Finding out of the index.',
      })),
  };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'tool-catalog-regression-'));

try {
  const projectRoot = path.join(tempRoot, 'project');
  const catalogHome = path.join(tempRoot, 'catalog-home');
  const decisionsPath = path.join(tempRoot, 'decisions.json');
  mkdirSync(projectRoot, { recursive: true });
  createFixture(projectRoot);

  const configured = runCliJson(['config', 'project-id', 'fixture-project', '--root', projectRoot], { catalogHome });
  assert.equal(configured.project_id, 'fixture-project');
  assert.equal(configured.identity_source, 'explicit-project-id');

  const info = runCliJson(['config', 'info', '--root', projectRoot], { catalogHome });
  assert.equal(info.project_id, 'fixture-project');
  assert.equal(info.root_path, projectRoot);
  const dbMtimeBeforeDryRun = statSync(info.catalog_path).mtimeMs;

  const help = runCli(['--help'], { catalogHome });
  assert(help.stdout.includes('tool-catalog tags [--root <path>] [--json]'), 'CLI help must list the tags command');
  assert(help.stdout.includes('tool-catalog query --tag <tag> --goal <text>'), 'CLI help must list query tag filtering');
  assert(help.stdout.includes('Harvest discovery Findings and evidence artifacts or apply reviewed decisions.'), 'CLI help must describe discover in Finding-centric terms');
  assert(!help.stdout.includes('Extract reviewable discovery candidates'), 'CLI help must not use candidate-centric discover wording');
  const discoverHelp = runCli(['discover', '--help'], { catalogHome });
  assert(discoverHelp.stdout.includes('Emit Finding evidence artifacts without mutating the project index.'), 'Discover help must describe dry-run as emitting Finding evidence artifacts');
  assert(discoverHelp.stdout.includes('--json prints dry-run Finding summaries and evidence artifact paths or apply summary data as structured JSON.'), 'Discover help must describe JSON dry-run output as Finding summaries plus artifact paths');
  assert(!discoverHelp.stdout.includes('Emit reviewable candidates'), 'Discover help must not describe dry-run as reviewable candidates');
  assert(!discoverHelp.stdout.includes('prints dry-run candidates'), 'Discover help must not describe JSON dry-run output as candidates');
  const tagsHelp = runCli(['tags', '--help'], { catalogHome });
  assert(tagsHelp.stdout.includes('Tool Catalog tags'), 'Tags help must render a dedicated help section');
  const queryHelp = runCli(['query', '--help'], { catalogHome });
  assert(queryHelp.stdout.includes('--tag <tag>'), 'Query help must describe strict capability tag filters');

  const fullDryRun = runCliJson(['discover', '--full', '--dry-run', '--root', projectRoot], { catalogHome });
  assert.equal(fullDryRun.project.project_id, 'fixture-project');
  assert.equal(fullDryRun.index_mutated, false);
  assert.equal(fullDryRun.preclassification.status, 'ready');
  assert.equal(fullDryRun.preclassification.record_counts.total, 0, 'Initial dry-run must see an empty persisted preclassification index');
  assert.equal(fullDryRun.preclassification.finding_counts.new, fullDryRun.finding_counts.total, 'Initial dry-run must classify every finding as new');
  assert.equal(fullDryRun.preclassification.finding_counts.review_queue, fullDryRun.finding_counts.total, 'Initial dry-run must route every finding to review');
  const fullDryRunArtifacts = assertDiscoveryRunFiles(fullDryRun, catalogHome, projectRoot, 'full dry-run');
  assert.equal(statSync(fullDryRun.project.catalog_path).mtimeMs, dbMtimeBeforeDryRun, 'Dry-run must not mutate the project catalog SQLite file');

  const {
    javaUtility,
    tsUtility,
    ignoredUtility,
    externalUsage,
    templatePattern,
  } = selectFixtureFindings(fullDryRunArtifacts.findings);

  assert(ignoredUtility, 'Ignored fixture candidate must exist');
  assert(!fullDryRunArtifacts.findings.findings.template_patterns.some((finding) => finding.pattern_key === 'vue3-element-plus-table-page'), 'Single Vue table page must stay below template threshold');

  const changedBelowThreshold = runCliJson([
    'discover',
    '--changed',
    'src/api/orders.ts',
    'src/api/users.ts',
    '--dry-run',
    '--root',
    projectRoot,
  ], { catalogHome });
  const changedDryRunArtifacts = assertDiscoveryRunFiles(changedBelowThreshold, catalogHome, projectRoot, 'changed dry-run');
  assert.equal(statSync(changedBelowThreshold.project.catalog_path).mtimeMs, dbMtimeBeforeDryRun, 'Changed dry-run must not mutate the project catalog SQLite file');
  assert.equal(
    changedBelowThreshold.finding_counts.template_patterns,
    0,
    'Two changed API files must stay below template threshold',
  );
  assert.equal(
    changedDryRunArtifacts.findings.findings.template_patterns.some((finding) => finding.pattern_key === 'typescript-api-client-request'),
    false,
    'Two changed API files must stay below template threshold',
  );
  assert.equal(changedDryRunArtifacts.findings.findings.template_patterns.length, 0, 'Changed dry-run findings file must keep empty template sections compact');

  const compactDryRun = runCli(['discover', '--full', '--dry-run', '--root', projectRoot], { catalogHome });
  assert(compactDryRun.stdout.includes('Raw Findings'), 'Default dry-run stdout must report raw findings path');
  assert(compactDryRun.stdout.includes('finding-manifest.json'), 'Default dry-run stdout must include finding manifest file name');
  assert(compactDryRun.stdout.includes('## Preclassification'), 'Default dry-run stdout must include the preclassification summary');
  assert(!compactDryRun.stdout.includes('utility-artifact:java:com.acme.common.StringUtils'), 'Default dry-run stdout must not dump utility candidates');
  assert(!compactDryRun.stdout.includes('structural_evidence'), 'Default dry-run stdout must not dump raw finding evidence');
  assertTargetProjectClean(projectRoot);

  const missingTagsPath = path.join(tempRoot, 'missing-tags-decisions.json');
  const missingTagsDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  delete missingTagsDecisions.accepted.utility_artifacts[fixtureEntryKey(javaUtility)].capability_tags;
  writeFileSync(missingTagsPath, `${JSON.stringify(reviewedDecisionFile(missingTagsDecisions), null, 2)}\n`, 'utf8');
  const missingTagsApply = runCli(['discover', '--apply', missingTagsPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingTagsApply.stderr.includes('capability_tags'), 'Apply must reject accepted utility artifacts without tags');

  const missingSummaryPath = path.join(tempRoot, 'missing-summary-decisions.json');
  const missingSummaryDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  delete missingSummaryDecisions.accepted.utility_artifacts[fixtureEntryKey(javaUtility)].summary;
  writeFileSync(missingSummaryPath, `${JSON.stringify(reviewedDecisionFile(missingSummaryDecisions), null, 2)}\n`, 'utf8');
  const missingSummaryApply = runCli(['discover', '--apply', missingSummaryPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingSummaryApply.stderr.includes('summary'), 'Apply must reject accepted utility artifacts without summary');

  const missingSourceAnchorPath = path.join(tempRoot, 'missing-source-anchor-decisions.json');
  const missingSourceAnchorDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  delete missingSourceAnchorDecisions.accepted.utility_artifacts[fixtureEntryKey(javaUtility)].source_anchor;
  writeFileSync(missingSourceAnchorPath, `${JSON.stringify(reviewedDecisionFile(missingSourceAnchorDecisions), null, 2)}\n`, 'utf8');
  const missingSourceAnchorApply = runCli(['discover', '--apply', missingSourceAnchorPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingSourceAnchorApply.stderr.includes('source_anchor'), 'Apply must reject accepted utility artifacts without source anchors');

  const missingMembersPath = path.join(tempRoot, 'missing-members-decisions.json');
  const missingMembersDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  missingMembersDecisions.accepted.utility_artifacts[fixtureEntryKey(javaUtility)].members = [];
  writeFileSync(missingMembersPath, `${JSON.stringify(reviewedDecisionFile(missingMembersDecisions), null, 2)}\n`, 'utf8');
  const missingMembersApply = runCli(['discover', '--apply', missingMembersPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingMembersApply.stderr.includes('at least one member'), 'Apply must reject accepted utility artifacts without reusable members');

  const missingTemplateInstancesPath = path.join(tempRoot, 'missing-template-instances-decisions.json');
  const missingTemplateInstancesDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  missingTemplateInstancesDecisions.accepted.template_patterns[fixtureEntryKey(templatePattern)].instances = [];
  writeFileSync(missingTemplateInstancesPath, `${JSON.stringify(reviewedDecisionFile(missingTemplateInstancesDecisions), null, 2)}\n`, 'utf8');
  const missingTemplateInstancesApply = runCli(['discover', '--apply', missingTemplateInstancesPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingTemplateInstancesApply.stderr.includes('representative instances'), 'Apply must reject accepted template patterns without representative instances');

  const mismatchedArtifactKeyPath = path.join(tempRoot, 'mismatched-artifact-key-decisions.json');
  const mismatchedArtifactKeyDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  mismatchedArtifactKeyDecisions.accepted.utility_artifacts[fixtureEntryKey(javaUtility)].artifact_key = 'artifact:conflicting-utility-key';
  writeFileSync(mismatchedArtifactKeyPath, `${JSON.stringify(reviewedDecisionFile(mismatchedArtifactKeyDecisions), null, 2)}\n`, 'utf8');
  const mismatchedArtifactKeyApply = runCli(['discover', '--apply', mismatchedArtifactKeyPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(mismatchedArtifactKeyApply.stderr.includes('artifact_key aligned with the map key'), 'Apply must reject accepted utility artifacts whose payload artifact_key conflicts with the map key');

  const mismatchedTemplateKeyPath = path.join(tempRoot, 'mismatched-template-key-decisions.json');
  const mismatchedTemplateKeyDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  mismatchedTemplateKeyDecisions.accepted.template_patterns[fixtureEntryKey(templatePattern)].pattern_key = 'template:conflicting-template-key';
  writeFileSync(mismatchedTemplateKeyPath, `${JSON.stringify(reviewedDecisionFile(mismatchedTemplateKeyDecisions), null, 2)}\n`, 'utf8');
  const mismatchedTemplateKeyApply = runCli(['discover', '--apply', mismatchedTemplateKeyPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(mismatchedTemplateKeyApply.stderr.includes('pattern_key aligned with the map key'), 'Apply must reject accepted template patterns whose payload pattern_key conflicts with the map key');

  const mismatchedUsageKeyPath = path.join(tempRoot, 'mismatched-usage-key-decisions.json');
  const mismatchedUsageKeyDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  mismatchedUsageKeyDecisions.accepted.observed_external_usages[fixtureEntryKey(externalUsage)].usage_key = 'external:conflicting-usage-key';
  writeFileSync(mismatchedUsageKeyPath, `${JSON.stringify(reviewedDecisionFile(mismatchedUsageKeyDecisions), null, 2)}\n`, 'utf8');
  const mismatchedUsageKeyApply = runCli(['discover', '--apply', mismatchedUsageKeyPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(mismatchedUsageKeyApply.stderr.includes('usage_key aligned with the map key'), 'Apply must reject accepted external usages whose payload usage_key conflicts with the map key');

  const legacyDecisionsPath = path.join(tempRoot, 'legacy-decisions.json');
  const legacyDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  legacyDecisions.ignored_candidates = [];
  writeFileSync(legacyDecisionsPath, `${JSON.stringify(reviewedDecisionFile(legacyDecisions), null, 2)}\n`, 'utf8');
  const legacyDecisionsApply = runCli(['discover', '--apply', legacyDecisionsPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(legacyDecisionsApply.stderr.includes("field 'ignored_candidates' is no longer supported"), 'Apply must reject legacy candidate-centric decision fields');

  const decisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, externalUsage, templatePattern]);
  const acceptedIds = new Set([javaUtility, tsUtility, externalUsage, templatePattern].map((candidate) => candidate.candidate_id));
  const deferredCandidate = selectDeferredFinding(fullDryRunArtifacts.findings, acceptedIds, ignoredUtility.candidate_id);
  decisions.suppressions = decisions.suppressions.filter((candidate) => candidate.finding_id !== deferredCandidate.candidate_id);
  decisions.deferrals = [{
    finding_id: deferredCandidate.finding_id,
    finding_type: deferredCandidate.finding_type,
    source_anchor: candidateTraceAnchor(deferredCandidate),
    discovery_fingerprint: deferredCandidate.discovery_fingerprint,
    reason: 'Fixture regression keeps this Finding deferred for user review.',
  }];
  writeFileSync(decisionsPath, `${JSON.stringify(reviewedDecisionFile(decisions), null, 2)}\n`, 'utf8');

  const applySummary = runCliJson(['discover', '--apply', decisionsPath, '--root', projectRoot], { catalogHome });
  assert.equal(applySummary.index_mutated, true);
  assert.equal(applySummary.decisions.accepted_utility_artifacts, 2);
  assert.equal(applySummary.decisions.accepted_observed_external_usages, 1);
  assert.equal(applySummary.decisions.accepted_template_patterns, 1);
  assert(applySummary.decisions.suppressions > 0, 'Apply must persist suppressions');
  assert.equal(applySummary.decisions.deferrals, 1);
  assert(applySummary.counts.after.ignored_candidates > 0, 'Ignored candidates must be present in SQLite counts');
  assert.equal(applySummary.counts.after.deferred_candidates, 1, 'Deferred candidates must be present in SQLite counts');
  assert(applySummary.counts.after.member_signatures > 0, 'Member signatures must be present in SQLite counts');
  assert(applySummary.counts.after.capability_tags > 0, 'Capability tags must be present in SQLite counts');
  assert(applySummary.counts.after.entry_capability_tags > 0, 'Entry-tag associations must be present in SQLite counts');
  assert(existsSync(applySummary.project.catalog_path), 'Apply must create the project catalog');
  assert(
    runSqliteJson(
      applySummary.project.catalog_path,
      `SELECT candidate_key FROM ignored_candidates WHERE candidate_key = '${ignoredUtility.candidate_id}';`,
    ).length === 1,
    'Initial apply must persist the ignored fixture candidate trace row',
  );
  assert(
    runSqliteJson(
      applySummary.project.catalog_path,
      `SELECT candidate_key FROM deferred_candidates WHERE candidate_key = '${deferredCandidate.candidate_id}';`,
    ).length === 1,
    'Initial apply must persist the deferred fixture candidate trace row',
  );
  const storedFingerprintRows = runSqliteJson(
    applySummary.project.catalog_path,
    'SELECT record_family, record_kind, record_key FROM discovery_fingerprints ORDER BY record_family, record_kind, record_key;',
  );
  assert.equal(
    storedFingerprintRows.length,
    4 + applySummary.decisions.suppressions + applySummary.decisions.deferrals,
    'Initial apply must persist structural fingerprints for accepted entries, suppressions, and deferrals',
  );

  const preclassProjectRoot = path.join(tempRoot, 'preclassification-project');
  const preclassCatalogHome = path.join(tempRoot, 'preclassification-catalog-home');
  const preclassDecisionsPath = path.join(tempRoot, 'preclassification-decisions.json');
  mkdirSync(preclassProjectRoot, { recursive: true });
  createFixture(preclassProjectRoot);
  runCliJson(['config', 'project-id', 'fixture-preclassification', '--root', preclassProjectRoot], { catalogHome: preclassCatalogHome });
  const preclassFullDryRun = runCliJson(['discover', '--full', '--dry-run', '--root', preclassProjectRoot], { catalogHome: preclassCatalogHome });
  const preclassArtifacts = assertDiscoveryRunFiles(preclassFullDryRun, preclassCatalogHome, preclassProjectRoot, 'preclassification seed dry-run');
  const preclassCandidates = selectFixtureFindings(preclassArtifacts.findings);
  const preclassAcceptedIds = new Set([
    preclassCandidates.javaUtility,
    preclassCandidates.tsUtility,
    preclassCandidates.externalUsage,
    preclassCandidates.templatePattern,
  ].map((candidate) => candidate.candidate_id));
  const preclassDeferredCandidate = selectDeferredFinding(
    preclassArtifacts.findings,
    preclassAcceptedIds,
    preclassCandidates.ignoredUtility.candidate_id,
  );
  const preclassDecisions = buildDecisions(preclassArtifacts.findings, [
    preclassCandidates.javaUtility,
    preclassCandidates.tsUtility,
    preclassCandidates.externalUsage,
    preclassCandidates.templatePattern,
  ]);
  preclassDecisions.suppressions = preclassDecisions.suppressions
    .filter((candidate) => candidate.finding_id !== preclassDeferredCandidate.candidate_id);
  preclassDecisions.deferrals = [{
    finding_id: preclassDeferredCandidate.finding_id,
    finding_type: preclassDeferredCandidate.finding_type,
    source_anchor: candidateTraceAnchor(preclassDeferredCandidate),
    discovery_fingerprint: preclassDeferredCandidate.discovery_fingerprint,
    reason: 'Fixture preclassification keeps this Finding deferred for later review.',
  }];
  writeFileSync(preclassDecisionsPath, `${JSON.stringify(reviewedDecisionFile(preclassDecisions), null, 2)}\n`, 'utf8');
  const preclassApplySummary = runCliJson(['discover', '--apply', preclassDecisionsPath, '--root', preclassProjectRoot], { catalogHome: preclassCatalogHome });
  const unchangedPreclass = runCliJson(['discover', '--full', '--dry-run', '--root', preclassProjectRoot], { catalogHome: preclassCatalogHome });
  assert.equal(unchangedPreclass.preclassification.status, 'ready');
  assert.equal(unchangedPreclass.preclassification.index.schema_version, 5);
  assert.equal(unchangedPreclass.preclassification.record_counts.catalog_entries, 4, 'Preclassification must persist accepted catalog entry fingerprints');
  assert.equal(unchangedPreclass.preclassification.record_counts.deferrals, 1, 'Preclassification must persist deferred fingerprints');
  assert.equal(
    unchangedPreclass.preclassification.record_counts.suppressions,
    preclassApplySummary.decisions.suppressions,
    'Preclassification must persist suppression fingerprints',
  );
  assert.equal(unchangedPreclass.preclassification.finding_counts.review_queue, 0, 'Unchanged reruns must not resend persisted evidence to worker review');
  assert.equal(unchangedPreclass.preclassification.finding_counts.new, 0, 'Unchanged reruns must not treat persisted evidence as new');
  assert.equal(unchangedPreclass.preclassification.finding_counts.unchanged_catalog_entries, 4, 'Accepted entries must classify as unchanged');
  assert.equal(
    unchangedPreclass.preclassification.finding_counts.unchanged_suppressions,
    preclassApplySummary.decisions.suppressions,
    'Suppressed findings must classify as unchanged suppressions',
  );
  assert.equal(unchangedPreclass.preclassification.finding_counts.unchanged_deferrals, 1, 'Deferred findings must classify as unchanged deferrals');
  assert.equal(unchangedPreclass.preclassification.cleanup_counts.total, 0, 'Unchanged reruns must not emit cleanup work');

  const staleDeferralProjectRoot = path.join(tempRoot, 'stale-deferral-project');
  const staleDeferralCatalogHome = path.join(tempRoot, 'stale-deferral-catalog-home');
  const staleDeferralDecisionsPath = path.join(tempRoot, 'stale-deferral-decisions.json');
  mkdirSync(staleDeferralProjectRoot, { recursive: true });
  createFixture(staleDeferralProjectRoot);
  runCliJson(['config', 'project-id', 'fixture-stale-deferral', '--root', staleDeferralProjectRoot], { catalogHome: staleDeferralCatalogHome });
  const staleDeferralSeedDryRun = runCliJson(['discover', '--full', '--dry-run', '--root', staleDeferralProjectRoot], { catalogHome: staleDeferralCatalogHome });
  const staleDeferralArtifacts = assertDiscoveryRunFiles(staleDeferralSeedDryRun, staleDeferralCatalogHome, staleDeferralProjectRoot, 'stale deferral seed dry-run');
  const staleDeferralCandidates = selectFixtureFindings(staleDeferralArtifacts.findings);
  const staleDeferredCandidate = staleDeferralCandidates.ignoredUtility;
  const staleDeferralDecisions = buildDecisions(staleDeferralArtifacts.findings, [
    staleDeferralCandidates.javaUtility,
    staleDeferralCandidates.tsUtility,
    staleDeferralCandidates.externalUsage,
    staleDeferralCandidates.templatePattern,
  ]);
  staleDeferralDecisions.suppressions = staleDeferralDecisions.suppressions
    .filter((candidate) => candidate.finding_id !== staleDeferredCandidate.candidate_id);
  staleDeferralDecisions.deferrals = [{
    finding_id: staleDeferredCandidate.finding_id,
    finding_type: staleDeferredCandidate.finding_type,
    source_anchor: candidateTraceAnchor(staleDeferredCandidate),
    discovery_fingerprint: staleDeferredCandidate.discovery_fingerprint,
    reason: 'Fixture regression keeps this Finding deferred until it changes.',
  }];
  writeFileSync(staleDeferralDecisionsPath, `${JSON.stringify(reviewedDecisionFile(staleDeferralDecisions), null, 2)}\n`, 'utf8');
  runCliJson(['discover', '--apply', staleDeferralDecisionsPath, '--root', staleDeferralProjectRoot], { catalogHome: staleDeferralCatalogHome });
  mutateDeferredCandidate(staleDeferralProjectRoot, staleDeferredCandidate);

  const staleDeferredPreclass = runCliJson(['discover', '--full', '--dry-run', '--root', staleDeferralProjectRoot], { catalogHome: staleDeferralCatalogHome });
  assert.equal(staleDeferredPreclass.preclassification.finding_counts.review_queue, 1, 'Changed deferred evidence must reopen for review');
  assert.equal(staleDeferredPreclass.preclassification.finding_counts.reopened_deferrals, 1, 'Changed deferred evidence must classify as reopened deferral review work');
  assert.equal(staleDeferredPreclass.preclassification.cleanup_counts.total, 0, 'Changed deferred evidence must stay in review rather than cleanup when source still exists');
  assertPreclassificationReason(
    staleDeferredPreclass.preclassification.review_queue,
    'stale-deferral',
    (item) => item.matched_record?.record_key === staleDeferredCandidate.candidate_id,
    'Changed deferred evidence must reopen as stale deferral review work',
  );

  appendJsUtilityMutation(preclassProjectRoot, 'src/utils/request.ts', 'requestRegressionMutation');
  appendJsUtilityMutation(preclassProjectRoot, 'src/utils/legacy.ts', 'legacyRegressionMutation');
  mutateDeferredCandidate(preclassProjectRoot, preclassDeferredCandidate);
  rmSync(path.join(preclassProjectRoot, 'src/views/Dashboard.vue'));

  const changedPreclass = runCliJson(['discover', '--full', '--dry-run', '--root', preclassProjectRoot], { catalogHome: preclassCatalogHome });
  assert.equal(changedPreclass.preclassification.finding_counts.review_queue, 2, 'Changed reruns must reopen changed entries and stale suppressions for review');
  assert.equal(changedPreclass.preclassification.finding_counts.reopened_catalog_entries, 1, 'Changed accepted entry must reopen for review');
  assert.equal(changedPreclass.preclassification.finding_counts.reopened_suppressions, 1, 'Changed suppression must reopen for review');
  assert.equal(changedPreclass.preclassification.finding_counts.reopened_deferrals, 0, 'Missing-source deferrals should leave review and enter cleanup reporting instead');
  assert.equal(changedPreclass.preclassification.cleanup_counts.missing_source_records, 2, 'Missing-source records must be reported for cleanup');
  assertPreclassificationReason(
    changedPreclass.preclassification.review_queue,
    'changed-catalog-entry',
    (item) => item.matched_record?.record_key === fixtureEntryKey(preclassCandidates.tsUtility),
    'Changed accepted utility must be reopened as a catalog entry review item',
  );
  assertPreclassificationReason(
    changedPreclass.preclassification.review_queue,
    'stale-suppression',
    (item) => item.matched_record?.record_key === preclassCandidates.ignoredUtility.candidate_id,
    'Changed suppressed utility must reopen as stale suppression review work',
  );
  assertPreclassificationReason(
    changedPreclass.preclassification.cleanup_queue,
    'missing-source',
    (item) => item.record_key === fixtureEntryKey(preclassCandidates.externalUsage),
    'Missing-source accepted external usage must be reported for cleanup',
  );
  assertPreclassificationReason(
    changedPreclass.preclassification.cleanup_queue,
    'missing-source',
    (item) => item.record_key === preclassDeferredCandidate.candidate_id,
    'Missing-source deferred evidence must be reported for cleanup',
  );

  const replayDecisions = buildDecisions(fullDryRunArtifacts.findings, [javaUtility, tsUtility, ignoredUtility, deferredCandidate, externalUsage, templatePattern]);
  writeFileSync(decisionsPath, `${JSON.stringify(reviewedDecisionFile(replayDecisions), null, 2)}\n`, 'utf8');
  const replaySummary = runCliJson(['discover', '--apply', decisionsPath, '--root', projectRoot], { catalogHome });
  assert.equal(replaySummary.index_mutated, true);
  assert.equal(
    runSqliteJson(
      replaySummary.project.catalog_path,
      `SELECT candidate_key FROM ignored_candidates WHERE candidate_key = '${ignoredUtility.candidate_id}';`,
    ).length,
    0,
    'Re-applying accepted decisions must remove stale ignored trace rows for promoted candidates',
  );
  assert.equal(
    runSqliteJson(
      replaySummary.project.catalog_path,
      `SELECT candidate_key FROM deferred_candidates WHERE candidate_key = '${deferredCandidate.candidate_id}';`,
    ).length,
    0,
    'Re-applying accepted decisions must remove stale deferred trace rows for promoted candidates',
  );

  const dbMtimeBeforeConsulting = statSync(replaySummary.project.catalog_path).mtimeMs;

  const tagsOutput = runCliJson(['tags', '--root', projectRoot], { catalogHome });
  assert.equal(tagsOutput.kind, 'tool_catalog_tags');
  assert.equal(tagsOutput.index_mutated, false);
  assert(tagsOutput.tags.length >= 4, 'Tags command must list the current vocabulary');
  const stringTag = tagsOutput.tags.find((entry) => entry.tag === 'string');
  assert(stringTag, 'Tags command must include canonical string');
  assert.equal(typeof stringTag.description, 'string');
  assert(stringTag.description.length > 0, 'Tags command must include concise descriptions');
  assert.deepEqual(stringTag.aliases, ['strings', 'text']);
  assert(stringTag.entry_count >= 3, 'String tag must count the accepted artifact-level and member-level entries');
  const requestTag = tagsOutput.tags.find((entry) => entry.tag === 'request');
  assert(requestTag, 'Tags command must include canonical request');
  assert(requestTag.entry_count >= 4, 'Request tag must count all accepted request-tagged entries');
  assert(requestTag.entry_count > stringTag.entry_count, 'Request tag should reflect the broader fixture coverage than string');
  const tagsMarkdown = runCli(['tags', '--root', projectRoot], { catalogHome });
  assert(tagsMarkdown.stdout.includes('## Tags'), 'Markdown tags output must include a tags section');
  assert(tagsMarkdown.stdout.includes('Aliases: `strings`, `text`'), 'Markdown tags output must surface optional aliases');

  const utilityQuery = runCliJson([
    'query',
    '--tag',
    'http',
    '--goal',
    'request api helper',
    '--current-file',
    'src/api/orders.ts',
    '--language',
    'typescript',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert.equal(utilityQuery.index_mutated, false);
  assert(
    utilityQuery.results.some((result) => result.selector === `artifact:${fixtureEntryKey(tsUtility)}`),
    'Tag query must return the accepted TypeScript utility artifact group',
  );
  const groupedUtility = utilityQuery.results.find((result) => result.selector === `artifact:${fixtureEntryKey(tsUtility)}`);
  assert.equal(groupedUtility.kind, 'artifact');
  assert.equal(groupedUtility.matched_by, 'member');
  assert.equal(groupedUtility.summary, 'Fixture-approved utility artifact.');
  assert(groupedUtility.matching_members.length > 0, 'Grouped artifact results must retain matching members');
  assert(
    groupedUtility.matching_members.some((member) => member.selector === `member:${tsUtility.members[0].member_key}`),
    'Grouped artifact results must surface the matching accepted member selector',
  );
  assert(
    utilityQuery.results.every((result) => result.kind !== 'member'),
    'Query output must group matching members under their artifact instead of returning flat member rows',
  );
  const utilityQueryMarkdown = runCli([
    'query',
    '--tag',
    'http',
    '--goal',
    'request api helper',
    '--current-file',
    'src/api/orders.ts',
    '--language',
    'typescript',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(utilityQueryMarkdown.stdout.includes('Matching members:'), 'Markdown query output must group matching members under the artifact');

  const overloadedMemberKey = 'com.acme.common.StringUtils#trimToEmpty';
  const overloadQuery = runCliJson([
    'query',
    '--tag',
    'string',
    '--goal',
    'trim empty charsequence',
    '--language',
    'java',
    '--root',
    projectRoot,
  ], { catalogHome });
  const overloadArtifactSelector = `artifact:${fixtureEntryKey(javaUtility)}`;
  const overloadArtifactGroup = overloadQuery.results.find((result) => result.selector === overloadArtifactSelector);
  assert(overloadArtifactGroup, 'Query must keep overloaded logical members grouped under the Java artifact');
  assert.equal(overloadArtifactGroup.matched_by, 'member');
  const overloadMember = overloadArtifactGroup.matching_members.find((member) => member.selector === `member:${overloadedMemberKey}`);
  assert(overloadMember, 'Grouped query results must surface the overloaded logical member');
  assert.equal(overloadMember.signatures.length, 2);
  const overloadQueryMarkdown = runCli([
    'query',
    '--tag',
    'string',
    '--goal',
    'trim empty charsequence',
    '--language',
    'java',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(overloadQueryMarkdown.stdout.includes('trimToEmpty(String value)'), 'Markdown query output must surface the first overload signature');
  assert(overloadQueryMarkdown.stdout.includes('trimToEmpty(CharSequence value)'), 'Markdown query output must surface the second overload signature');

  const javaQuery = runCliJson([
    'query',
    '--tag',
    'string',
    '--goal',
    'trim text',
    '--language',
    'java',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(
    javaQuery.results.some((result) => result.selector === `artifact:${fixtureEntryKey(javaUtility)}`),
    'Tag query must return the accepted Java utility artifact group',
  );

  const multiTagAndQuery = runCliJson([
    'query',
    '--tag',
    'request',
    '--tag',
    'http',
    '--goal',
    'request helper',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(
    multiTagAndQuery.results.some((result) => result.selector === `artifact:${fixtureEntryKey(tsUtility)}`),
    'Multiple tag filters must retain entries that satisfy every requested tag',
  );
  assert(
    multiTagAndQuery.results.every((result) => result.selector !== `template:${fixtureEntryKey(templatePattern)}`),
    'Multiple tag filters must exclude entries that miss any requested tag',
  );

  const templateTagQuery = runCliJson([
    'query',
    '--tag',
    'request',
    '--tag',
    'api-client',
    '--goal',
    'api request template',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(
    templateTagQuery.results.some((result) => result.selector === `template:${fixtureEntryKey(templatePattern)}`),
    'Template tag query must preserve template pattern results',
  );

  const externalQuery = runCliJson([
    'query',
    '--goal',
    'debounce vueuse',
    '--artifact-type',
    'external_usage',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(
    externalQuery.results.some((result) => result.selector === `external:${fixtureEntryKey(externalUsage)}`),
    'Query must return observed external usage',
  );

  const noResultTagQuery = runCliJson([
    'query',
    '--tag',
    'string',
    '--goal',
    'request helper',
    '--root',
    projectRoot,
  ], {
    catalogHome,
  });
  assert.equal(noResultTagQuery.results.length, 0, 'Strict tag filtering must allow empty results');
  assert(
    noResultTagQuery.warnings.some((warning) => warning.includes('tool-catalog tags') && warning.includes('without --tag')),
    'No-result tag queries must suggest one vocabulary remap or one broadened no-tag retry',
  );

  const showArtifact = runCliJson(['show', `artifact:${fixtureEntryKey(tsUtility)}`, '--root', projectRoot], { catalogHome });
  assert.equal(showArtifact.found, true);
  assert.equal(showArtifact.entry.kind, 'artifact');
  assert.equal(showArtifact.entry.summary, 'Fixture-approved utility artifact.');
  assert.deepEqual(showArtifact.entry.capability_tags.map((item) => item.tag), ['http', 'request']);
  assert.equal(showArtifact.entry.usage_notes, 'Use this utility artifact in fixture tests.');
  assert.equal(showArtifact.entry.limitations, 'Fixture metadata is only used for regression coverage.');
  assert(showArtifact.entry.members.every((member) => member.capability_tags.length > 0), 'Artifact members must surface capability tags');
  assert(showArtifact.entry.members.every((member) => member.usage_notes), 'Artifact members must surface usage notes');
  assertRelativeAnchor(showArtifact.entry.source_anchor, showArtifact.entry.selector);
  const showArtifactMarkdown = runCli(['show', `artifact:${fixtureEntryKey(tsUtility)}`, '--root', projectRoot], { catalogHome });
  assert(showArtifactMarkdown.stdout.includes('Fixture-approved utility artifact.'), 'Markdown show must surface the accepted summary');
  assert(showArtifactMarkdown.stdout.includes('- Tags: `http`, `request`'), 'Markdown show must surface tags');
  assert(showArtifactMarkdown.stdout.includes('- Usage notes: Use this utility artifact in fixture tests.'), 'Markdown show must surface usage notes');

  const showJavaArtifact = runCliJson(['show', `artifact:${fixtureEntryKey(javaUtility)}`, '--root', projectRoot], { catalogHome });
  assert.equal(showJavaArtifact.found, true);
  assert.equal(showJavaArtifact.entry.kind, 'artifact');
  assertRelativeAnchor(showJavaArtifact.entry.source_anchor, showJavaArtifact.entry.selector);
  const overloadedJavaMember = showJavaArtifact.entry.members.find((member) => member.identifier === overloadedMemberKey);
  assert(overloadedJavaMember, 'Show artifact must include the logical overloaded member');
  assert.equal(showJavaArtifact.entry.members.filter((member) => member.identifier === overloadedMemberKey).length, 1, 'Show artifact must not duplicate overload rows');
  assert.equal(overloadedJavaMember.signature_count, 2);
  assert.equal(overloadedJavaMember.signatures.length, 2);
  for (const signature of overloadedJavaMember.signatures) {
    assertRelativeAnchor(signature.source_anchor, overloadedJavaMember.identifier);
  }
  const showJavaArtifactMarkdown = runCli(['show', `artifact:${fixtureEntryKey(javaUtility)}`, '--root', projectRoot], { catalogHome });
  assert(showJavaArtifactMarkdown.stdout.includes('- Signatures: 2'), 'Artifact markdown must surface overload signatures compactly');

  const showJavaMember = runCliJson(['show', `member:${overloadedMemberKey}`, '--root', projectRoot], { catalogHome });
  assert.equal(showJavaMember.found, true);
  assert.equal(showJavaMember.entry.summary, 'Fixture-approved member trimToEmpty.');
  assert.equal(showJavaMember.entry.signature_count, 2);
  assert.equal(showJavaMember.entry.signatures.length, 2);

  const showTemplate = runCliJson(['show', `template:${fixtureEntryKey(templatePattern)}`, '--root', projectRoot], { catalogHome });
  assert.equal(showTemplate.found, true);
  assert.equal(showTemplate.entry.summary, 'Fixture-approved template pattern.');
  assert.deepEqual(showTemplate.entry.capability_tags.map((item) => item.tag), ['api-client', 'request']);
  assert.equal(showTemplate.entry.usage_notes, 'Use this template pattern in fixture tests.');
  assert.equal(showTemplate.entry.limitations, 'Fixture metadata is only used for regression coverage.');
  assert.equal(showTemplate.entry.instance_count, 3);
  for (const instance of showTemplate.entry.instances) {
    assertRelativeAnchor(instance.source_anchor, instance.source_anchor.text);
  }

  const verifyArtifact = runCliJson(['verify', `artifact:${fixtureEntryKey(tsUtility)}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyArtifact.ok, true);
  assert.equal(verifyArtifact.status, 'verified');

  const verifyJavaArtifact = runCliJson(['verify', `artifact:${fixtureEntryKey(javaUtility)}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyJavaArtifact.ok, true);
  assert.equal(verifyJavaArtifact.status, 'verified');
  const verifyJavaMember = runCliJson(['verify', `member:${overloadedMemberKey}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyJavaMember.ok, true);
  assert.equal(verifyJavaMember.status, 'verified');
  assert.equal(verifyJavaMember.checks.filter((check) => check.label.startsWith('member:signature:')).length, 2, 'Verify must check each stored overload signature');

  const verifyTemplate = runCliJson(['verify', `template:${fixtureEntryKey(templatePattern)}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyTemplate.ok, true);
  assert.equal(verifyTemplate.status, 'verified');

  const verifyExternal = runCliJson(['verify', `external:${fixtureEntryKey(externalUsage)}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyExternal.ok, true);
  assert.equal(verifyExternal.status, 'verified');

  const dbMtimeAfterConsulting = statSync(replaySummary.project.catalog_path).mtimeMs;
  assert.equal(dbMtimeAfterConsulting, dbMtimeBeforeConsulting, 'query/show/verify must be read-only');

  const vuePath = path.join(projectRoot, 'src/views/Dashboard.vue');
  const vueText = readFileSync(vuePath, 'utf8');
  writeFileSync(
    vuePath,
    vueText.replace(`const refresh = useDebounceFn(() => {
  rows.value = []
}, 150)`, 'const refresh = () => undefined'),
    'utf8',
  );
  const staleExternal = runCliJson(['verify', `external:${fixtureEntryKey(externalUsage)}`, '--root', projectRoot], {
    catalogHome,
    expect: 1,
  });
  assert.equal(staleExternal.ok, false);
  assert.equal(staleExternal.status, 'stale-or-missing');
  assert(staleExternal.checks.some((check) => check.status === 'stale-symbol'), 'Removed external call must be stale even when import remains');

  const javaPath = path.join(projectRoot, 'src/main/java/com/acme/common/StringUtils.java');
  const javaText = readFileSync(javaPath, 'utf8');
  writeFileSync(
    javaPath,
    javaText.replace(`  public static String trimToEmpty(CharSequence value) {
    return value == null ? "" : value.toString().trim();
  }

`, ''),
    'utf8',
  );
  const staleJavaMember = runCliJson(['verify', `member:${overloadedMemberKey}`, '--root', projectRoot], {
    catalogHome,
    expect: 1,
  });
  assert.equal(staleJavaMember.ok, false);
  assert.equal(staleJavaMember.status, 'stale-or-missing');
  assert(staleJavaMember.checks.some((check) => check.label === 'member:signature:2' && check.status === 'stale-symbol'), 'Removed overload signature must be reported as stale');

  const storedOverloadSignatures = runSqliteJson(
    replaySummary.project.catalog_path,
    `SELECT member_signatures.signature FROM member_signatures
      JOIN artifact_members ON artifact_members.id = member_signatures.member_id
      WHERE artifact_members.member_key = '${overloadedMemberKey}'
      ORDER BY member_signatures.signature;`,
  );
  assert.equal(storedOverloadSignatures.length, 2, 'Stored member signatures must preserve both overloads');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write('Tool Catalog CLI fixture regression passed.\n');
