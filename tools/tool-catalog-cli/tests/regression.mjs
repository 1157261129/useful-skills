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

function buildDecisions(dryRun, acceptedCandidates) {
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

  const fullDryRun = runCliJson(['discover', '--full', '--dry-run', '--root', projectRoot], { catalogHome });
  assert.equal(fullDryRun.project.project_id, 'fixture-project');
  assert.equal(fullDryRun.index_mutated, false);

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
  assert.equal(
    changedBelowThreshold.candidates.template_patterns.some((candidate) => candidate.pattern_key === 'typescript-api-client-request'),
    false,
    'Two changed API files must stay below template threshold',
  );

  const decisions = buildDecisions(fullDryRun, [javaUtility, tsUtility, externalUsage, templatePattern]);
  assert.equal(decisions.decisions[ignoredUtility.candidate_id].action, 'ignore');
  writeFileSync(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`, 'utf8');

  const applySummary = runCliJson(['discover', '--apply', decisionsPath, '--root', projectRoot], { catalogHome });
  assert.equal(applySummary.index_mutated, true);
  assert.equal(applySummary.decisions.accepted_utility_artifacts, 2);
  assert.equal(applySummary.decisions.accepted_observed_external_usages, 1);
  assert.equal(applySummary.decisions.accepted_template_patterns, 1);
  assert(applySummary.decisions.ignored_candidates > 0, 'Apply must persist ignored candidates');
  assert(applySummary.counts.after.ignored_candidates > 0, 'Ignored candidates must be present in SQLite counts');
  assert(existsSync(applySummary.project.catalog_path), 'Apply must create the project catalog');

  const dbMtimeBeforeConsulting = statSync(applySummary.project.catalog_path).mtimeMs;

  const utilityQuery = runCliJson([
    'query',
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
    utilityQuery.results.some((result) => result.selector === `artifact:${tsUtility.candidate_id}` || result.selector === `member:${tsUtility.members[0].member_key}`),
    'Query must return the accepted TypeScript utility or one of its members',
  );

  const javaQuery = runCliJson([
    'query',
    '--goal',
    'trim text',
    '--language',
    'java',
    '--root',
    projectRoot,
  ], { catalogHome });
  assert(
    javaQuery.results.some((result) => result.selector === `artifact:${javaUtility.candidate_id}` || result.selector === `member:${javaUtility.members[0].member_key}`),
    'Query must return the accepted Java utility or one of its members',
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

  const showArtifact = runCliJson(['show', `artifact:${tsUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(showArtifact.found, true);
  assert.equal(showArtifact.entry.kind, 'artifact');
  assertRelativeAnchor(showArtifact.entry.source_anchor, showArtifact.entry.selector);

  const showJavaArtifact = runCliJson(['show', `artifact:${javaUtility.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(showJavaArtifact.found, true);
  assert.equal(showJavaArtifact.entry.kind, 'artifact');
  assertRelativeAnchor(showJavaArtifact.entry.source_anchor, showJavaArtifact.entry.selector);

  const showTemplate = runCliJson(['show', `template:${templatePattern.pattern_key}`, '--root', projectRoot], { catalogHome });
  assert.equal(showTemplate.found, true);
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

  const verifyTemplate = runCliJson(['verify', `template:${templatePattern.pattern_key}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyTemplate.ok, true);
  assert.equal(verifyTemplate.status, 'verified');

  const verifyExternal = runCliJson(['verify', `external:${externalUsage.candidate_id}`, '--root', projectRoot], { catalogHome });
  assert.equal(verifyExternal.ok, true);
  assert.equal(verifyExternal.status, 'verified');

  const dbMtimeAfterConsulting = statSync(applySummary.project.catalog_path).mtimeMs;
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
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write('Tool Catalog CLI fixture regression passed.\n');
