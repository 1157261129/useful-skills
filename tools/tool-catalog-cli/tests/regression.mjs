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
  assert.equal(result.status, 0, `sqlite3 failed\nsql:\n${sql}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout || '[]');
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
}
`);

  writeProjectFile(rootPath, 'src/utils/request.ts', `
export function request(url: string) {
  return fetch(url).then((response) => response.json());
}
`);
}

function decisionFile() {
  return {
    project: {
      mode: 'full',
    },
    artifacts: [
      {
        selector: 'artifact:com.acme.common.StringUtils',
        language: 'java',
        artifact_type: 'class',
        framework: 'spring',
        module_path: 'backend/common',
        summary: 'String normalization helpers for null-safe text cleanup.',
        usage_notes: 'Use for null-safe string trimming inside project code.',
        limitations: 'Does not perform locale-aware normalization.',
        source_anchor: {
          path: 'src/main/java/com/acme/common/StringUtils.java',
          symbol: 'com.acme.common.StringUtils',
          line: 3,
        },
        priority: 10,
        capability_tags: ['string', 'text'],
      },
      {
        selector: 'artifact:src/utils/request',
        language: 'typescript',
        artifact_type: 'module',
        framework: 'vue',
        module_path: 'frontend/utils',
        summary: 'HTTP request helper for project API calls.',
        source_anchor: {
          path: 'src/utils/request.ts',
          symbol: 'src/utils/request',
          line: 1,
        },
        priority: 20,
        capability_tags: ['http', 'request'],
      },
      {
        selector: 'artifact:src/utils/date',
        language: 'typescript',
        artifact_type: 'module',
        summary: 'Date formatting helper module.',
        source_anchor: {
          path: 'src/utils/request.ts',
          symbol: 'src/utils/date',
          line: 1,
        },
        priority: 30,
        capability_tags: ['date'],
      },
      {
        selector: 'artifact:src/utils/array',
        language: 'typescript',
        artifact_type: 'module',
        summary: 'Array helper module.',
        source_anchor: {
          path: 'src/utils/request.ts',
          symbol: 'src/utils/array',
          line: 1,
        },
        priority: 40,
        capability_tags: ['array'],
      },
      {
        selector: 'artifact:src/utils/object',
        language: 'typescript',
        artifact_type: 'module',
        summary: 'Object helper module.',
        source_anchor: {
          path: 'src/utils/request.ts',
          symbol: 'src/utils/object',
          line: 1,
        },
        priority: 50,
        capability_tags: ['object'],
      },
      {
        selector: 'artifact:src/utils/path',
        language: 'typescript',
        artifact_type: 'module',
        summary: 'Path helper module.',
        source_anchor: {
          path: 'src/utils/request.ts',
          symbol: 'src/utils/path',
          line: 1,
        },
        priority: 60,
        capability_tags: ['path'],
      },
    ],
    external_selectors: [
      {
        selector: 'external:org.apache.commons.lang3.StringUtils',
        origin_key: 'maven:org.apache.commons:commons-lang3',
        language: 'java',
        summary: 'Apache Commons string utility class used in this project.',
        usage_notes: 'Check project dependency availability before use.',
        capability_tags: ['string', 'text'],
      },
      {
        selector: 'external:@vueuse/core',
        origin_key: 'npm:@vueuse/core',
        language: 'typescript',
        framework: 'vue',
        summary: 'VueUse utility module used by the project.',
        capability_tags: ['debounce', 'vue'],
      },
    ],
    origins: [
      {
        origin_key: 'maven:org.apache.commons:commons-lang3',
        origin_type: 'maven',
        display_name: 'Apache Commons Lang',
        usage_count: 7,
        priority: 0,
      },
      {
        origin_key: 'npm:@vueuse/core',
        origin_type: 'npm',
        display_name: '@vueuse/core',
        usage_count: 3,
        priority: 100,
      },
    ],
    suppressions: [
      {
        suppression_key: 'suppression:not-a-util',
        target_kind: 'artifact',
        target_key: 'artifact:com.acme.internal.BusinessHelper',
        reason: 'Business-specific helper is not reusable utility catalog material.',
        fingerprint_key: 'fp:suppression:not-a-util',
      },
    ],
    fingerprints: [
      {
        fingerprint_key: 'fp:artifact:string-utils',
        target_kind: 'artifact',
        target_key: 'artifact:com.acme.common.StringUtils',
        fingerprint: 'sha256:string-utils',
      },
      {
        fingerprint_key: 'fp:external:commons-lang',
        target_kind: 'external_selector',
        target_key: 'external:org.apache.commons.lang3.StringUtils',
        fingerprint: 'sha256:commons-lang',
      },
      {
        fingerprint_key: 'fp:suppression:not-a-util',
        target_kind: 'artifact',
        target_key: 'artifact:com.acme.internal.BusinessHelper',
        fingerprint: 'sha256:not-a-util',
      },
    ],
    removed: {
      artifacts: [],
      external_selectors: [],
      origins: [],
      suppressions: [],
      fingerprints: [],
    },
  };
}

function changedDecisionFile() {
  return {
    project: {
      mode: 'changed',
    },
    artifacts: [],
    external_selectors: [],
    origins: [],
    suppressions: [],
    fingerprints: [],
    removed: {
      artifacts: ['artifact:src/utils/request'],
      external_selectors: [],
      origins: [],
      suppressions: ['suppression:not-a-util'],
      fingerprints: ['fp:suppression:not-a-util'],
    },
  };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'tool-catalog-regression-'));

try {
  const projectRoot = path.join(tempRoot, 'fixture-project');
  const catalogHome = path.join(tempRoot, 'catalog-home');
  const decisionsPath = path.join(tempRoot, 'decisions.json');
  const changedPath = path.join(tempRoot, 'changed.json');

  mkdirSync(projectRoot, { recursive: true });
  createFixture(projectRoot);

  const configured = runCliJson(['config', 'project-id', 'fixture-project', '--root', projectRoot], { catalogHome });
  const dbPath = configured.project.catalog_path;
  assert(existsSync(dbPath), 'config project-id must initialize the project index');

  runCli(['discover', '--full', '--dry-run', '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });

  writeFileSync(decisionsPath, `${JSON.stringify(decisionFile(), null, 2)}\n`, 'utf8');
  const beforeApplyMtime = statSync(dbPath).mtimeMs;
  const apply = runCliJson(['discover', '--apply', decisionsPath, '--root', projectRoot], { catalogHome });
  assert.equal(apply.kind, 'tool_catalog_discovery_apply');
  assert.equal(apply.mode, 'full');
  assert.equal(apply.applied.artifacts, 6);
  assert.equal(apply.applied.external_selectors, 2);
  assert.equal(apply.counts.after.suppressions, 1);
  assert(statSync(dbPath).mtimeMs >= beforeApplyMtime, 'discover apply must mutate the index');

  const forbiddenTables = runSqliteJson(dbPath, `
SELECT name
FROM sqlite_master
WHERE type IN ('table', 'view')
  AND name IN ('artifact_members', 'member_signatures', 'template_patterns', 'template_instances', 'observed_external_usages', 'deferred_candidates');
`);
  assert.deepEqual(forbiddenTables, [], 'Removed catalog concepts must not have schema objects');

  const tags = runCliJson(['tags', '--root', projectRoot], { catalogHome });
  assert.equal(tags.kind, 'tool_catalog_tags');
  const stringTag = tags.tags.find((tag) => tag.tag === 'string');
  assert.equal(stringTag.entry_count, 2);
  assert.equal(stringTag.project_entry_count, 1);
  assert.equal(stringTag.external_entry_count, 1);
  assert(!Object.hasOwn(stringTag, 'description'), 'tags output must not include stored descriptions');
  assert(!Object.hasOwn(stringTag, 'aliases'), 'tags output must not include aliases');
  const tagsMarkdown = runCli(['tags', '--root', projectRoot], { catalogHome });
  assert(!tagsMarkdown.stdout.includes('Aliases:'), 'Markdown tags output must not include aliases');

  runCli(['query', '--goal', 'string trim', '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });
  runCli(['query', '--description', 'string trim', '--limit', '11', '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });

  const defaultQuery = runCliJson(['query', '--description', 'module', '--root', projectRoot], { catalogHome });
  assert.equal(defaultQuery.results.length, 5, 'query must default to five results');
  assert(defaultQuery.results.every((result) => !Object.hasOwn(result, 'source_anchor')), 'query results must not include source anchors');
  assert(defaultQuery.results.every((result) => !Object.hasOwn(result, 'usage_notes')), 'query results must not include usage notes');
  assert(defaultQuery.results.every((result) => !Object.hasOwn(result, 'limitations')), 'query results must not include limitations');

  const stringQuery = runCliJson(['query', '--tag', 'string', '--description', 'string', '--root', projectRoot], { catalogHome });
  assert.deepEqual(
    stringQuery.results.map((result) => result.selector),
    ['artifact:com.acme.common.StringUtils', 'external:org.apache.commons.lang3.StringUtils'],
    'project-owned artifact results must fill before external selectors',
  );
  assert.equal(stringQuery.results[1].priority, 0, 'external selector priority must inherit from origin');
  assert.equal(stringQuery.results[1].usage_count, 7);

  const artifactShow = runCliJson(['show', 'artifact:com.acme.common.StringUtils', '--root', projectRoot], { catalogHome });
  assert.equal(artifactShow.found, true);
  assert.equal(artifactShow.entry.source_anchor.path, 'src/main/java/com/acme/common/StringUtils.java');
  assert.equal(artifactShow.entry.usage_notes, 'Use for null-safe string trimming inside project code.');
  assert.deepEqual(artifactShow.entry.capability_tags, ['string', 'text']);

  const externalShow = runCliJson(['show', 'external:org.apache.commons.lang3.StringUtils', '--root', projectRoot], { catalogHome });
  assert.equal(externalShow.found, true);
  assert.equal(externalShow.entry.origin.usage_count, 7);
  assert(!Object.hasOwn(externalShow.entry, 'source_anchor'), 'external show output must not include source anchor');
  assert.equal(externalShow.entry.usage_notes, 'Check project dependency availability before use.');

  const verifyArtifact = runCliJson(['verify', 'artifact:com.acme.common.StringUtils', '--root', projectRoot], { catalogHome });
  assert.equal(verifyArtifact.ok, true);
  assert.equal(verifyArtifact.status, 'verified');
  runCli(['verify', 'external:org.apache.commons.lang3.StringUtils', '--root', projectRoot], {
    catalogHome,
    expect: 2,
  });

  const mtimeBeforeConsulting = statSync(dbPath).mtimeMs;
  runCliJson(['query', '--tag', 'request', '--root', projectRoot], { catalogHome });
  runCliJson(['show', 'artifact:src/utils/request', '--root', projectRoot], { catalogHome });
  runCliJson(['verify', 'artifact:src/utils/request', '--root', projectRoot], { catalogHome });
  assert.equal(statSync(dbPath).mtimeMs, mtimeBeforeConsulting, 'query/show/verify must be read-only');

  writeFileSync(changedPath, `${JSON.stringify(changedDecisionFile(), null, 2)}\n`, 'utf8');
  const changed = runCliJson(['discover', '--apply', changedPath, '--root', projectRoot], { catalogHome });
  assert.equal(changed.mode, 'changed');
  assert.equal(changed.counts.after.artifacts, 5);
  const removedShow = runCliJson(['show', 'artifact:src/utils/request', '--root', projectRoot], {
    catalogHome,
    expect: 1,
  });
  assert.equal(removedShow.found, false);

  console.log('tool-catalog regression tests passed');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
