#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const skillsDir = path.join(repoRoot, 'skills');
const cliPath = path.join(repoRoot, 'tools/tool-catalog-cli/bin/tool-catalog.mjs');

const toolCatalogSkills = [
  'tool-catalog-discover',
  'tool-catalog-consult',
];

const discoveryTerminologyDocs = [
  'docs/adr/0003-discovery-workflow-and-scanning.md',
];

const disallowedDiscoveryArtifactPhrases = [
  /\bDiscovery candidate data\b/i,
  /\bfull candidate data\b/i,
  /\bcompat-candidates\.json\b/i,
];

const documentedCommands = [
  'tool-catalog doctor',
  'tool-catalog config project-id <id>',
  'tool-catalog config info',
  'tool-catalog discover --full --dry-run',
  'tool-catalog discover --changed <paths...> --dry-run',
  'tool-catalog discover --apply <decisions.json>',
  'tool-catalog tags',
  'tool-catalog query --tag <tag> --goal <text>',
  'tool-catalog query --goal <text>',
  'tool-catalog show <selector>',
  'tool-catalog verify <selector>',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(
    result.status,
    options.expect ?? 0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  return result;
}

function parseFrontmatter(text, filePath) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert(match, `Missing frontmatter: ${filePath}`);
  return Object.fromEntries(match[1]
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      assert(separator > 0, `Invalid frontmatter line in ${filePath}: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

function assertIncludes(text, expected, label) {
  assert(
    text.includes(expected),
    `${label} must include ${expected}`,
  );
}

function assertOrderedIncludes(text, expectedEntries, label) {
  let previousIndex = -1;
  for (const expected of expectedEntries) {
    const index = text.indexOf(expected);
    assert(index >= 0, `${label} must include ${expected}`);
    assert(index > previousIndex, `${label} must keep ${expected} after the previous required stage`);
    previousIndex = index;
  }
}

function assertExcludes(text, pattern, label, message) {
  assert(
    !pattern.test(text),
    `${label} ${message}`,
  );
}

function checkSkillFrontmatter() {
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    assert(existsSync(skillFile), `Missing SKILL.md for ${entry.name}`);
    const text = readFileSync(skillFile, 'utf8');
    const frontmatter = parseFrontmatter(text, skillFile);
    assert.equal(frontmatter.name, entry.name, `Skill name must match directory for ${entry.name}`);
    assert(frontmatter.description, `Missing description for ${entry.name}`);
    assert(frontmatter.description.length <= 1024, `Description too long for ${entry.name}`);
  }
}

function checkToolCatalogSkillDocs() {
  const discover = readFileSync(path.join(skillsDir, 'tool-catalog-discover/SKILL.md'), 'utf8');
  const consult = readFileSync(path.join(skillsDir, 'tool-catalog-consult/SKILL.md'), 'utf8');

  for (const skillName of toolCatalogSkills) {
    const text = readFileSync(path.join(skillsDir, skillName, 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(text, skillName);
    assertIncludes(frontmatter.description, 'Use when', `${skillName} description`);
    assert(text.split(/\r?\n/).length <= 100, `${skillName} SKILL.md must stay concise`);
    assert(!/\bStub\b|Until .*implemented/i.test(text), `${skillName} must not contain placeholder workflow text`);
    assertIncludes(text, '../tool-catalog-cli/bin/tool-catalog', `${skillName} CLI reference`);
  }

  for (const expected of [
    'discover --full --dry-run',
    'discover --changed <paths...> --dry-run',
    'discover --apply <decisions.json>',
    'two-phase Tool Catalog CLI workflow',
    'durable run directory',
    'The main agent is the only dispatcher.',
    '`model` and `reasoning_effort`',
    'workers must not spawn subagents',
    'strict Markdown work plans',
    '`work_item_id`',
    '`role`',
    '`depends_on`',
    '`brief`',
    '`inputs`',
    '`outputs`',
    '`coverage`',
    'Minimal `status.md`',
    '`terminal_status`',
    '`outcome`',
    '`artifacts`',
    '`readiness`',
    '`next_worker`',
    'Discovery Decision File',
    'relative source anchors',
    'Narrative reports are not required.',
    'Evidence Harvest Worker',
    'Shard Planner Worker',
    'Chunk Planner Worker',
    'Shard Review Worker',
    'Shard Aggregator Worker',
    'Cross-Shard Merge Worker',
    'Catalog Finalizer Worker',
    'Decision Review Worker',
    'Finalizer Repair Worker',
    'Decision Incorporation Worker',
    'Apply/Verify Worker',
    'bounded worker inputs',
    'coverage accounting',
    'missing or duplicate Finding coverage',
    'validate local anchors',
    'accept/ignore/defer',
    'semantic tags',
    'usage notes',
    'duplicate suggestions',
    'every Review Group considered for acceptance',
    'must not modify the Discovery Decision File',
    'blocking decision needed',
    'review-only mode',
  ]) {
    assertIncludes(discover, expected, 'tool-catalog-discover');
  }

  assertIncludes(
    discover,
    'Every work plan must include these fields exactly once per work item: `work_item_id`, `role`, `depends_on`, `brief`, `inputs`, `outputs`, and `coverage`.',
    'tool-catalog-discover work plan contract',
  );
  assertIncludes(
    discover,
    '`status.md` must record `terminal_status`, `outcome`, `artifacts`, `readiness`, and `next_worker`.',
    'tool-catalog-discover status contract',
  );
  assertIncludes(
    discover,
    '`terminal_status` is one of `completed`, `failed`, or `blocked`.',
    'tool-catalog-discover terminal status values',
  );
  assertIncludes(
    discover,
    'The oversized planning chain is fixed: harvest manifest/index -> Shard Planner -> Chunk Planner when a shard stays oversized -> bounded shard/chunk review inputs -> Shard Aggregator -> Cross-Shard Merge.',
    'tool-catalog-discover oversized planning chain',
  );
  assertIncludes(
    discover,
    'route any oversized shard to a Chunk Planner Worker instead of one oversized prompt.',
    'tool-catalog-discover shard planner handoff',
  );
  assertIncludes(
    discover,
    'recursively split one oversized shard into bounded child work items',
    'tool-catalog-discover chunk recursion contract',
  );
  assertIncludes(
    discover,
    'merge reviewed chunks back into one shard artifact',
    'tool-catalog-discover shard aggregation contract',
  );
  assertIncludes(
    discover,
    'fail the shard if `coverage` shows missing or duplicate Finding coverage.',
    'tool-catalog-discover coverage gate',
  );
  assertIncludes(
    discover,
    'run mandatory local gap audit for every Review Group considered for acceptance',
    'tool-catalog-discover local gap audit gate',
  );
  assertIncludes(
    discover,
    'must not modify the Discovery Decision File',
    'tool-catalog-discover decision review immutability',
  );
  assertIncludes(
    discover,
    'send the run back to the Decision Review Worker',
    'tool-catalog-discover repair re-review loop',
  );
  assertIncludes(
    discover,
    'after explicit user direction on blocking findings, incorporate that decision into the Discovery Decision File and return the run to the Decision Review Worker.',
    'tool-catalog-discover user decision incorporation loop',
  );
  assertIncludes(
    discover,
    'run by default only after the Decision Review Worker passes with no blockers, unless the user explicitly requested review-only mode',
    'tool-catalog-discover apply default gate',
  );
  assertOrderedIncludes(
    discover,
    [
      'Evidence Harvest Worker:',
      'Shard Planner Worker:',
      'Chunk Planner Worker:',
      'Shard Review Worker:',
      'Shard Aggregator Worker:',
      'Cross-Shard Merge Worker:',
      'Catalog Finalizer Worker:',
      'Decision Review Worker:',
      'Finalizer Repair Worker:',
      'Decision Incorporation Worker:',
      'Apply/Verify Worker:',
    ],
    'tool-catalog-discover worker flow',
  );

  assertExcludes(
    discover,
    /\bcandidate(s)?\b/i,
    'tool-catalog-discover',
    'must not use superseded candidate-centric discovery wording',
  );

  for (const relativePath of discoveryTerminologyDocs) {
    const documentText = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    for (const pattern of disallowedDiscoveryArtifactPhrases) {
      assertExcludes(
        documentText,
        pattern,
        relativePath,
        'must not use superseded candidate-centric discovery artifact wording',
      );
    }
  }

  for (const expected of [
    'tool-catalog tags --root <project>',
    'query --tag <tag>',
    'query --goal',
    'show <selector>',
    'verify <selector>',
    'Capability Tag Vocabulary',
    'strict tag filters',
    'Read-Only Rules',
    'source anchors',
    'broaden once without tag filters',
  ]) {
    assertIncludes(consult, expected, 'tool-catalog-consult');
  }
}

function checkDocumentedCommandAvailability() {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const discover = readFileSync(path.join(skillsDir, 'tool-catalog-discover/SKILL.md'), 'utf8');
  const consult = readFileSync(path.join(skillsDir, 'tool-catalog-consult/SKILL.md'), 'utf8');
  const cliSource = readFileSync(cliPath, 'utf8');
  const documentedText = `${readme}\n${discover}\n${consult}`;
  const help = run(process.execPath, [cliPath, '--help']).stdout;

  for (const command of documentedCommands) {
    assertIncludes(documentedText, command, 'Tool Catalog documentation');
  }

  assertIncludes(readme, 'Evidence Harvest', 'README Tool Catalog workflow');
  assertIncludes(readme, 'finding-manifest.json', 'README Tool Catalog workflow');
  assertIncludes(readme, 'worker DAG', 'README Tool Catalog workflow');
  assertIncludes(readme, 'Discovery Decision File', 'README Tool Catalog workflow');
  assertIncludes(readme, 'Capability Tag Vocabulary', 'README Tool Catalog workflow');
  assertIncludes(readme, 'exact `--tag` filters', 'README Tool Catalog workflow');
  assert(!readme.includes('Planned Capability Tag command surface'), 'README must describe implemented Tool Catalog commands, not planned placeholders');
  assert(!cliSource.includes('compat-candidates.json'), 'CLI must not emit legacy compatibility discovery artifacts');

  for (const expected of [
    'doctor',
    'config project-id <id>',
    'config info',
    'discover --full --dry-run',
    'discover --changed <paths...> --dry-run',
    'discover --apply <decisions.json>',
    'tool-catalog tags [--root <path>] [--json]',
    'tool-catalog query --tag <tag> --goal <text>',
    'query --goal <text>',
    'show <selector>',
    'verify <selector>',
  ]) {
    assertIncludes(help, expected, 'Tool Catalog help');
  }

  run(process.execPath, [cliPath, 'config', '--help']);
  run(process.execPath, [cliPath, 'discover', '--help']);
  run(process.execPath, [cliPath, 'tags', '--help']);
  run(process.execPath, [cliPath, 'query', '--help']);
  run(process.execPath, [cliPath, 'show', '--help']);
  run(process.execPath, [cliPath, 'verify', '--help']);
}

function checkSharedCliInstall() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'tool-catalog-static-'));
  const agentsRoot = path.join(tempRoot, 'agents');
  const claudeRoot = path.join(tempRoot, 'claude');

  try {
    const env = {
      AGENTS_SKILLS_DIR: agentsRoot,
      CLAUDE_SKILLS_DIR: claudeRoot,
    };
    run('bash', ['scripts/sync-skills.sh'], { env });
    run('bash', ['scripts/sync-skills.sh', '--check'], { env });

    for (const targetRoot of [agentsRoot, claudeRoot]) {
      const installedCli = path.join(targetRoot, 'tool-catalog-cli');
      assert(existsSync(path.join(installedCli, 'bin/tool-catalog')), `Missing installed wrapper in ${targetRoot}`);
      assert(existsSync(path.join(installedCli, 'bin/tool-catalog.mjs')), `Missing installed CLI in ${targetRoot}`);
      assert(existsSync(path.join(installedCli, 'migrations/001-initial-schema.sql')), `Missing installed migrations in ${targetRoot}`);
      assert(!existsSync(path.join(targetRoot, 'tool-catalog-discover/tool-catalog-cli')), 'CLI must be a sibling of skills, not nested in discover');
      assert(!existsSync(path.join(targetRoot, 'tool-catalog-consult/tool-catalog-cli')), 'CLI must be a sibling of skills, not nested in consult');
      assert((statSync(path.join(installedCli, 'bin/tool-catalog')).mode & 0o111) !== 0, 'Installed wrapper must be executable');
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

checkSkillFrontmatter();
checkToolCatalogSkillDocs();
checkDocumentedCommandAvailability();
checkSharedCliInstall();

process.stdout.write('Tool Catalog skill static checks passed.\n');
