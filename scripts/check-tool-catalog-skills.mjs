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

const documentedCommands = [
  'tool-catalog doctor',
  'tool-catalog config project-id <id>',
  'tool-catalog config info',
  'tool-catalog discover --apply <decisions.json>',
  'tool-catalog tags',
  'tool-catalog query --tag <tag>',
  'tool-catalog query --description <text>',
  'tool-catalog show <selector>',
  'tool-catalog verify <selector>',
];

const forbiddenTerms = [
  'tool-catalog discover --full --dry-run',
  'tool-catalog discover --changed <paths...> --dry-run',
  'query --goal',
  '--goal <text>',
  'member:',
  'template:',
  'template pattern',
  'observed external usage row',
  'deferred_candidates',
  'artifact_members',
  'member_signatures',
  'template_patterns',
  'observed_external_usages',
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
  assert(text.includes(expected), `${label} must include ${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert(!text.includes(forbidden), `${label} must not include ${forbidden}`);
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

function checkToolCatalogDocs() {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const context = readFileSync(path.join(repoRoot, 'CONTEXT.md'), 'utf8');
  const adr1 = readFileSync(path.join(repoRoot, 'docs/adr/0001-project-index-storage-and-schema.md'), 'utf8');
  const adr2 = readFileSync(path.join(repoRoot, 'docs/adr/0002-skill-cli-contracts-and-output.md'), 'utf8');
  const adr3 = readFileSync(path.join(repoRoot, 'docs/adr/0003-discovery-workflow-and-scanning.md'), 'utf8');
  const adr4 = readFileSync(path.join(repoRoot, 'docs/adr/0004-consulting-workflow.md'), 'utf8');
  const discover = readFileSync(path.join(skillsDir, 'tool-catalog-discover/SKILL.md'), 'utf8');
  const consult = readFileSync(path.join(skillsDir, 'tool-catalog-consult/SKILL.md'), 'utf8');
  const allDocs = `${readme}\n${context}\n${adr1}\n${adr2}\n${adr3}\n${adr4}\n${discover}\n${consult}`;

  for (const command of documentedCommands) {
    assertIncludes(allDocs, command, 'Tool Catalog documentation');
  }
  for (const forbidden of forbiddenTerms) {
    assertExcludes(readme, forbidden, 'README');
    assertExcludes(discover, forbidden, 'tool-catalog-discover');
    assertExcludes(consult, forbidden, 'tool-catalog-consult');
  }

  for (const expected of [
    'The Tool Catalog CLI performs deterministic Project Index database operations',
    'Discovery Decision File',
    'external_selectors',
    'origins[].usage_count',
    'Do not write `source_anchor` on `external_selectors[]`',
    'Priority values are integers where lower numeric values mean higher priority',
    'query output as a minimal ranked list',
    '`verify` accepts only project-owned `artifact:` selectors',
  ]) {
    assertIncludes(allDocs, expected, 'Tool Catalog documentation');
  }
}

function checkCliHelp() {
  const help = run(process.execPath, [cliPath, '--help']).stdout;
  for (const expected of [
    'tool-catalog discover --apply <decisions.json>',
    'tool-catalog query --tag <tag>',
    'tool-catalog query --description <text>',
    'default to 5',
    'artifact:<fully-qualified-class-or-relative-module>',
    'external:<fully-qualified-class-or-module>',
  ]) {
    assertIncludes(help, expected, 'Tool Catalog help');
  }
  for (const forbidden of [
    '--goal',
    '--dry-run',
    'member:',
    'template:',
  ]) {
    assertExcludes(help, forbidden, 'Tool Catalog help');
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
      assert(existsSync(path.join(installedCli, 'migrations/006-db-only-catalog-schema.sql')), `Missing final migration in ${targetRoot}`);
      assert(!existsSync(path.join(targetRoot, 'tool-catalog-discover/tool-catalog-cli')), 'CLI must be a sibling of skills, not nested in discover');
      assert(!existsSync(path.join(targetRoot, 'tool-catalog-consult/tool-catalog-cli')), 'CLI must be a sibling of skills, not nested in consult');
      assert((statSync(path.join(installedCli, 'bin/tool-catalog')).mode & 0o111) !== 0, 'Installed wrapper must be executable');
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

checkSkillFrontmatter();
checkToolCatalogDocs();
checkCliHelp();
checkSharedCliInstall();

process.stdout.write('Tool Catalog skill static checks passed.\n');
