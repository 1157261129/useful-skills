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

const documentedCommands = [
  'tool-catalog doctor',
  'tool-catalog config project-id <id>',
  'tool-catalog config info',
  'tool-catalog discover --full --dry-run',
  'tool-catalog discover --changed <paths...> --dry-run',
  'tool-catalog discover --apply <decisions.json>',
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
    'decisions JSON',
    'relative source anchors',
  ]) {
    assertIncludes(discover, expected, 'tool-catalog-discover');
  }

  for (const expected of [
    'query --goal',
    'show <selector>',
    'verify <selector>',
    'Read-Only Rules',
    'source anchors',
    'broaden once',
  ]) {
    assertIncludes(consult, expected, 'tool-catalog-consult');
  }
}

function checkDocumentedCommandAvailability() {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const discover = readFileSync(path.join(skillsDir, 'tool-catalog-discover/SKILL.md'), 'utf8');
  const consult = readFileSync(path.join(skillsDir, 'tool-catalog-consult/SKILL.md'), 'utf8');
  const documentedText = `${readme}\n${discover}\n${consult}`;
  const help = run(process.execPath, [cliPath, '--help']).stdout;

  for (const command of documentedCommands) {
    assertIncludes(documentedText, command, 'Tool Catalog documentation');
  }

  for (const expected of [
    'doctor',
    'config project-id <id>',
    'config info',
    'discover --full --dry-run',
    'discover --changed <paths...> --dry-run',
    'discover --apply <decisions.json>',
    'query --goal <text>',
    'show <selector>',
    'verify <selector>',
  ]) {
    assertIncludes(help, expected, 'Tool Catalog help');
  }

  run(process.execPath, [cliPath, 'config', '--help']);
  run(process.execPath, [cliPath, 'discover', '--help']);
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
