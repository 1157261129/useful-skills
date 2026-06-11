#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_NODE_MAJOR = 18;
const CONFIG_FILE_NAME = 'config.json';
const DEFAULT_CATALOG_DIR = '.tool-catalog';
const SQLITE_MAX_BUFFER = 10 * 1024 * 1024;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SCHEMA_VERSION = 6;
const DEFAULT_QUERY_LIMIT = 5;
const MAX_QUERY_LIMIT = 10;
const MAX_PROSE_CHARS = 1000;
const TAG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const HELP_TEXT = `Tool Catalog CLI

Usage:
  tool-catalog --help
  tool-catalog doctor
  tool-catalog config project-id <id> [--root <path>] [--json]
  tool-catalog config info [--root <path>] [--json]
  tool-catalog discover --apply <decisions.json> [--root <path>] [--json]
  tool-catalog tags [--root <path>] [--json]
  tool-catalog query --tag <tag> [--description <text>] [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog query --description <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog show <selector> [--root <path>] [--json]
  tool-catalog verify <selector> [--root <path>] [--json]

Commands:
  doctor            Check runtime dependencies.
  config            Manage project identity mappings.
  discover          Apply a reviewed Discovery Decision File.
  tags              List derived Capability Tags from accepted entries.
  query             Search the existing Project Index.
  show              Show full details for one accepted entry.
  verify            Verify project-owned artifact source anchors.

Environment:
  TOOL_CATALOG_HOME Override the default ~/.tool-catalog data root.

Query limits default to 5 and may be raised to at most 10.
Selectors use artifact:<fully-qualified-class-or-relative-module> or external:<fully-qualified-class-or-module>.
The CLI performs deterministic Project Index database operations only. Source scanning belongs to the tool-catalog-discover agent.`;

const CONFIG_HELP_TEXT = `Tool Catalog config

Usage:
  tool-catalog config project-id <id> [--root <path>] [--json]
  tool-catalog config info [--root <path>] [--json]`;

const DISCOVER_HELP_TEXT = `Tool Catalog discover

Usage:
  tool-catalog discover --apply <decisions.json> [--root <path>] [--json]

Discovery scanning is agent-owned. The CLI only validates and persists reviewed Discovery Decision Files.`;

const QUERY_HELP_TEXT = `Tool Catalog query

Usage:
  tool-catalog query --tag <tag> [--description <text>] [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog query --description <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]

Options:
  --tag <tag>            Exact canonical Capability Tag filter. May be repeated or comma-separated; repeated tags use AND semantics.
  --description <text>   Deterministic text query matched against persisted English catalog prose.
  --current-file <path>  Relative or in-root path used as query context only.
  --language <name>      Limit results to a language. May be repeated or comma-separated.
  --framework <name>     Limit results to entries with known framework metadata. May be repeated or comma-separated.
  --artifact-type <type> Limit project-owned artifact results to a type. May be repeated or comma-separated.
  --limit <n>            Maximum results to return. Defaults to 5, maximum 10.
  --json                 Print machine-readable JSON output.`;

const TAGS_HELP_TEXT = `Tool Catalog tags

Usage:
  tool-catalog tags [--root <path>] [--json]

The tags command is read-only. It derives canonical Capability Tags from accepted catalog entries.`;

const SHOW_HELP_TEXT = `Tool Catalog show

Usage:
  tool-catalog show <selector> [--root <path>] [--json]

Selectors:
  artifact:<fully-qualified-class-or-relative-module>
  external:<fully-qualified-class-or-module>`;

const VERIFY_HELP_TEXT = `Tool Catalog verify

Usage:
  tool-catalog verify <artifact-selector> [--root <path>] [--json]

Verification accepts only project-owned artifact: selectors.`;

class ToolCatalogError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'ToolCatalogError';
    this.exitCode = exitCode;
  }
}

function print(text) {
  process.stdout.write(`${text}\n`);
}

function parseMajorVersion(version) {
  const match = String(version).match(/^v?(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function checkRuntime() {
  const nodeOk = parseMajorVersion(process.version) >= MIN_NODE_MAJOR;
  const sqlite = spawnSync('sqlite3', ['--version'], { encoding: 'utf8' });
  const sqliteOk = sqlite.status === 0;
  const lines = [
    '# Tool Catalog Doctor',
    '',
    `- Node.js: ${nodeOk ? 'ok' : 'missing'} (${process.version})`,
    `- sqlite3: ${sqliteOk ? 'ok' : 'missing'}`,
  ];
  print(lines.join('\n'));
  return nodeOk && sqliteOk;
}

function assertSqlite3Available() {
  const result = spawnSync('sqlite3', ['--version'], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    throw new ToolCatalogError("Tool Catalog CLI environment error: missing required runtime dependency 'sqlite3'. Install the system sqlite3 CLI and retry.");
  }
  if (result.status !== 0) {
    throw new ToolCatalogError("Tool Catalog CLI environment error: unable to run required runtime dependency 'sqlite3'.");
  }
}

function parseArguments(argv) {
  const options = {
    help: false,
    json: false,
    root: undefined,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--root') {
      index += 1;
      if (index >= argv.length) {
        throw new ToolCatalogError('Missing value for --root.', 2);
      }
      options.root = argv[index];
      continue;
    }
    if (argument.startsWith('--root=')) {
      options.root = argument.slice('--root='.length);
      continue;
    }
    positional.push(argument);
  }

  return { options, positional };
}

function parseRepeatedValue(args, index, optionName) {
  if (index.value + 1 >= args.length) {
    throw new ToolCatalogError(`Missing value for ${optionName}.`, 2);
  }
  index.value += 1;
  return args[index.value];
}

function appendCommaSeparated(target, value) {
  for (const item of String(value).split(',')) {
    const normalized = item.trim();
    if (normalized) {
      target.push(normalized);
    }
  }
}

function parseDiscoverOptions(args, globalOptions) {
  const options = { ...globalOptions, applyPath: undefined };
  for (const index = { value: 0 }; index.value < args.length; index.value += 1) {
    const argument = args[index.value];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--apply') {
      options.applyPath = parseRepeatedValue(args, index, '--apply');
      continue;
    }
    if (argument.startsWith('--apply=')) {
      options.applyPath = argument.slice('--apply='.length);
      continue;
    }
    if (argument === '--full' || argument === '--changed' || argument === '--dry-run' || argument === '--language' || argument === '--include' || argument === '--exclude') {
      throw new ToolCatalogError('Discovery scanning options were removed. Use tool-catalog discover --apply <decisions.json>.', 2);
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported discover option: ${argument}`, 2);
    }
    throw new ToolCatalogError(`Unexpected discover argument: ${argument}`, 2);
  }
  if (!options.help && !options.applyPath) {
    throw new ToolCatalogError('Discovery requires --apply <decisions.json>.', 2);
  }
  return options;
}

function parseTagsOptions(args, globalOptions) {
  const options = { ...globalOptions };
  for (const argument of args) {
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    throw new ToolCatalogError(`Unsupported tags option: ${argument}`, 2);
  }
  return options;
}

function parsePositiveIntegerOption(value, optionName, maximum) {
  const integer = Number.parseInt(value, 10);
  if (!Number.isFinite(integer) || integer < 1) {
    throw new ToolCatalogError(`${optionName} must be a positive integer.`, 2);
  }
  if (integer > maximum) {
    throw new ToolCatalogError(`${optionName} must be at most ${maximum}.`, 2);
  }
  return integer;
}

function normalizeTagValue(value, fieldName = 'Capability Tag') {
  const tag = normalizeNullableString(value)?.toLowerCase();
  if (!tag) {
    throw new ToolCatalogError(`${fieldName} is required.`, 2);
  }
  if (!TAG_PATTERN.test(tag)) {
    throw new ToolCatalogError(`${fieldName} '${value}' must be lowercase token or lowercase kebab-case.`, 2);
  }
  return tag;
}

function parseQueryOptions(args, globalOptions) {
  const options = {
    ...globalOptions,
    tags: [],
    description: undefined,
    currentFile: undefined,
    languages: [],
    frameworks: [],
    artifactTypes: [],
    limit: DEFAULT_QUERY_LIMIT,
  };

  for (const index = { value: 0 }; index.value < args.length; index.value += 1) {
    const argument = args[index.value];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--goal' || argument.startsWith('--goal=')) {
      throw new ToolCatalogError('Query uses --description, not --goal.', 2);
    }
    if (argument === '--description') {
      options.description = parseRepeatedValue(args, index, '--description');
      continue;
    }
    if (argument.startsWith('--description=')) {
      options.description = argument.slice('--description='.length);
      continue;
    }
    if (argument === '--tag') {
      appendCommaSeparated(options.tags, parseRepeatedValue(args, index, '--tag'));
      continue;
    }
    if (argument.startsWith('--tag=')) {
      appendCommaSeparated(options.tags, argument.slice('--tag='.length));
      continue;
    }
    if (argument === '--current-file') {
      options.currentFile = parseRepeatedValue(args, index, '--current-file');
      continue;
    }
    if (argument.startsWith('--current-file=')) {
      options.currentFile = argument.slice('--current-file='.length);
      continue;
    }
    if (argument === '--language') {
      appendCommaSeparated(options.languages, parseRepeatedValue(args, index, '--language'));
      continue;
    }
    if (argument.startsWith('--language=')) {
      appendCommaSeparated(options.languages, argument.slice('--language='.length));
      continue;
    }
    if (argument === '--framework') {
      appendCommaSeparated(options.frameworks, parseRepeatedValue(args, index, '--framework'));
      continue;
    }
    if (argument.startsWith('--framework=')) {
      appendCommaSeparated(options.frameworks, argument.slice('--framework='.length));
      continue;
    }
    if (argument === '--artifact-type') {
      appendCommaSeparated(options.artifactTypes, parseRepeatedValue(args, index, '--artifact-type'));
      continue;
    }
    if (argument.startsWith('--artifact-type=')) {
      appendCommaSeparated(options.artifactTypes, argument.slice('--artifact-type='.length));
      continue;
    }
    if (argument === '--limit') {
      options.limit = parsePositiveIntegerOption(parseRepeatedValue(args, index, '--limit'), '--limit', MAX_QUERY_LIMIT);
      continue;
    }
    if (argument.startsWith('--limit=')) {
      options.limit = parsePositiveIntegerOption(argument.slice('--limit='.length), '--limit', MAX_QUERY_LIMIT);
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported query option: ${argument}`, 2);
    }
    throw new ToolCatalogError(`Unexpected query argument: ${argument}`, 2);
  }

  if (options.help) {
    return options;
  }

  options.description = normalizeNullableString(options.description);
  options.tags = [...new Set(options.tags.map((tag) => normalizeTagValue(tag, '--tag')))];
  options.languages = [...new Set(options.languages.map((item) => item.toLowerCase()))];
  options.frameworks = [...new Set(options.frameworks.map((item) => item.toLowerCase()))];
  options.artifactTypes = [...new Set(options.artifactTypes.map((item) => item.toLowerCase()))];
  if (options.tags.length === 0 && !options.description) {
    throw new ToolCatalogError('Query requires at least one of --tag or --description.', 2);
  }
  normalizeCurrentFile(options.root ? normalizePath(options.root) : process.cwd(), options.currentFile);
  return options;
}

function parseSelectorCommandOptions(args, globalOptions, commandName) {
  const options = { ...globalOptions, selector: undefined };
  for (const argument of args) {
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported ${commandName} option: ${argument}`, 2);
    }
    if (options.selector) {
      throw new ToolCatalogError(`Unexpected ${commandName} argument: ${argument}`, 2);
    }
    options.selector = argument;
  }
  if (!options.help && !options.selector) {
    throw new ToolCatalogError(`Missing selector. Usage: tool-catalog ${commandName} <selector> [--root <path>]`, 2);
  }
  return options;
}

function expandHome(input) {
  if (!input) {
    return input;
  }
  if (input === '~') {
    return os.homedir();
  }
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function normalizePath(input) {
  return path.resolve(expandHome(input));
}

function getCatalogHome() {
  return normalizePath(process.env.TOOL_CATALOG_HOME || path.join(os.homedir(), DEFAULT_CATALOG_DIR));
}

function getConfigPath(catalogHome) {
  return path.join(catalogHome, CONFIG_FILE_NAME);
}

function defaultConfig() {
  return { version: 1, projects: {} };
}

function readUserConfig(catalogHome) {
  const configPath = getConfigPath(catalogHome);
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      version: 1,
      projects: parsed.projects && typeof parsed.projects === 'object' ? parsed.projects : {},
    };
  } catch (error) {
    throw new ToolCatalogError(`Unable to read Tool Catalog config ${configPath}: ${error.message}`);
  }
}

function writeUserConfig(catalogHome, config) {
  fs.mkdirSync(catalogHome, { recursive: true });
  fs.writeFileSync(getConfigPath(catalogHome), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function resolveTargetRoot(options) {
  if (options.root) {
    return normalizePath(options.root);
  }
  const gitRoot = runCommand('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  return normalizePath(gitRoot || process.cwd());
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'project';
}

function deriveProjectId(rootPath) {
  return `${safeSlug(path.basename(rootPath))}-${sha256(rootPath).slice(0, 12)}`;
}

function mappingKey(rootPath) {
  return `root:${rootPath}`;
}

function isValidProjectId(projectId) {
  return PROJECT_ID_PATTERN.test(projectId);
}

function assertValidProjectId(projectId) {
  if (!isValidProjectId(projectId)) {
    throw new ToolCatalogError(`Invalid project id '${projectId}'. Use ${PROJECT_ID_PATTERN}.`, 2);
  }
}

function getProjectPaths(catalogHome, projectId) {
  const projectDir = path.join(catalogHome, 'projects', projectId);
  return {
    projectDir,
    dbPath: path.join(projectDir, 'index.sqlite'),
    lockPath: path.join(projectDir, 'apply.lock'),
  };
}

function createProjectContext(options, config) {
  const catalogHome = getCatalogHome();
  const rootPath = resolveTargetRoot(options);
  const explicit = config.projects?.[mappingKey(rootPath)]?.project_id;
  const projectId = explicit || deriveProjectId(rootPath);
  assertValidProjectId(projectId);
  return {
    catalogHome,
    rootPath,
    projectId,
    identitySource: explicit ? 'config' : 'root',
    identityKey: rootPath,
    ...getProjectPaths(catalogHome, projectId),
  };
}

function projectContextToOutput(context) {
  return {
    project_id: context.projectId,
    root_path: context.rootPath,
    catalog_path: context.dbPath,
    identity_source: context.identitySource,
    identity_key: context.identityKey,
  };
}

function runSqlite(dbPath, sql, options = {}) {
  assertSqlite3Available();
  const args = ['-batch', '-bail'];
  if (options.readOnly) {
    args.push('-readonly');
  }
  if (options.json) {
    args.push('-json');
  }
  args.push(dbPath);
  const result = spawnSync('sqlite3', args, {
    encoding: 'utf8',
    input: sql,
    maxBuffer: SQLITE_MAX_BUFFER,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new ToolCatalogError(detail ? `sqlite3 failed for ${dbPath}: ${detail}` : `sqlite3 failed for ${dbPath}.`);
  }
  return result.stdout || '';
}

function runSqliteJson(dbPath, sql, options = {}) {
  const output = runSqlite(dbPath, sql, { ...options, json: true }).trim();
  if (!output) {
    return [];
  }
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new ToolCatalogError(`Unable to parse sqlite3 JSON output: ${error.message}`);
  }
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  const integer = Number.parseInt(value, 10);
  return Number.isFinite(integer) ? String(integer) : 'NULL';
}

function transactionSql(sql) {
  return `PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
${sql.trim().replace(/;?\s*$/, ';')}
COMMIT;
`;
}

function loadMigrations() {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(cliDir, '..', 'migrations');
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+-[A-Za-z0-9._-]+\.sql$/.test(name))
    .sort()
    .map((name) => ({
      version: Number.parseInt(name.split('-')[0], 10),
      name,
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    }));
}

function getSchemaVersion(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return 0;
  }
  const tables = runSqliteJson(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata';");
  if (tables.length === 0) {
    return 0;
  }
  const rows = runSqliteJson(dbPath, "SELECT value FROM metadata WHERE key = 'schema_version';");
  return Number.parseInt(rows[0]?.value ?? '0', 10) || 0;
}

function applyMigrations(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const currentVersion = getSchemaVersion(dbPath);
  for (const migration of loadMigrations()) {
    if (migration.version > currentVersion) {
      runSqlite(dbPath, migration.sql);
    }
  }
}

function upsertProjectRecord(context) {
  runSqlite(context.dbPath, transactionSql(`
INSERT INTO projects (id, root_path, identity_source, identity_key, catalog_home, updated_at)
VALUES (${sqlString(context.projectId)}, ${sqlString(context.rootPath)}, ${sqlString(context.identitySource)}, ${sqlString(context.identityKey)}, ${sqlString(context.catalogHome)}, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  root_path = excluded.root_path,
  identity_source = excluded.identity_source,
  identity_key = excluded.identity_key,
  catalog_home = excluded.catalog_home,
  updated_at = datetime('now');
`));
}

function ensureProjectIndex(context) {
  applyMigrations(context.dbPath);
  upsertProjectRecord(context);
}

function getReadOnlySchemaVersion(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return 0;
  }
  try {
    const tables = runSqliteJson(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata';", { readOnly: true });
    if (tables.length === 0) {
      return 0;
    }
    const rows = runSqliteJson(dbPath, "SELECT value FROM metadata WHERE key = 'schema_version';", { readOnly: true });
    return Number.parseInt(rows[0]?.value ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function consultIndexState(context) {
  const exists = fs.existsSync(context.dbPath);
  const schemaVersion = exists ? getReadOnlySchemaVersion(context.dbPath) : 0;
  return {
    exists,
    schemaVersion,
    readable: exists && schemaVersion >= SCHEMA_VERSION,
    reason: exists ? (schemaVersion >= SCHEMA_VERSION ? null : 'schema-too-old') : 'missing-index',
  };
}

function acquireProjectApplyLock(context) {
  fs.mkdirSync(context.projectDir, { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(context.lockPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, project_id: context.projectId, created_at: new Date().toISOString() }));
    return { descriptor, path: context.lockPath };
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new ToolCatalogError(`Another discovery apply is already running for project '${context.projectId}'.`);
    }
    throw error;
  }
}

function withProjectApplyLock(context, callback) {
  const lock = acquireProjectApplyLock(context);
  try {
    return callback();
  } finally {
    fs.closeSync(lock.descriptor);
    fs.rmSync(lock.path, { force: true });
  }
}

function runProjectApplyTransaction(context, sql) {
  return withProjectApplyLock(context, () => runSqlite(context.dbPath, transactionSql(sql)));
}

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredString(value, fieldName, maxLength = MAX_PROSE_CHARS) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    throw new ToolCatalogError(`${fieldName} is required.`, 2);
  }
  if (normalized.length > maxLength) {
    throw new ToolCatalogError(`${fieldName} must be at most ${maxLength} characters.`, 2);
  }
  return normalized;
}

function optionalString(value, fieldName, maxLength = MAX_PROSE_CHARS) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new ToolCatalogError(`${fieldName} must be at most ${maxLength} characters.`, 2);
  }
  return normalized;
}

function requiredInteger(value, fieldName) {
  const integer = Number.parseInt(value, 10);
  if (!Number.isFinite(integer)) {
    throw new ToolCatalogError(`${fieldName} must be an integer.`, 2);
  }
  return integer;
}

function requiredNonNegativeInteger(value, fieldName) {
  const integer = requiredInteger(value, fieldName);
  if (integer < 0) {
    throw new ToolCatalogError(`${fieldName} must be zero or greater.`, 2);
  }
  return integer;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRelativePath(value, fieldName) {
  const raw = requiredString(value, fieldName, 500);
  const normalized = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (path.isAbsolute(raw) || normalized === '..' || normalized.startsWith('../')) {
    throw new ToolCatalogError(`${fieldName} must be a target-project-relative path.`, 2);
  }
  return normalized;
}

function normalizeCurrentFile(rootPath, currentFile) {
  const value = normalizeNullableString(currentFile);
  if (!value) {
    return null;
  }
  const absolutePath = path.isAbsolute(value) ? normalizePath(value) : normalizePath(path.resolve(rootPath, value));
  const relative = path.relative(rootPath, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ToolCatalogError(`Current file is outside the target project root: ${currentFile}`, 2);
  }
  return relative.replace(/\\/g, '/');
}

function normalizeCapabilityTags(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolCatalogError(`${fieldName} must be a non-empty array.`, 2);
  }
  return [...new Set(value.map((item) => normalizeTagValue(item, fieldName)))];
}

function assertNoFields(object, fieldNames, label) {
  for (const fieldName of fieldNames) {
    if (Object.hasOwn(object, fieldName)) {
      throw new ToolCatalogError(`${label} must not include '${fieldName}'.`, 2);
    }
  }
}

function normalizeSelector(selector, prefix, fieldName) {
  const value = requiredString(selector, fieldName, 500);
  if (!value.startsWith(`${prefix}:`)) {
    throw new ToolCatalogError(`${fieldName} must use '${prefix}:' prefix.`, 2);
  }
  if (value.length === `${prefix}:`.length) {
    throw new ToolCatalogError(`${fieldName} must include an identifier after '${prefix}:'.`, 2);
  }
  return value;
}

function normalizeSourceAnchor(value, expectedSelector, fieldName) {
  if (!isPlainObject(value)) {
    throw new ToolCatalogError(`${fieldName} must be an object with path, symbol, and optional line.`, 2);
  }
  const line = value.line === undefined || value.line === null ? null : requiredInteger(value.line, `${fieldName}.line`);
  if (line !== null && line < 1) {
    throw new ToolCatalogError(`${fieldName}.line must be a positive integer.`, 2);
  }
  const anchor = {
    path: normalizeRelativePath(value.path, `${fieldName}.path`),
    symbol: requiredString(value.symbol, `${fieldName}.symbol`, 500),
  };
  if (line !== null) {
    anchor.line = line;
  }
  if (anchor.symbol !== expectedSelector.slice('artifact:'.length)) {
    throw new ToolCatalogError(`${fieldName}.symbol must match the artifact selector identity.`, 2);
  }
  return anchor;
}

function normalizeProject(value) {
  if (!isPlainObject(value)) {
    throw new ToolCatalogError('project must be an object.', 2);
  }
  const mode = requiredString(value.mode, 'project.mode');
  if (mode !== 'full' && mode !== 'changed') {
    throw new ToolCatalogError("project.mode must be 'full' or 'changed'.", 2);
  }
  return { mode };
}

function normalizeRemoved(value) {
  if (!isPlainObject(value)) {
    throw new ToolCatalogError('removed must be an object.', 2);
  }
  const groups = ['artifacts', 'external_selectors', 'origins', 'suppressions', 'fingerprints'];
  const removed = {};
  for (const group of groups) {
    if (!Array.isArray(value[group])) {
      throw new ToolCatalogError(`removed.${group} must be an array.`, 2);
    }
    removed[group] = [...new Set(value[group].map((item) => requiredString(item, `removed.${group}[]`, 500)))];
  }
  for (const key of Object.keys(value)) {
    if (!groups.includes(key)) {
      throw new ToolCatalogError(`removed contains unsupported key '${key}'.`, 2);
    }
  }
  return removed;
}

function normalizeArtifact(raw, index) {
  if (!isPlainObject(raw)) {
    throw new ToolCatalogError(`artifacts[${index}] must be an object.`, 2);
  }
  const selector = normalizeSelector(raw.selector, 'artifact', `artifacts[${index}].selector`);
  return {
    selector,
    language: requiredString(raw.language, `artifacts[${index}].language`, 80).toLowerCase(),
    artifactType: requiredString(raw.artifact_type, `artifacts[${index}].artifact_type`, 80).toLowerCase(),
    framework: optionalString(raw.framework, `artifacts[${index}].framework`, 80)?.toLowerCase() ?? null,
    modulePath: raw.module_path === undefined ? null : normalizeRelativePath(raw.module_path, `artifacts[${index}].module_path`),
    summary: requiredString(raw.summary, `artifacts[${index}].summary`),
    usageNotes: optionalString(raw.usage_notes, `artifacts[${index}].usage_notes`),
    limitations: optionalString(raw.limitations, `artifacts[${index}].limitations`),
    sourceAnchor: normalizeSourceAnchor(raw.source_anchor, selector, `artifacts[${index}].source_anchor`),
    priority: requiredInteger(raw.priority, `artifacts[${index}].priority`),
    capabilityTags: normalizeCapabilityTags(raw.capability_tags, `artifacts[${index}].capability_tags`),
  };
}

function normalizeExternalSelector(raw, index) {
  if (!isPlainObject(raw)) {
    throw new ToolCatalogError(`external_selectors[${index}] must be an object.`, 2);
  }
  assertNoFields(raw, ['source_anchor', 'priority', 'artifact_type', 'module_path'], `external_selectors[${index}]`);
  return {
    selector: normalizeSelector(raw.selector, 'external', `external_selectors[${index}].selector`),
    originKey: requiredString(raw.origin_key, `external_selectors[${index}].origin_key`, 500),
    language: requiredString(raw.language, `external_selectors[${index}].language`, 80).toLowerCase(),
    framework: optionalString(raw.framework, `external_selectors[${index}].framework`, 80)?.toLowerCase() ?? null,
    summary: requiredString(raw.summary, `external_selectors[${index}].summary`),
    usageNotes: optionalString(raw.usage_notes, `external_selectors[${index}].usage_notes`),
    limitations: optionalString(raw.limitations, `external_selectors[${index}].limitations`),
    capabilityTags: normalizeCapabilityTags(raw.capability_tags, `external_selectors[${index}].capability_tags`),
  };
}

function normalizeOrigin(raw, index) {
  if (!isPlainObject(raw)) {
    throw new ToolCatalogError(`origins[${index}] must be an object.`, 2);
  }
  return {
    originKey: requiredString(raw.origin_key, `origins[${index}].origin_key`, 500),
    originType: requiredString(raw.origin_type, `origins[${index}].origin_type`, 80),
    displayName: requiredString(raw.display_name, `origins[${index}].display_name`, 500),
    usageCount: requiredNonNegativeInteger(raw.usage_count, `origins[${index}].usage_count`),
    priority: requiredInteger(raw.priority, `origins[${index}].priority`),
  };
}

function normalizeTargetKind(value, fieldName) {
  const targetKind = requiredString(value, fieldName);
  if (!['artifact', 'external_selector', 'origin'].includes(targetKind)) {
    throw new ToolCatalogError(`${fieldName} must be artifact, external_selector, or origin.`, 2);
  }
  return targetKind;
}

function normalizeSuppression(raw, index) {
  if (!isPlainObject(raw)) {
    throw new ToolCatalogError(`suppressions[${index}] must be an object.`, 2);
  }
  assertNoFields(raw, ['summary', 'usage_notes', 'limitations', 'capability_tags'], `suppressions[${index}]`);
  return {
    suppressionKey: requiredString(raw.suppression_key, `suppressions[${index}].suppression_key`, 500),
    targetKind: normalizeTargetKind(raw.target_kind, `suppressions[${index}].target_kind`),
    targetKey: requiredString(raw.target_key, `suppressions[${index}].target_key`, 500),
    reason: requiredString(raw.reason, `suppressions[${index}].reason`),
    fingerprintKey: requiredString(raw.fingerprint_key, `suppressions[${index}].fingerprint_key`, 500),
  };
}

function normalizeFingerprint(raw, index) {
  if (!isPlainObject(raw)) {
    throw new ToolCatalogError(`fingerprints[${index}] must be an object.`, 2);
  }
  return {
    fingerprintKey: requiredString(raw.fingerprint_key, `fingerprints[${index}].fingerprint_key`, 500),
    targetKind: normalizeTargetKind(raw.target_kind, `fingerprints[${index}].target_kind`),
    targetKey: requiredString(raw.target_key, `fingerprints[${index}].target_key`, 500),
    fingerprint: requiredString(raw.fingerprint, `fingerprints[${index}].fingerprint`, 2000),
  };
}

function normalizeDecisionFile(input) {
  if (!isPlainObject(input)) {
    throw new ToolCatalogError('Discovery Decision File must be a JSON object.', 2);
  }
  const keys = ['project', 'artifacts', 'external_selectors', 'origins', 'suppressions', 'fingerprints', 'removed'];
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) {
      throw new ToolCatalogError(`Discovery Decision File missing top-level key '${key}'.`, 2);
    }
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) {
      throw new ToolCatalogError(`Discovery Decision File contains unsupported top-level key '${key}'.`, 2);
    }
  }
  for (const arrayKey of ['artifacts', 'external_selectors', 'origins', 'suppressions', 'fingerprints']) {
    if (!Array.isArray(input[arrayKey])) {
      throw new ToolCatalogError(`${arrayKey} must be an array.`, 2);
    }
  }

  return {
    project: normalizeProject(input.project),
    artifacts: input.artifacts.map(normalizeArtifact),
    externalSelectors: input.external_selectors.map(normalizeExternalSelector),
    origins: input.origins.map(normalizeOrigin),
    suppressions: input.suppressions.map(normalizeSuppression),
    fingerprints: input.fingerprints.map(normalizeFingerprint),
    removed: normalizeRemoved(input.removed),
  };
}

function readJsonFile(filePath) {
  const resolvedPath = path.resolve(expandHome(filePath));
  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new ToolCatalogError(`Unable to read JSON file ${resolvedPath}: ${error.message}`, 2);
  }
}

function tagInsertSql(projectId, tag) {
  return `
INSERT INTO capability_tags (project_id, tag, updated_at)
VALUES (${sqlString(projectId)}, ${sqlString(tag)}, datetime('now'))
ON CONFLICT(project_id, tag) DO UPDATE SET updated_at = datetime('now');
`;
}

function resetEntryTagsSql(projectId, entryType, entryIdSql, tags) {
  const statements = [`DELETE FROM entry_capability_tags WHERE project_id = ${sqlString(projectId)} AND entry_type = ${sqlString(entryType)} AND entry_id = ${entryIdSql};`];
  for (const tag of tags) {
    statements.push(tagInsertSql(projectId, tag));
    statements.push(`
INSERT INTO entry_capability_tags (project_id, entry_type, entry_id, tag_id)
VALUES (${sqlString(projectId)}, ${sqlString(entryType)}, ${entryIdSql}, (SELECT id FROM capability_tags WHERE project_id = ${sqlString(projectId)} AND tag = ${sqlString(tag)}))
ON CONFLICT(project_id, entry_type, entry_id, tag_id) DO NOTHING;
`);
  }
  return statements.join('\n');
}

function artifactIdSql(projectId, selector) {
  return `(SELECT id FROM artifacts WHERE project_id = ${sqlString(projectId)} AND selector = ${sqlString(selector)})`;
}

function externalSelectorIdSql(projectId, selector) {
  return `(SELECT id FROM external_selectors WHERE project_id = ${sqlString(projectId)} AND selector = ${sqlString(selector)})`;
}

function upsertOriginSql(projectId, origin) {
  return `
INSERT INTO utility_origins (project_id, origin_key, origin_type, display_name, usage_count, priority, updated_at)
VALUES (${sqlString(projectId)}, ${sqlString(origin.originKey)}, ${sqlString(origin.originType)}, ${sqlString(origin.displayName)}, ${sqlInteger(origin.usageCount)}, ${sqlInteger(origin.priority)}, datetime('now'))
ON CONFLICT(project_id, origin_key) DO UPDATE SET
  origin_type = excluded.origin_type,
  display_name = excluded.display_name,
  usage_count = excluded.usage_count,
  priority = excluded.priority,
  updated_at = datetime('now');
`;
}

function upsertArtifactSql(projectId, artifact) {
  const idSql = artifactIdSql(projectId, artifact.selector);
  return `
INSERT INTO artifacts (project_id, selector, language, artifact_type, framework, module_path, summary, usage_notes, limitations, source_anchor, priority, updated_at)
VALUES (${sqlString(projectId)}, ${sqlString(artifact.selector)}, ${sqlString(artifact.language)}, ${sqlString(artifact.artifactType)}, ${sqlString(artifact.framework)}, ${sqlString(artifact.modulePath)}, ${sqlString(artifact.summary)}, ${sqlString(artifact.usageNotes)}, ${sqlString(artifact.limitations)}, ${sqlString(JSON.stringify(artifact.sourceAnchor))}, ${sqlInteger(artifact.priority)}, datetime('now'))
ON CONFLICT(project_id, selector) DO UPDATE SET
  language = excluded.language,
  artifact_type = excluded.artifact_type,
  framework = excluded.framework,
  module_path = excluded.module_path,
  summary = excluded.summary,
  usage_notes = excluded.usage_notes,
  limitations = excluded.limitations,
  source_anchor = excluded.source_anchor,
  priority = excluded.priority,
  updated_at = datetime('now');
${resetEntryTagsSql(projectId, 'artifact', idSql, artifact.capabilityTags)}
`;
}

function upsertExternalSelectorSql(projectId, selector) {
  const idSql = externalSelectorIdSql(projectId, selector.selector);
  return `
INSERT INTO external_selectors (project_id, selector, origin_id, origin_key, language, framework, summary, usage_notes, limitations, updated_at)
VALUES (
  ${sqlString(projectId)},
  ${sqlString(selector.selector)},
  (SELECT id FROM utility_origins WHERE project_id = ${sqlString(projectId)} AND origin_key = ${sqlString(selector.originKey)}),
  ${sqlString(selector.originKey)},
  ${sqlString(selector.language)},
  ${sqlString(selector.framework)},
  ${sqlString(selector.summary)},
  ${sqlString(selector.usageNotes)},
  ${sqlString(selector.limitations)},
  datetime('now')
)
ON CONFLICT(project_id, selector) DO UPDATE SET
  origin_id = excluded.origin_id,
  origin_key = excluded.origin_key,
  language = excluded.language,
  framework = excluded.framework,
  summary = excluded.summary,
  usage_notes = excluded.usage_notes,
  limitations = excluded.limitations,
  updated_at = datetime('now');
${resetEntryTagsSql(projectId, 'external_selector', idSql, selector.capabilityTags)}
`;
}

function upsertSuppressionSql(projectId, suppression) {
  return `
INSERT INTO suppressions (project_id, suppression_key, target_kind, target_key, reason, fingerprint_key, updated_at)
VALUES (${sqlString(projectId)}, ${sqlString(suppression.suppressionKey)}, ${sqlString(suppression.targetKind)}, ${sqlString(suppression.targetKey)}, ${sqlString(suppression.reason)}, ${sqlString(suppression.fingerprintKey)}, datetime('now'))
ON CONFLICT(project_id, suppression_key) DO UPDATE SET
  target_kind = excluded.target_kind,
  target_key = excluded.target_key,
  reason = excluded.reason,
  fingerprint_key = excluded.fingerprint_key,
  updated_at = datetime('now');
`;
}

function upsertFingerprintSql(projectId, fingerprint) {
  return `
INSERT INTO discovery_fingerprints (project_id, fingerprint_key, target_kind, target_key, fingerprint, updated_at)
VALUES (${sqlString(projectId)}, ${sqlString(fingerprint.fingerprintKey)}, ${sqlString(fingerprint.targetKind)}, ${sqlString(fingerprint.targetKey)}, ${sqlString(fingerprint.fingerprint)}, datetime('now'))
ON CONFLICT(project_id, fingerprint_key) DO UPDATE SET
  target_kind = excluded.target_kind,
  target_key = excluded.target_key,
  fingerprint = excluded.fingerprint,
  updated_at = datetime('now');
`;
}

function cleanupFullSql(projectId) {
  return `
DELETE FROM entry_capability_tags WHERE project_id = ${sqlString(projectId)};
DELETE FROM artifacts WHERE project_id = ${sqlString(projectId)};
DELETE FROM external_selectors WHERE project_id = ${sqlString(projectId)};
DELETE FROM utility_origins WHERE project_id = ${sqlString(projectId)};
DELETE FROM suppressions WHERE project_id = ${sqlString(projectId)};
DELETE FROM discovery_fingerprints WHERE project_id = ${sqlString(projectId)};
DELETE FROM capability_tags WHERE project_id = ${sqlString(projectId)};
`;
}

function removalSql(projectId, removed) {
  const statements = [];
  for (const selector of removed.artifacts) {
    statements.push(`DELETE FROM artifacts WHERE project_id = ${sqlString(projectId)} AND selector = ${sqlString(selector)};`);
  }
  for (const selector of removed.external_selectors) {
    statements.push(`DELETE FROM external_selectors WHERE project_id = ${sqlString(projectId)} AND selector = ${sqlString(selector)};`);
  }
  for (const originKey of removed.origins) {
    statements.push(`DELETE FROM utility_origins WHERE project_id = ${sqlString(projectId)} AND origin_key = ${sqlString(originKey)};`);
  }
  for (const suppressionKey of removed.suppressions) {
    statements.push(`DELETE FROM suppressions WHERE project_id = ${sqlString(projectId)} AND suppression_key = ${sqlString(suppressionKey)};`);
  }
  for (const fingerprintKey of removed.fingerprints) {
    statements.push(`DELETE FROM discovery_fingerprints WHERE project_id = ${sqlString(projectId)} AND fingerprint_key = ${sqlString(fingerprintKey)};`);
  }
  return statements.join('\n');
}

function pruneUnusedTagsSql(projectId) {
  return `
DELETE FROM capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND id NOT IN (SELECT tag_id FROM entry_capability_tags WHERE project_id = ${sqlString(projectId)});
`;
}

function buildApplySql(projectId, decisionFile) {
  const statements = [];
  if (decisionFile.project.mode === 'full') {
    statements.push(cleanupFullSql(projectId));
  } else {
    statements.push(removalSql(projectId, decisionFile.removed));
  }
  for (const origin of decisionFile.origins) {
    statements.push(upsertOriginSql(projectId, origin));
  }
  for (const artifact of decisionFile.artifacts) {
    statements.push(upsertArtifactSql(projectId, artifact));
  }
  for (const selector of decisionFile.externalSelectors) {
    statements.push(upsertExternalSelectorSql(projectId, selector));
  }
  for (const suppression of decisionFile.suppressions) {
    statements.push(upsertSuppressionSql(projectId, suppression));
  }
  for (const fingerprint of decisionFile.fingerprints) {
    statements.push(upsertFingerprintSql(projectId, fingerprint));
  }
  statements.push(pruneUnusedTagsSql(projectId));
  return statements.join('\n');
}

function getCatalogCounts(context) {
  return runSqliteJson(context.dbPath, `
SELECT
  (SELECT COUNT(*) FROM artifacts WHERE project_id = ${sqlString(context.projectId)}) AS artifacts,
  (SELECT COUNT(*) FROM external_selectors WHERE project_id = ${sqlString(context.projectId)}) AS external_selectors,
  (SELECT COUNT(*) FROM utility_origins WHERE project_id = ${sqlString(context.projectId)}) AS origins,
  (SELECT COUNT(*) FROM suppressions WHERE project_id = ${sqlString(context.projectId)}) AS suppressions,
  (SELECT COUNT(*) FROM discovery_fingerprints WHERE project_id = ${sqlString(context.projectId)}) AS fingerprints,
  (SELECT COUNT(*) FROM capability_tags WHERE project_id = ${sqlString(context.projectId)}) AS capability_tags,
  (SELECT COUNT(*) FROM entry_capability_tags WHERE project_id = ${sqlString(context.projectId)}) AS entry_capability_tags;
`)[0] ?? {};
}

function diffCounts(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return Object.fromEntries(keys.map((key) => [key, Number(after[key] ?? 0) - Number(before[key] ?? 0)]));
}

function applyDiscoveryDecisionFile(context, decisionFile) {
  return withProjectApplyLock(context, () => {
    ensureProjectIndex(context);
    const before = getCatalogCounts(context);
    runSqlite(context.dbPath, transactionSql(buildApplySql(context.projectId, decisionFile)));
    const after = getCatalogCounts(context);
    return {
      kind: 'tool_catalog_discovery_apply',
      version: 2,
      applied_at: new Date().toISOString(),
      index_mutated: true,
      project: projectContextToOutput(context),
      mode: decisionFile.project.mode,
      applied: {
        artifacts: decisionFile.artifacts.length,
        external_selectors: decisionFile.externalSelectors.length,
        origins: decisionFile.origins.length,
        suppressions: decisionFile.suppressions.length,
        fingerprints: decisionFile.fingerprints.length,
      },
      removed: decisionFile.removed,
      counts: {
        before,
        after,
        delta: diffCounts(before, after),
      },
    };
  });
}

function renderApplyMarkdown(summary) {
  return [
    '# Tool Catalog Discovery Apply',
    '',
    `Project: \`${summary.project.project_id}\``,
    `Root: \`${summary.project.root_path}\``,
    `Index: \`${summary.project.catalog_path}\``,
    `Mode: \`${summary.mode}\``,
    `Index mutated: \`${summary.index_mutated}\``,
    '',
    '## Applied',
    `- Artifacts: ${summary.applied.artifacts}`,
    `- External selectors: ${summary.applied.external_selectors}`,
    `- Origins: ${summary.applied.origins}`,
    `- Suppressions: ${summary.applied.suppressions}`,
    `- Fingerprints: ${summary.applied.fingerprints}`,
    '',
    '## Count Delta',
    ...Object.entries(summary.counts.delta).map(([key, value]) => `- ${key}: ${value >= 0 ? '+' : ''}${value}`),
  ].join('\n') + '\n';
}

function unavailableOutput(kind, context, state) {
  return {
    kind,
    version: 1,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    index: {
      status: state.reason,
      schema_version: state.schemaVersion,
      readable: false,
    },
    warnings: [
      state.reason === 'missing-index'
        ? 'No project index exists. Run tool-catalog-discover before consulting.'
        : 'The project index schema is too old. Run discovery apply to migrate it.',
    ],
  };
}

function entryTagsSql(entryType, idExpression) {
  return `(SELECT json_group_array(capability_tags.tag)
    FROM entry_capability_tags
    JOIN capability_tags ON capability_tags.id = entry_capability_tags.tag_id
    WHERE entry_capability_tags.entry_type = ${sqlString(entryType)}
      AND entry_capability_tags.entry_id = ${idExpression})`;
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }
  try {
    return JSON.parse(value).filter(Boolean);
  } catch {
    return [];
  }
}

function loadTagsForEntry(context, entryType, entryId) {
  return runSqliteJson(context.dbPath, `
SELECT capability_tags.tag
FROM entry_capability_tags
JOIN capability_tags ON capability_tags.id = entry_capability_tags.tag_id
WHERE entry_capability_tags.project_id = ${sqlString(context.projectId)}
  AND entry_capability_tags.entry_type = ${sqlString(entryType)}
  AND entry_capability_tags.entry_id = ${sqlInteger(entryId)}
ORDER BY capability_tags.tag;
`, { readOnly: true }).map((row) => row.tag);
}

function loadTags(context) {
  return runSqliteJson(context.dbPath, `
SELECT
  capability_tags.tag,
  COUNT(DISTINCT entry_capability_tags.entry_type || ':' || entry_capability_tags.entry_id) AS entry_count,
  COUNT(DISTINCT CASE WHEN entry_capability_tags.entry_type = 'artifact' THEN entry_capability_tags.entry_id END) AS project_entry_count,
  COUNT(DISTINCT CASE WHEN entry_capability_tags.entry_type = 'external_selector' THEN entry_capability_tags.entry_id END) AS external_entry_count
FROM capability_tags
LEFT JOIN entry_capability_tags
  ON entry_capability_tags.project_id = capability_tags.project_id
  AND entry_capability_tags.tag_id = capability_tags.id
WHERE capability_tags.project_id = ${sqlString(context.projectId)}
GROUP BY capability_tags.id, capability_tags.tag
ORDER BY capability_tags.tag;
`, { readOnly: true }).map((row) => ({
    tag: row.tag,
    entry_count: Number(row.entry_count ?? 0),
    project_entry_count: Number(row.project_entry_count ?? 0),
    external_entry_count: Number(row.external_entry_count ?? 0),
  }));
}

function buildTagsOutput(context, state) {
  if (!state.readable) {
    return { ...unavailableOutput('tool_catalog_tags', context, state), tags: [] };
  }
  return {
    kind: 'tool_catalog_tags',
    version: 2,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    tags: loadTags(context),
    warnings: [],
  };
}

function renderTagsMarkdown(output) {
  const lines = [
    '# Tool Catalog Tags',
    '',
    `Project: \`${output.project.project_id}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Tags',
  ];
  if (!output.tags?.length) {
    lines.push('- None.');
  } else {
    for (const tag of output.tags) {
      lines.push(`- \`${tag.tag}\` (${tag.entry_count} entries; project ${tag.project_entry_count}, external ${tag.external_entry_count})`);
    }
  }
  if (output.warnings?.length) {
    lines.push('', '## Notes', ...output.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join('\n')}\n`;
}

function textTerms(description) {
  return [...new Set(String(description ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((term) => term.length >= 2);
}

function hasAllTerms(row, terms) {
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${row.summary ?? ''} ${row.usage_notes ?? ''} ${row.limitations ?? ''}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function hasAllTags(row, tags) {
  if (tags.length === 0) {
    return true;
  }
  const rowTags = new Set(parseJsonArray(row.capability_tags));
  return tags.every((tag) => rowTags.has(tag));
}

function inFilter(value, filters) {
  return filters.length === 0 || filters.includes(String(value ?? '').toLowerCase());
}

function queryArtifactRows(context) {
  return runSqliteJson(context.dbPath, `
SELECT
  artifacts.*,
  ${entryTagsSql('artifact', 'artifacts.id')} AS capability_tags
FROM artifacts
WHERE artifacts.project_id = ${sqlString(context.projectId)}
ORDER BY artifacts.priority ASC, artifacts.selector ASC;
`, { readOnly: true });
}

function queryExternalRows(context) {
  return runSqliteJson(context.dbPath, `
SELECT
  external_selectors.*,
  utility_origins.display_name,
  utility_origins.origin_type,
  utility_origins.usage_count,
  utility_origins.priority,
  ${entryTagsSql('external_selector', 'external_selectors.id')} AS capability_tags
FROM external_selectors
JOIN utility_origins ON utility_origins.id = external_selectors.origin_id
WHERE external_selectors.project_id = ${sqlString(context.projectId)}
ORDER BY utility_origins.priority ASC, external_selectors.selector ASC;
`, { readOnly: true });
}

function artifactQueryItem(row) {
  return {
    kind: 'artifact',
    selector: row.selector,
    summary: row.summary,
    capability_tags: parseJsonArray(row.capability_tags),
    priority: Number(row.priority),
    language: row.language,
    framework: row.framework ?? undefined,
    module_path: row.module_path ?? undefined,
  };
}

function externalQueryItem(row) {
  return {
    kind: 'external',
    selector: row.selector,
    summary: row.summary,
    capability_tags: parseJsonArray(row.capability_tags),
    priority: Number(row.priority),
    language: row.language,
    framework: row.framework ?? undefined,
    origin_key: row.origin_key,
    display_name: row.display_name,
    usage_count: Number(row.usage_count ?? 0),
  };
}

function passesArtifactFilters(row, queryOptions, terms) {
  return hasAllTags(row, queryOptions.tags)
    && hasAllTerms(row, terms)
    && inFilter(row.language, queryOptions.languages)
    && inFilter(row.framework, queryOptions.frameworks)
    && inFilter(row.artifact_type, queryOptions.artifactTypes);
}

function passesExternalFilters(row, queryOptions, terms) {
  return hasAllTags(row, queryOptions.tags)
    && hasAllTerms(row, terms)
    && inFilter(row.language, queryOptions.languages)
    && inFilter(row.framework, queryOptions.frameworks);
}

function buildQueryOutput(context, state, queryOptions) {
  if (!state.readable) {
    return { ...unavailableOutput('tool_catalog_query', context, state), results: [] };
  }
  const terms = textTerms(queryOptions.description);
  const artifacts = queryArtifactRows(context)
    .filter((row) => passesArtifactFilters(row, queryOptions, terms))
    .slice(0, queryOptions.limit)
    .map(artifactQueryItem);
  const remaining = Math.max(0, queryOptions.limit - artifacts.length);
  const external = remaining === 0 ? [] : queryExternalRows(context)
    .filter((row) => passesExternalFilters(row, queryOptions, terms))
    .slice(0, remaining)
    .map(externalQueryItem);
  const results = [...artifacts, ...external];
  const warnings = [];
  if (queryOptions.tags.length > 0 && results.length === 0) {
    warnings.push('No results matched the exact tag filter. Inspect tool-catalog tags or broaden once with --description.');
  }
  return {
    kind: 'tool_catalog_query',
    version: 2,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    query: {
      tags: queryOptions.tags,
      description: queryOptions.description,
      limit: queryOptions.limit,
      language: queryOptions.languages,
      framework: queryOptions.frameworks,
      artifact_type: queryOptions.artifactTypes,
    },
    results,
    warnings,
  };
}

function renderQueryMarkdown(output) {
  const lines = [
    '# Tool Catalog Query',
    '',
    `Project: \`${output.project.project_id}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Results',
  ];
  if (!output.results?.length) {
    lines.push('- None.');
  } else {
    for (const result of output.results) {
      const tags = result.capability_tags.map((tag) => `\`${tag}\``).join(', ');
      lines.push(`- \`${result.selector}\` (${result.kind}, priority ${result.priority})`);
      lines.push(`  Summary: ${result.summary}`);
      lines.push(`  Tags: ${tags || 'none'}`);
      if (result.kind === 'external') {
        lines.push(`  Origin: \`${result.origin_key}\` (${result.display_name}, usage ${result.usage_count})`);
      }
    }
  }
  if (output.warnings?.length) {
    lines.push('', '## Notes', ...output.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join('\n')}\n`;
}

function parseStoredAnchor(value) {
  try {
    const parsed = JSON.parse(value);
    if (isPlainObject(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function loadArtifactEntry(context, selector) {
  const rows = runSqliteJson(context.dbPath, `
SELECT * FROM artifacts
WHERE project_id = ${sqlString(context.projectId)}
  AND selector = ${sqlString(selector)}
LIMIT 1;
`, { readOnly: true });
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    kind: 'artifact',
    selector: row.selector,
    summary: row.summary,
    usage_notes: row.usage_notes,
    limitations: row.limitations,
    capability_tags: loadTagsForEntry(context, 'artifact', row.id),
    priority: Number(row.priority),
    language: row.language,
    artifact_type: row.artifact_type,
    framework: row.framework,
    module_path: row.module_path,
    source_anchor: parseStoredAnchor(row.source_anchor),
  };
}

function loadExternalEntry(context, selector) {
  const rows = runSqliteJson(context.dbPath, `
SELECT
  external_selectors.*,
  utility_origins.origin_type,
  utility_origins.display_name,
  utility_origins.usage_count,
  utility_origins.priority
FROM external_selectors
JOIN utility_origins ON utility_origins.id = external_selectors.origin_id
WHERE external_selectors.project_id = ${sqlString(context.projectId)}
  AND external_selectors.selector = ${sqlString(selector)}
LIMIT 1;
`, { readOnly: true });
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    kind: 'external',
    selector: row.selector,
    summary: row.summary,
    usage_notes: row.usage_notes,
    limitations: row.limitations,
    capability_tags: loadTagsForEntry(context, 'external_selector', row.id),
    priority: Number(row.priority),
    language: row.language,
    framework: row.framework,
    origin: {
      origin_key: row.origin_key,
      origin_type: row.origin_type,
      display_name: row.display_name,
      usage_count: Number(row.usage_count ?? 0),
      priority: Number(row.priority),
    },
  };
}

function loadEntry(context, selector) {
  if (selector.startsWith('artifact:')) {
    return loadArtifactEntry(context, selector);
  }
  if (selector.startsWith('external:')) {
    return loadExternalEntry(context, selector);
  }
  throw new ToolCatalogError(`Unsupported selector '${selector}'. Use artifact: or external:.`, 2);
}

function buildShowOutput(context, state, selector) {
  if (!state.readable) {
    return { ...unavailableOutput('tool_catalog_show', context, state), selector, found: false };
  }
  const entry = loadEntry(context, selector);
  return {
    kind: 'tool_catalog_show',
    version: 2,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    selector,
    found: Boolean(entry),
    entry,
    warnings: entry ? [] : [`No catalog entry matched selector '${selector}'.`],
  };
}

function renderShowMarkdown(output) {
  const lines = [
    '# Tool Catalog Show',
    '',
    `Project: \`${output.project.project_id}\``,
    `Selector: \`${output.selector}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
  ];
  if (!output.found) {
    lines.push('', '## Entry', '- Not found.');
  } else {
    const entry = output.entry;
    lines.push('', '## Entry');
    lines.push(`- Kind: \`${entry.kind}\``);
    lines.push(`- Summary: ${entry.summary}`);
    lines.push(`- Tags: ${entry.capability_tags.map((tag) => `\`${tag}\``).join(', ')}`);
    if (entry.source_anchor) {
      lines.push(`- Source: \`${entry.source_anchor.path}${entry.source_anchor.line ? `:${entry.source_anchor.line}` : ''}#${entry.source_anchor.symbol}\``);
    }
    if (entry.usage_notes) {
      lines.push(`- Usage notes: ${entry.usage_notes}`);
    }
    if (entry.limitations) {
      lines.push(`- Limitations: ${entry.limitations}`);
    }
    if (entry.origin) {
      lines.push(`- Origin: \`${entry.origin.origin_key}\` (${entry.origin.display_name}, usage ${entry.origin.usage_count})`);
    }
  }
  if (output.warnings?.length) {
    lines.push('', '## Notes', ...output.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join('\n')}\n`;
}

function verifyArtifactSource(rootPath, entry) {
  const anchor = entry.source_anchor;
  if (!anchor) {
    return { ok: false, status: 'missing-anchor', checks: [] };
  }
  const absolutePath = path.resolve(rootPath, anchor.path);
  const inside = !path.relative(rootPath, absolutePath).startsWith('..') && !path.isAbsolute(path.relative(rootPath, absolutePath));
  if (!inside) {
    return {
      ok: false,
      status: 'outside-root',
      checks: [{ label: 'source_anchor', status: 'outside-root', ok: false, anchor }],
    };
  }
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      status: 'missing-file',
      checks: [{ label: 'source_anchor', status: 'missing-file', ok: false, anchor }],
    };
  }
  const text = fs.readFileSync(absolutePath, 'utf8');
  const line = anchor.line ? Number(anchor.line) : null;
  const lineOk = line === null || line <= text.split(/\r?\n/).length;
  return {
    ok: lineOk,
    status: lineOk ? 'verified' : 'stale-line',
    checks: [{
      label: 'source_anchor',
      status: lineOk ? 'verified' : 'stale-line',
      ok: lineOk,
      anchor,
      message: lineOk ? 'Source file exists in the current working tree.' : 'Source file exists but line hint is outside the file.',
    }],
  };
}

function buildVerifyOutput(context, state, selector) {
  if (selector.startsWith('external:')) {
    throw new ToolCatalogError('verify accepts only project-owned artifact: selectors. External selectors must be checked by the agent.', 2);
  }
  if (!selector.startsWith('artifact:')) {
    throw new ToolCatalogError('verify accepts only artifact: selectors.', 2);
  }
  if (!state.readable) {
    return { ...unavailableOutput('tool_catalog_verify', context, state), selector, found: false, ok: false, status: state.reason };
  }
  const entry = loadArtifactEntry(context, selector);
  if (!entry) {
    return {
      kind: 'tool_catalog_verify',
      version: 2,
      generated_at: new Date().toISOString(),
      index_mutated: false,
      project: projectContextToOutput(context),
      selector,
      found: false,
      ok: false,
      status: 'missing-entry',
      checks: [],
      warnings: [`No catalog entry matched selector '${selector}'.`],
    };
  }
  const verification = verifyArtifactSource(context.rootPath, entry);
  return {
    kind: 'tool_catalog_verify',
    version: 2,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    selector,
    found: true,
    entry: {
      selector: entry.selector,
      kind: entry.kind,
    },
    ...verification,
    warnings: verification.ok ? [] : ['Stored source anchor is stale or missing; rerun discovery.'],
  };
}

function renderVerifyMarkdown(output) {
  const lines = [
    '# Tool Catalog Verify',
    '',
    `Project: \`${output.project.project_id}\``,
    `Selector: \`${output.selector}\``,
    `Status: \`${output.status}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Checks',
  ];
  if (!output.checks?.length) {
    lines.push('- None.');
  } else {
    for (const check of output.checks) {
      lines.push(`- \`${check.label}\` ${check.status}: \`${check.anchor?.path ?? 'n/a'}\``);
    }
  }
  if (output.warnings?.length) {
    lines.push('', '## Notes', ...output.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join('\n')}\n`;
}

function printOutput(output, options, renderer) {
  if (options.json) {
    print(JSON.stringify(output, null, 2));
    return;
  }
  process.stdout.write(renderer(output));
}

function handleConfigProjectId(args, options) {
  const projectId = args[0];
  if (!projectId) {
    throw new ToolCatalogError('Missing project id. Usage: tool-catalog config project-id <id> [--root <path>]', 2);
  }
  assertValidProjectId(projectId);
  const catalogHome = getCatalogHome();
  const rootPath = resolveTargetRoot(options);
  const config = readUserConfig(catalogHome);
  config.projects[mappingKey(rootPath)] = {
    project_id: projectId,
    root_path: rootPath,
    updated_at: new Date().toISOString(),
  };
  const context = createProjectContext(options, config);
  ensureProjectIndex(context);
  writeUserConfig(catalogHome, config);
  printProjectContext(context, options, `Configured Tool Catalog project id '${projectId}'.`);
  return 0;
}

function printProjectContext(context, options, leadLine = 'Resolved Tool Catalog project index.') {
  const output = {
    kind: 'tool_catalog_project',
    version: 1,
    project: projectContextToOutput(context),
    index_mutated: true,
  };
  if (options.json) {
    print(JSON.stringify(output, null, 2));
    return;
  }
  print(`# Tool Catalog Project

${leadLine}

- Project: \`${context.projectId}\`
- Root: \`${context.rootPath}\`
- Index: \`${context.dbPath}\``);
}

function handleConfigInfo(options) {
  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  const context = createProjectContext(options, config);
  ensureProjectIndex(context);
  printProjectContext(context, options);
  return 0;
}

function handleConfigCommand(args, options) {
  const subcommand = args[0] ?? 'help';
  if (options.help || subcommand === 'help') {
    print(CONFIG_HELP_TEXT);
    return 0;
  }
  if (subcommand === 'project-id') {
    return handleConfigProjectId(args.slice(1), options);
  }
  if (subcommand === 'info') {
    return handleConfigInfo(options);
  }
  throw new ToolCatalogError(`Unsupported Tool Catalog config command: ${subcommand}`, 2);
}

function handleDiscoverCommand(args, options) {
  const discoverOptions = parseDiscoverOptions(args, options);
  if (discoverOptions.help) {
    print(DISCOVER_HELP_TEXT);
    return 0;
  }
  const data = readJsonFile(discoverOptions.applyPath);
  const decisionFile = normalizeDecisionFile(data);
  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  const context = createProjectContext(discoverOptions, config);
  const summary = applyDiscoveryDecisionFile(context, decisionFile);
  printOutput(summary, discoverOptions, renderApplyMarkdown);
  return 0;
}

function createConsultContext(options) {
  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  return createProjectContext(options, config);
}

function handleTagsCommand(args, options) {
  const tagsOptions = parseTagsOptions(args, options);
  if (tagsOptions.help) {
    print(TAGS_HELP_TEXT);
    return 0;
  }
  const context = createConsultContext(tagsOptions);
  const state = consultIndexState(context);
  const output = buildTagsOutput(context, state);
  printOutput(output, tagsOptions, renderTagsMarkdown);
  return state.readable ? 0 : 1;
}

function handleQueryCommand(args, options) {
  const queryOptions = parseQueryOptions(args, options);
  if (queryOptions.help) {
    print(QUERY_HELP_TEXT);
    return 0;
  }
  const context = createConsultContext(queryOptions);
  const state = consultIndexState(context);
  const output = buildQueryOutput(context, state, queryOptions);
  printOutput(output, queryOptions, renderQueryMarkdown);
  return state.readable ? 0 : 1;
}

function handleShowCommand(args, options) {
  const showOptions = parseSelectorCommandOptions(args, options, 'show');
  if (showOptions.help) {
    print(SHOW_HELP_TEXT);
    return 0;
  }
  const context = createConsultContext(showOptions);
  const state = consultIndexState(context);
  const output = buildShowOutput(context, state, showOptions.selector);
  printOutput(output, showOptions, renderShowMarkdown);
  return state.readable && output.found ? 0 : 1;
}

function handleVerifyCommand(args, options) {
  const verifyOptions = parseSelectorCommandOptions(args, options, 'verify');
  if (verifyOptions.help) {
    print(VERIFY_HELP_TEXT);
    return 0;
  }
  const context = createConsultContext(verifyOptions);
  const state = consultIndexState(context);
  const output = buildVerifyOutput(context, state, verifyOptions.selector);
  printOutput(output, verifyOptions, renderVerifyMarkdown);
  return state.readable && output.ok ? 0 : 1;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArguments(argv);
  } catch (error) {
    if (error instanceof ToolCatalogError) {
      process.stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
  const { options, positional } = parsed;
  const command = positional[0] ?? (options.help ? 'help' : '--help');
  const commandArgs = positional.slice(1);
  if (command === '--help' || command === '-h' || command === 'help') {
    print(HELP_TEXT);
    return 0;
  }
  if (command === 'doctor' || command === 'check-runtime') {
    return checkRuntime() ? 0 : 1;
  }
  try {
    if (command === 'config') {
      return handleConfigCommand(commandArgs, options);
    }
    if (command === 'discover') {
      return handleDiscoverCommand(commandArgs, options);
    }
    if (command === 'tags') {
      return handleTagsCommand(commandArgs, options);
    }
    if (command === 'query') {
      return handleQueryCommand(commandArgs, options);
    }
    if (command === 'show') {
      return handleShowCommand(commandArgs, options);
    }
    if (command === 'verify') {
      return handleVerifyCommand(commandArgs, options);
    }
  } catch (error) {
    if (error instanceof ToolCatalogError) {
      process.stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
  process.stderr.write(`Unsupported Tool Catalog CLI command: ${command}\n`);
  return 2;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  process.exitCode = main(process.argv.slice(2));
}

export {
  acquireProjectApplyLock,
  createProjectContext,
  getCatalogHome,
  readUserConfig,
  runProjectApplyTransaction,
  runSqlite,
  sqlString,
  transactionSql,
};
