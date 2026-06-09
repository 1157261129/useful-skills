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

function allCandidates(output) {
  return [
    ...output.candidates.utility_artifacts,
    ...output.candidates.observed_external_usages,
    ...output.candidates.template_patterns,
  ];
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

function findCandidate(items, predicate, label) {
  const found = items.find(predicate);
  assert(found, `Missing candidate: ${label}`);
  return found;
}

function assertRelativeAnchor(anchor, label) {
  assert(anchor, `Missing source anchor for ${label}`);
  assert(!path.isAbsolute(anchor.path), `Source anchor must be relative for ${label}: ${anchor.path}`);
  assert(!anchor.path.startsWith('../'), `Source anchor must stay inside project for ${label}: ${anchor.path}`);
  assert(anchor.text.startsWith(`${anchor.path}:`), `Source anchor text must include relative path for ${label}`);
}

function assertCandidateAnchorsAreRelative(candidate) {
  if (candidate.source_anchor) {
    assertRelativeAnchor(candidate.source_anchor, candidate.candidate_id);
  }
  if (candidate.call_anchor) {
    assertRelativeAnchor(candidate.call_anchor, `${candidate.candidate_id} call`);
  }
  for (const member of candidate.members ?? []) {
    assertRelativeAnchor(member.source_anchor, member.member_key);
  }
  for (const instance of candidate.instances ?? []) {
    assertRelativeAnchor(instance.source_anchor, candidate.pattern_key);
  }
}

function assertDiscoveryRunFiles(dryRun, catalogHome, projectRoot, label) {
  assert(dryRun.run_files, `${label} must report dry-run file paths`);
  assertInsidePath(catalogHome, dryRun.run_files.run_directory, `${label} run directory`);
  assertNotInsidePath(projectRoot, dryRun.run_files.run_directory, `${label} run directory`);

  for (const [key, filePath] of [
    ['candidates_path', dryRun.run_files.candidates_path],
    ['review_pack_path', dryRun.run_files.review_pack_path],
    ['decisions_template_path', dryRun.run_files.decisions_template_path],
  ]) {
    assertInsidePath(catalogHome, filePath, `${label} ${key}`);
    assertNotInsidePath(projectRoot, filePath, `${label} ${key}`);
    assert(existsSync(filePath), `${label} ${key} must exist: ${filePath}`);
  }

  const candidatesJson = JSON.parse(readFileSync(dryRun.run_files.candidates_path, 'utf8'));
  assert.equal(candidatesJson.kind, 'tool_catalog_discovery_dry_run');
  assert.equal(candidatesJson.project.project_id, dryRun.project.project_id);
  assert.equal(candidatesJson.run_files.review_pack_path, dryRun.run_files.review_pack_path);

  const decisionsTemplate = JSON.parse(readFileSync(dryRun.run_files.decisions_template_path, 'utf8'));
  assert.equal(decisionsTemplate.kind, 'tool_catalog_discovery_decision_template');
  assert.equal(decisionsTemplate.run_files.candidates_path, dryRun.run_files.candidates_path);
  assert.equal(Object.keys(decisionsTemplate.decisions).length, allCandidates(dryRun).length);
  for (const decision of Object.values(decisionsTemplate.decisions)) {
    assert.equal(decision.action, 'review');
  }
}

function assertReviewPackShape(reviewPack, label) {
  for (const expected of [
    '# Discovery Review Pack',
    '## Run Files',
    '## Utility Artifacts',
    '### StringUtils',
    'Path: `src/main/java/com/acme/common/StringUtils.java`',
    'Package: `com.acme.common`',
    'Signature: `public static String trimToEmpty(String value)`',
    '## Observed External Usages',
    '### @vueuse/core',
    'Import anchor: `src/views/Dashboard.vue:',
    '#@vueuse/core`',
    '## Template Patterns',
    '### typescript-api-client-request',
    'Anchor: `src/api/orders.ts:3#api-client-request`',
  ]) {
    assert(reviewPack.includes(expected), `${label} review pack must include ${expected}`);
  }

  for (const forbidden of [
    'tag_hints',
    'suggested_action',
    'risk_flags',
    'Evidence:',
    'Risk:',
    'Risks:',
    'Suggested action',
    'utility path segment',
  ]) {
    assert(!reviewPack.includes(forbidden), `${label} review pack must not include ${forbidden}`);
  }
}

function assertTargetProjectClean(projectRoot) {
  for (const relativePath of [
    '.tool-catalog',
    'candidates.json',
    'review-pack.md',
    'decisions.template.json',
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

  return {
    ...candidate,
    ...entryDecision,
    members: candidate.candidate_type === 'utility_artifact'
      ? logicalUtilityMembers(mergedMembers)
      : mergedMembers,
    instances: candidate.instances,
  };
}

function reviewedDecisionFile(decisions) {
  const reviewed = JSON.parse(JSON.stringify(decisions));
  delete reviewed.candidates;
  delete reviewed.decisions;
  return reviewed;
}

function buildDecisions(dryRun, acceptedCandidates) {
  const acceptedIds = new Set(acceptedCandidates.map((candidate) => candidate.candidate_id));
  const decisions = Object.fromEntries(allCandidates(dryRun).map((candidate) => [
    candidate.candidate_id,
    {
      action: 'ignore',
      reason: 'Fixture regression intentionally leaves this candidate out of the index.',
    },
  ]));

  for (const candidate of acceptedCandidates) {
    decisions[candidate.candidate_id] = {
      action: 'accept',
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
    };
  }

  return {
    scan: dryRun.scan,
    candidates: dryRun.candidates,
    decisions,
    accepted_entries: acceptedCandidates.map((candidate) => {
      return finalAcceptedEntry(candidate, decisions[candidate.candidate_id]);
    }),
    ignored_candidates: allCandidates(dryRun)
      .filter((candidate) => !acceptedIds.has(candidate.candidate_id) && decisions[candidate.candidate_id].action === 'ignore')
      .map((candidate) => ({
        candidate_id: candidate.candidate_id,
        candidate_type: candidate.candidate_type,
        source_anchor: candidateTraceAnchor(candidate),
        reason: decisions[candidate.candidate_id].reason,
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

  const help = runCli(['--help'], { catalogHome });
  assert(help.stdout.includes('tool-catalog tags [--root <path>] [--json]'), 'CLI help must list the tags command');
  assert(help.stdout.includes('tool-catalog query --tag <tag> --goal <text>'), 'CLI help must list query tag filtering');
  const tagsHelp = runCli(['tags', '--help'], { catalogHome });
  assert(tagsHelp.stdout.includes('Tool Catalog tags'), 'Tags help must render a dedicated help section');
  const queryHelp = runCli(['query', '--help'], { catalogHome });
  assert(queryHelp.stdout.includes('--tag <tag>'), 'Query help must describe strict capability tag filters');

  const fullDryRun = runCliJson(['discover', '--full', '--dry-run', '--root', projectRoot], { catalogHome });
  assert.equal(fullDryRun.project.project_id, 'fixture-project');
  assert.equal(fullDryRun.index_mutated, false);
  assertDiscoveryRunFiles(fullDryRun, catalogHome, projectRoot, 'full dry-run');
  assertReviewPackShape(readFileSync(fullDryRun.run_files.review_pack_path, 'utf8'), 'full dry-run');

  const candidates = allCandidates(fullDryRun);
  for (const candidate of candidates) {
    assertCandidateAnchorsAreRelative(candidate);
  }

  const javaUtility = findCandidate(
    fullDryRun.candidates.utility_artifacts,
    (candidate) => candidate.language === 'java' && candidate.name === 'StringUtils' && candidate.members.length >= 2,
    'Java StringUtils utility',
  );
  const tsUtility = findCandidate(
    fullDryRun.candidates.utility_artifacts,
    (candidate) => candidate.language === 'typescript' && candidate.source_anchor.path === 'src/utils/request.ts',
    'TypeScript request utility',
  );
  const ignoredUtility = findCandidate(
    fullDryRun.candidates.utility_artifacts,
    (candidate) => candidate.source_anchor.path === 'src/utils/legacy.ts',
    'ignored TypeScript legacy utility',
  );
  const externalUsage = findCandidate(
    fullDryRun.candidates.observed_external_usages,
    (candidate) => candidate.origin_key === '@vueuse/core' && candidate.call_text?.includes('useDebounceFn'),
    'VueUse observed external usage',
  );
  const templatePattern = findCandidate(
    fullDryRun.candidates.template_patterns,
    (candidate) => candidate.pattern_key === 'typescript-api-client-request' && candidate.instance_count >= candidate.threshold,
    'TypeScript API request template',
  );

  assert(ignoredUtility, 'Ignored fixture candidate must exist');
  assert(!fullDryRun.candidates.template_patterns.some((candidate) => candidate.pattern_key === 'vue3-element-plus-table-page'), 'Single Vue table page must stay below template threshold');

  const changedBelowThreshold = runCliJson([
    'discover',
    '--changed',
    'src/api/orders.ts',
    'src/api/users.ts',
    '--dry-run',
    '--root',
    projectRoot,
  ], { catalogHome });
  assertDiscoveryRunFiles(changedBelowThreshold, catalogHome, projectRoot, 'changed dry-run');
  assert.equal(
    changedBelowThreshold.candidates.template_patterns.some((candidate) => candidate.pattern_key === 'typescript-api-client-request'),
    false,
    'Two changed API files must stay below template threshold',
  );
  const changedReviewPack = readFileSync(changedBelowThreshold.run_files.review_pack_path, 'utf8');
  assert(changedReviewPack.includes('## Template Patterns'), 'Changed dry-run review pack must include template section');
  assert(changedReviewPack.includes('- None detected.'), 'Changed dry-run review pack must record empty sections compactly');

  const compactDryRun = runCli(['discover', '--full', '--dry-run', '--root', projectRoot], { catalogHome });
  assert(compactDryRun.stdout.includes('Discovery Review Pack'), 'Default dry-run stdout must report review pack path');
  assert(compactDryRun.stdout.includes('review-pack.md'), 'Default dry-run stdout must include review pack file name');
  assert(!compactDryRun.stdout.includes('utility-artifact:java:com.acme.common.StringUtils'), 'Default dry-run stdout must not dump utility candidates');
  assert(!compactDryRun.stdout.includes('Evidence:'), 'Default dry-run stdout must not dump candidate evidence');
  assertTargetProjectClean(projectRoot);

  const missingTagsPath = path.join(tempRoot, 'missing-tags-decisions.json');
  const missingTagsDecisions = buildDecisions(fullDryRun, [javaUtility, tsUtility, externalUsage, templatePattern]);
  delete missingTagsDecisions.accepted_entries.find((entry) => entry.candidate_id === javaUtility.candidate_id).capability_tags;
  writeFileSync(missingTagsPath, `${JSON.stringify(reviewedDecisionFile(missingTagsDecisions), null, 2)}\n`, 'utf8');
  const missingTagsApply = runCli(['discover', '--apply', missingTagsPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingTagsApply.stderr.includes('capability_tags'), 'Apply must reject accepted utility artifacts without tags');

  const missingSummaryPath = path.join(tempRoot, 'missing-summary-decisions.json');
  const missingSummaryDecisions = buildDecisions(fullDryRun, [javaUtility, tsUtility, externalUsage, templatePattern]);
  delete missingSummaryDecisions.accepted_entries.find((entry) => entry.candidate_id === javaUtility.candidate_id).summary;
  writeFileSync(missingSummaryPath, `${JSON.stringify(reviewedDecisionFile(missingSummaryDecisions), null, 2)}\n`, 'utf8');
  const missingSummaryApply = runCli(['discover', '--apply', missingSummaryPath, '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  assert(missingSummaryApply.stderr.includes('summary'), 'Apply must reject accepted utility artifacts without summary');

  const decisions = buildDecisions(fullDryRun, [javaUtility, tsUtility, externalUsage, templatePattern]);
  const acceptedIds = new Set([javaUtility, tsUtility, externalUsage, templatePattern].map((candidate) => candidate.candidate_id));
  const deferredCandidate = allCandidates(fullDryRun).find((candidate) => !acceptedIds.has(candidate.candidate_id) && candidate.candidate_id !== ignoredUtility.candidate_id);
  assert(deferredCandidate, 'Fixture must include a second nonaccepted candidate for deferred traceability');
  decisions.decisions[deferredCandidate.candidate_id] = {
    action: 'defer',
    reason: 'Fixture regression keeps this candidate deferred for user review.',
  };
  decisions.ignored_candidates = decisions.ignored_candidates.filter((candidate) => candidate.candidate_id !== deferredCandidate.candidate_id);
  decisions.deferred_candidates = [{
    candidate_id: deferredCandidate.candidate_id,
    candidate_type: deferredCandidate.candidate_type,
    source_anchor: candidateTraceAnchor(deferredCandidate),
    reason: decisions.decisions[deferredCandidate.candidate_id].reason,
  }];
  assert.equal(decisions.decisions[ignoredUtility.candidate_id].action, 'ignore');
  writeFileSync(decisionsPath, `${JSON.stringify(reviewedDecisionFile(decisions), null, 2)}\n`, 'utf8');

  const applySummary = runCliJson(['discover', '--apply', decisionsPath, '--root', projectRoot], { catalogHome });
  assert.equal(applySummary.index_mutated, true);
  assert.equal(applySummary.decisions.accepted_utility_artifacts, 2);
  assert.equal(applySummary.decisions.accepted_observed_external_usages, 1);
  assert.equal(applySummary.decisions.accepted_template_patterns, 1);
  assert(applySummary.decisions.ignored_candidates > 0, 'Apply must persist ignored candidates');
  assert.equal(applySummary.decisions.deferred_candidates, 1);
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

  const replayDecisions = buildDecisions(fullDryRun, [javaUtility, tsUtility, ignoredUtility, deferredCandidate, externalUsage, templatePattern]);
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
    utilityQuery.results.some((result) => result.selector === `artifact:${tsUtility.candidate_id}`),
    'Tag query must return the accepted TypeScript utility artifact group',
  );
  const groupedUtility = utilityQuery.results.find((result) => result.selector === `artifact:${tsUtility.candidate_id}`);
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
  const overloadArtifactGroup = overloadQuery.results.find((result) => result.selector === `artifact:${javaUtility.candidate_id}`);
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
    javaQuery.results.some((result) => result.selector === `artifact:${javaUtility.candidate_id}`),
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
    multiTagAndQuery.results.some((result) => result.selector === `artifact:${tsUtility.candidate_id}`),
    'Multiple tag filters must retain entries that satisfy every requested tag',
  );
  assert(
    multiTagAndQuery.results.every((result) => result.selector !== `template:${templatePattern.pattern_key}`),
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
    templateTagQuery.results.some((result) => result.selector === `template:${templatePattern.pattern_key}`),
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
    externalQuery.results.some((result) => result.selector === `external:${externalUsage.candidate_id}`),
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

  const showArtifact = runCliJson(['show', `artifact:${tsUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(showArtifact.found, true);
  assert.equal(showArtifact.entry.kind, 'artifact');
  assert.equal(showArtifact.entry.summary, 'Fixture-approved utility artifact.');
  assert.deepEqual(showArtifact.entry.capability_tags.map((item) => item.tag), ['http', 'request']);
  assert.equal(showArtifact.entry.usage_notes, 'Use this utility artifact in fixture tests.');
  assert.equal(showArtifact.entry.limitations, 'Fixture metadata is only used for regression coverage.');
  assert(showArtifact.entry.members.every((member) => member.capability_tags.length > 0), 'Artifact members must surface capability tags');
  assert(showArtifact.entry.members.every((member) => member.usage_notes), 'Artifact members must surface usage notes');
  assertRelativeAnchor(showArtifact.entry.source_anchor, showArtifact.entry.selector);
  const showArtifactMarkdown = runCli(['show', `artifact:${tsUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert(showArtifactMarkdown.stdout.includes('Fixture-approved utility artifact.'), 'Markdown show must surface the accepted summary');
  assert(showArtifactMarkdown.stdout.includes('- Tags: `http`, `request`'), 'Markdown show must surface tags');
  assert(showArtifactMarkdown.stdout.includes('- Usage notes: Use this utility artifact in fixture tests.'), 'Markdown show must surface usage notes');

  const showJavaArtifact = runCliJson(['show', `artifact:${javaUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
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
  const showJavaArtifactMarkdown = runCli(['show', `artifact:${javaUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert(showJavaArtifactMarkdown.stdout.includes('- Signatures: 2'), 'Artifact markdown must surface overload signatures compactly');

  const showJavaMember = runCliJson(['show', `member:${overloadedMemberKey}`, '--root', projectRoot], { catalogHome });
  assert.equal(showJavaMember.found, true);
  assert.equal(showJavaMember.entry.summary, 'Fixture-approved member trimToEmpty.');
  assert.equal(showJavaMember.entry.signature_count, 2);
  assert.equal(showJavaMember.entry.signatures.length, 2);

  const showTemplate = runCliJson(['show', `template:${templatePattern.pattern_key}`, '--root', projectRoot], { catalogHome });
  assert.equal(showTemplate.found, true);
  assert.equal(showTemplate.entry.summary, 'Fixture-approved template pattern.');
  assert.deepEqual(showTemplate.entry.capability_tags.map((item) => item.tag), ['api-client', 'request']);
  assert.equal(showTemplate.entry.usage_notes, 'Use this template pattern in fixture tests.');
  assert.equal(showTemplate.entry.limitations, 'Fixture metadata is only used for regression coverage.');
  assert.equal(showTemplate.entry.instance_count, 3);
  for (const instance of showTemplate.entry.instances) {
    assertRelativeAnchor(instance.source_anchor, instance.source_anchor.text);
  }

  const verifyArtifact = runCliJson(['verify', `artifact:${tsUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyArtifact.ok, true);
  assert.equal(verifyArtifact.status, 'verified');

  const verifyJavaArtifact = runCliJson(['verify', `artifact:${javaUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyJavaArtifact.ok, true);
  assert.equal(verifyJavaArtifact.status, 'verified');
  const verifyJavaMember = runCliJson(['verify', `member:${overloadedMemberKey}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyJavaMember.ok, true);
  assert.equal(verifyJavaMember.status, 'verified');
  assert.equal(verifyJavaMember.checks.filter((check) => check.label.startsWith('member:signature:')).length, 2, 'Verify must check each stored overload signature');

  const verifyTemplate = runCliJson(['verify', `template:${templatePattern.pattern_key}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyTemplate.ok, true);
  assert.equal(verifyTemplate.status, 'verified');

  const verifyExternal = runCliJson(['verify', `external:${externalUsage.candidate_id}`, '--root', projectRoot], { catalogHome });
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
  const staleExternal = runCliJson(['verify', `external:${externalUsage.candidate_id}`, '--root', projectRoot], {
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
