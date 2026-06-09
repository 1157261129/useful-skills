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

const HELP_TEXT = `Tool Catalog CLI

Usage:
  tool-catalog --help
  tool-catalog doctor
  tool-catalog config project-id <id> [--root <path>] [--json]
  tool-catalog config info [--root <path>] [--json]
  tool-catalog discover --full --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
  tool-catalog discover --changed <paths...> --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
  tool-catalog discover --apply <decisions.json> [--root <path>] [--json]
  tool-catalog tags [--root <path>] [--json]
  tool-catalog query --tag <tag> --goal <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog query --goal <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog show <selector> [--root <path>] [--json]
  tool-catalog verify <selector> [--root <path>] [--json]

Commands:
  help              Print this help text.
  doctor            Check runtime dependencies required by the Tool Catalog CLI.
  config            Manage user-level Tool Catalog configuration.
  discover          Harvest discovery Findings and evidence artifacts or apply reviewed decisions.
  tags              List canonical capability tags available in the project index.
  query             Search the existing project index for reusable entries.
  show              Show compact details for one indexed entry.
  verify            Verify indexed source anchors against the current working tree.

Environment:
  TOOL_CATALOG_HOME Override the default ~/.tool-catalog data root.

Consulting commands are read-only and never update discovery indexes.`;

const CONFIG_HELP_TEXT = `Tool Catalog config

Usage:
  tool-catalog config project-id <id> [--root <path>] [--json]
  tool-catalog config info [--root <path>] [--json]

Commands:
  project-id <id>   Store an explicit project identity mapping for a target root.
  info              Resolve and initialize the current project index foundation.

Options:
  --root <path>     Resolve the target project from this root instead of Git/cwd.
  --json            Print machine-readable JSON output.`;

const DISCOVER_HELP_TEXT = `Tool Catalog discover

Usage:
  tool-catalog discover --full --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
  tool-catalog discover --changed <paths...> --dry-run [--root <path>] [--language <name>] [--include <glob>] [--exclude <glob>] [--json]
  tool-catalog discover --apply <decisions.json> [--root <path>] [--json]

Modes:
  --full            Scan the resolved target project root.
  --changed <paths> Scan only the provided files or directories.
  --dry-run         Emit Finding evidence artifacts without mutating the project index.
  --apply <file>    Apply reviewed accept, ignore, and defer decisions to the project index.

Filters:
  --language <name> Limit scan to java, typescript, javascript, or vue. May be repeated or comma-separated.
  --include <glob>  Include only matching relative paths; may be repeated.
  --exclude <glob>  Exclude matching relative paths after include filtering; may be repeated.

Output:
  Default output is compact Markdown for agent review.
  --json prints dry-run Finding summaries and evidence artifact paths or apply summary data as structured JSON.`;

const QUERY_HELP_TEXT = `Tool Catalog query

Usage:
  tool-catalog query --tag <tag> --goal <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]
  tool-catalog query --goal <text> [--root <path>] [--current-file <path>] [--language <name>] [--framework <name>] [--artifact-type <type>] [--limit <n>] [--json]

Options:
  --goal <text>          Describe the coding goal to search for.
  --tag <tag>            Exact canonical Capability Tag filter. May be repeated or comma-separated; repeated tags use AND semantics.
  --current-file <path>  Relative or in-root file path used for weak module proximity ranking.
  --language <name>      Limit results to a language. May be repeated or comma-separated.
  --framework <name>     Limit results to a framework. May be repeated or comma-separated.
  --artifact-type <type> Limit results to an artifact/result type. May be repeated or comma-separated.
  --limit <n>            Maximum results to return. Defaults to 10, maximum 50.
  --json                 Print machine-readable JSON output.`;

const TAGS_HELP_TEXT = `Tool Catalog tags

Usage:
  tool-catalog tags [--root <path>] [--json]

The tags command is read-only. It lists canonical Capability Tags, concise descriptions, optional aliases, and indexed entry counts for the resolved project.`;

const SHOW_HELP_TEXT = `Tool Catalog show

Usage:
  tool-catalog show <selector> [--root <path>] [--json]

Selectors:
  artifact:<artifact_key>
  member:<member_key>
  template:<pattern_key>
  external:<usage_key>

Raw artifact, member, pattern, and usage identifiers are also accepted when unambiguous.`;

const VERIFY_HELP_TEXT = `Tool Catalog verify

Usage:
  tool-catalog verify <selector> [--root <path>] [--json]

Verification checks indexed relative source anchors against the current working tree using line hints, symbol identity, and stored snippets where available.`;

const MAX_SCAN_FILE_BYTES = 1024 * 1024;
const TEMPLATE_MIN_INSTANCES = 3;
const DEFAULT_QUERY_LIMIT = 10;
const MAX_QUERY_LIMIT = 50;
const VERIFY_LINE_WINDOW = 8;
const SUPPORTED_EXTENSIONS = new Map([
  ['.java', 'java'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.vue', 'vue'],
]);
const SUPPORTED_LANGUAGES = new Set(['java', 'typescript', 'javascript', 'vue']);
const DECISION_ACTIONS = new Set(['accept', 'ignore', 'defer', 'review']);
const CANDIDATE_GROUPS = [
  'utility_artifacts',
  'observed_external_usages',
  'template_patterns',
];
const CATALOG_COUNT_KEYS = [
  'utility_origins',
  'origin_priorities',
  'artifacts',
  'artifact_members',
  'member_signatures',
  'capability_tags',
  'entry_capability_tags',
  'template_patterns',
  'template_instances',
  'observed_external_usages',
  'ignored_candidates',
  'deferred_candidates',
  'fts_entries',
];
const MAX_SUMMARY_CHARS = 280;
const MAX_SNIPPET_CHARS = 500;
const CAPABILITY_TAG_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const MIN_CONSULT_SCHEMA_VERSION = 4;
const MIN_PRECLASS_SCHEMA_VERSION = 5;
const CAPABILITY_TAG_VOCABULARY = new Map([
  ['api-client', {
    description: 'Reusable API client request helpers and request-flow templates.',
    aliases: ['api', 'client-request'],
  }],
  ['http', {
    description: 'HTTP request helpers and transport-facing utility code.',
    aliases: ['network', 'rest'],
  }],
  ['request', {
    description: 'Request construction, dispatch, and reusable request patterns.',
    aliases: ['call', 'fetch'],
  }],
  ['string', {
    description: 'String normalization, inspection, and text-manipulation helpers.',
    aliases: ['strings', 'text'],
  }],
  ['utility', {
    description: 'General-purpose reusable helpers when no narrower tag fits.',
    aliases: ['helper', 'helpers'],
  }],
]);
const DEFAULT_EXCLUDED_DIRS = new Set([
  '.cache',
  '.git',
  '.gradle',
  '.idea',
  '.next',
  '.nuxt',
  '.output',
  '.svn',
  '.turbo',
  '.vite',
  '.vscode',
  'bower_components',
  'build',
  'coverage',
  'dist',
  'generated',
  'generated-sources',
  'generated-test-sources',
  'node_modules',
  'out',
  'target',
  'vendor',
]);
const DEFAULT_EXCLUDED_BASENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);
const DEFAULT_EXCLUDED_SUFFIXES = [
  '.map',
  '.min.css',
  '.min.js',
  '.min.mjs',
  '.min.cjs',
];
const UTILITY_PATH_SEGMENTS = new Set([
  'common',
  'commons',
  'composable',
  'composables',
  'helper',
  'helpers',
  'lib',
  'shared',
  'support',
  'toolkit',
  'util',
  'utils',
]);
const JAVA_BUSINESS_ROLE_TERMS = [
  'controller',
  'service',
  'mapper',
  'repository',
  'entity',
  'domain',
  'model',
  'dto',
  'vo',
  'bo',
  'request',
  'response',
  'config',
  'properties',
  'exception',
  'listener',
  'job',
  'scheduler',
  'task',
];
const JAVA_BUSINESS_ANNOTATIONS = [
  '@Controller',
  '@RestController',
  '@Service',
  '@Repository',
  '@Mapper',
  '@Entity',
  '@Configuration',
  '@SpringBootApplication',
];
const JAVA_EXTERNAL_UTILITY_PREFIXES = [
  'cn.hutool.',
  'com.google.common.',
  'org.apache.commons.',
  'org.springframework.beans.BeanUtils',
  'org.springframework.util.',
  'java.util.Collections',
  'java.util.Objects',
  'java.nio.file.Files',
];
const JS_EXTERNAL_UTILITY_PACKAGES = new Set([
  '@vueuse/core',
  'classnames',
  'clsx',
  'date-fns',
  'dayjs',
  'lodash',
  'lodash-es',
  'nanoid',
  'qs',
  'ramda',
  'underscore',
  'uuid',
]);

class ToolCatalogError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'ToolCatalogError';
    this.exitCode = exitCode;
  }
}

function printHelp() {
  process.stdout.write(`${HELP_TEXT}\n`);
}

function printConfigHelp() {
  process.stdout.write(`${CONFIG_HELP_TEXT}\n`);
}

function printDiscoverHelp() {
  process.stdout.write(`${DISCOVER_HELP_TEXT}\n`);
}

function printQueryHelp() {
  process.stdout.write(`${QUERY_HELP_TEXT}\n`);
}

function printTagsHelp() {
  process.stdout.write(`${TAGS_HELP_TEXT}\n`);
}

function printShowHelp() {
  process.stdout.write(`${SHOW_HELP_TEXT}\n`);
}

function printVerifyHelp() {
  process.stdout.write(`${VERIFY_HELP_TEXT}\n`);
}

function parseMajorVersion(version) {
  const major = Number.parseInt(String(version).split('.')[0], 10);
  return Number.isNaN(major) ? 0 : major;
}

function checkNode() {
  const major = parseMajorVersion(process.versions.node);
  if (major < MIN_NODE_MAJOR) {
    return {
      ok: false,
      message: `node ${process.versions.node} is too old; Node.js ${MIN_NODE_MAJOR} or newer is required.`,
    };
  }

  return {
    ok: true,
    message: `node ${process.versions.node}`,
  };
}

function checkSqlite3() {
  const result = spawnSync('sqlite3', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error?.code === 'ENOENT') {
    return {
      ok: false,
      message: "missing required runtime dependency 'sqlite3'. Install the system sqlite3 CLI and retry.",
    };
  }

  if (result.error) {
    return {
      ok: false,
      message: `unable to execute sqlite3: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    return {
      ok: false,
      message: detail ? `sqlite3 exited with status ${result.status}: ${detail}` : `sqlite3 exited with status ${result.status}.`,
    };
  }

  return {
    ok: true,
    message: `sqlite3 ${(result.stdout || '').trim()}`,
  };
}

function assertSqlite3Available() {
  const check = checkSqlite3();
  if (!check.ok) {
    throw new ToolCatalogError(`Tool Catalog CLI environment error: ${check.message}`);
  }
}

function checkRuntime() {
  const checks = [checkNode(), checkSqlite3()];
  const failures = checks.filter((check) => !check.ok);

  if (failures.length > 0) {
    process.stderr.write('Tool Catalog CLI environment error:\n');
    for (const failure of failures) {
      process.stderr.write(`- ${failure.message}\n`);
    }
    return false;
  }

  process.stdout.write('Tool Catalog CLI runtime dependencies are available:\n');
  for (const check of checks) {
    process.stdout.write(`- ${check.message}\n`);
  }
  return true;
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
      const root = argv[index + 1];
      if (!root) {
        throw new ToolCatalogError('Missing value for --root.', 2);
      }
      options.root = root;
      index += 1;
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
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ToolCatalogError(`Missing value for ${optionName}.`, 2);
  }

  return value;
}

function appendCommaSeparated(target, value) {
  for (const item of value.split(',')) {
    const trimmed = item.trim();
    if (trimmed) {
      target.push(trimmed);
    }
  }
}

function parseDiscoverOptions(args, globalOptions) {
  const discoverOptions = {
    ...globalOptions,
    dryRun: false,
    applyPath: undefined,
    mode: undefined,
    changedPaths: [],
    languages: [],
    includeFilters: [],
    excludeFilters: [],
  };
  let collectingChangedPaths = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      discoverOptions.help = true;
      continue;
    }
    if (argument === '--dry-run') {
      discoverOptions.dryRun = true;
      continue;
    }
    if (argument === '--apply') {
      discoverOptions.applyPath = parseRepeatedValue(args, index, '--apply');
      collectingChangedPaths = false;
      index += 1;
      continue;
    }
    if (argument.startsWith('--apply=')) {
      discoverOptions.applyPath = argument.slice('--apply='.length);
      collectingChangedPaths = false;
      continue;
    }
    if (argument === '--full') {
      if (discoverOptions.mode && discoverOptions.mode !== 'full') {
        throw new ToolCatalogError('Use either --full or --changed, not both.', 2);
      }
      discoverOptions.mode = 'full';
      collectingChangedPaths = false;
      continue;
    }
    if (argument === '--changed') {
      if (discoverOptions.mode && discoverOptions.mode !== 'changed') {
        throw new ToolCatalogError('Use either --full or --changed, not both.', 2);
      }
      discoverOptions.mode = 'changed';
      collectingChangedPaths = true;
      continue;
    }
    if (argument === '--language') {
      appendCommaSeparated(discoverOptions.languages, parseRepeatedValue(args, index, '--language'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--language=')) {
      appendCommaSeparated(discoverOptions.languages, argument.slice('--language='.length));
      continue;
    }
    if (argument === '--include') {
      discoverOptions.includeFilters.push(parseRepeatedValue(args, index, '--include'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--include=')) {
      discoverOptions.includeFilters.push(argument.slice('--include='.length));
      continue;
    }
    if (argument === '--exclude') {
      discoverOptions.excludeFilters.push(parseRepeatedValue(args, index, '--exclude'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--exclude=')) {
      discoverOptions.excludeFilters.push(argument.slice('--exclude='.length));
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported discover option: ${argument}`, 2);
    }
    if (!collectingChangedPaths) {
      throw new ToolCatalogError(`Unexpected discover argument: ${argument}`, 2);
    }
    discoverOptions.changedPaths.push(argument);
  }

  if (discoverOptions.help) {
    return discoverOptions;
  }
  if (discoverOptions.applyPath) {
    if (!discoverOptions.applyPath.trim()) {
      throw new ToolCatalogError('Missing value for --apply.', 2);
    }
    if (discoverOptions.dryRun) {
      throw new ToolCatalogError('Use either --dry-run or --apply, not both.', 2);
    }
    if (discoverOptions.mode) {
      throw new ToolCatalogError('Do not pass --full or --changed with --apply; cleanup scope comes from the decisions file.', 2);
    }
    if (discoverOptions.languages.length > 0 || discoverOptions.includeFilters.length > 0 || discoverOptions.excludeFilters.length > 0) {
      throw new ToolCatalogError('Do not pass discovery scan filters with --apply; apply uses the reviewed decisions file.', 2);
    }

    return discoverOptions;
  }
  if (!discoverOptions.mode) {
    throw new ToolCatalogError('Discover requires either --full or --changed.', 2);
  }
  if (!discoverOptions.dryRun) {
    throw new ToolCatalogError('This version of discover only supports --dry-run. Apply mode is added by a later issue.', 2);
  }
  if (discoverOptions.mode === 'changed' && discoverOptions.changedPaths.length === 0) {
    throw new ToolCatalogError('Discover --changed requires at least one file or directory path.', 2);
  }

  discoverOptions.languages = [...new Set(discoverOptions.languages.map((language) => language.toLowerCase()))];
  for (const language of discoverOptions.languages) {
    if (!SUPPORTED_LANGUAGES.has(language)) {
      throw new ToolCatalogError(`Unsupported discovery language '${language}'. Use java, typescript, javascript, or vue.`, 2);
    }
  }

  return discoverOptions;
}

function parsePositiveIntegerOption(value, optionName, maximum) {
  const integer = Number.parseInt(value, 10);
  if (!Number.isFinite(integer) || integer < 1) {
    throw new ToolCatalogError(`${optionName} must be a positive integer.`, 2);
  }
  if (integer > maximum) {
    throw new ToolCatalogError(`${optionName} must be ${maximum} or less.`, 2);
  }

  return integer;
}

function normalizeCapabilityTagFilter(value, fieldName = 'Capability Tag') {
  const normalized = normalizeNullableString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    throw new ToolCatalogError(`${fieldName} must not be empty.`, 2);
  }
  if (!CAPABILITY_TAG_PATTERN.test(normalized)) {
    throw new ToolCatalogError(`${fieldName} '${value}' is invalid. Use lowercase letters, numbers, underscore, or dash.`, 2);
  }
  return normalized;
}

function parseTagsOptions(args, globalOptions) {
  const tagsOptions = {
    ...globalOptions,
  };

  for (const argument of args) {
    if (argument === '--help' || argument === '-h') {
      tagsOptions.help = true;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported tags option: ${argument}`, 2);
    }
    throw new ToolCatalogError(`Unexpected tags argument: ${argument}`, 2);
  }

  return tagsOptions;
}

function parseQueryOptions(args, globalOptions) {
  const queryOptions = {
    ...globalOptions,
    goal: undefined,
    tags: [],
    currentFile: undefined,
    languages: [],
    frameworks: [],
    artifactTypes: [],
    limit: DEFAULT_QUERY_LIMIT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      queryOptions.help = true;
      continue;
    }
    if (argument === '--goal') {
      queryOptions.goal = parseRepeatedValue(args, index, '--goal');
      index += 1;
      continue;
    }
    if (argument.startsWith('--goal=')) {
      queryOptions.goal = argument.slice('--goal='.length);
      continue;
    }
    if (argument === '--tag') {
      appendCommaSeparated(queryOptions.tags, parseRepeatedValue(args, index, '--tag'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--tag=')) {
      appendCommaSeparated(queryOptions.tags, argument.slice('--tag='.length));
      continue;
    }
    if (argument === '--current-file') {
      queryOptions.currentFile = parseRepeatedValue(args, index, '--current-file');
      index += 1;
      continue;
    }
    if (argument.startsWith('--current-file=')) {
      queryOptions.currentFile = argument.slice('--current-file='.length);
      continue;
    }
    if (argument === '--language') {
      appendCommaSeparated(queryOptions.languages, parseRepeatedValue(args, index, '--language'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--language=')) {
      appendCommaSeparated(queryOptions.languages, argument.slice('--language='.length));
      continue;
    }
    if (argument === '--framework') {
      appendCommaSeparated(queryOptions.frameworks, parseRepeatedValue(args, index, '--framework'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--framework=')) {
      appendCommaSeparated(queryOptions.frameworks, argument.slice('--framework='.length));
      continue;
    }
    if (argument === '--artifact-type') {
      appendCommaSeparated(queryOptions.artifactTypes, parseRepeatedValue(args, index, '--artifact-type'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--artifact-type=')) {
      appendCommaSeparated(queryOptions.artifactTypes, argument.slice('--artifact-type='.length));
      continue;
    }
    if (argument === '--limit') {
      queryOptions.limit = parsePositiveIntegerOption(parseRepeatedValue(args, index, '--limit'), '--limit', MAX_QUERY_LIMIT);
      index += 1;
      continue;
    }
    if (argument.startsWith('--limit=')) {
      queryOptions.limit = parsePositiveIntegerOption(argument.slice('--limit='.length), '--limit', MAX_QUERY_LIMIT);
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported query option: ${argument}`, 2);
    }
    throw new ToolCatalogError(`Unexpected query argument: ${argument}`, 2);
  }

  if (queryOptions.help) {
    return queryOptions;
  }
  queryOptions.goal = normalizeNullableString(queryOptions.goal);
  if (!queryOptions.goal) {
    throw new ToolCatalogError('Query requires --goal <text>.', 2);
  }

  queryOptions.languages = [...new Set(queryOptions.languages.map((item) => item.toLowerCase()))];
  queryOptions.frameworks = [...new Set(queryOptions.frameworks.map((item) => item.toLowerCase()))];
  queryOptions.artifactTypes = [...new Set(queryOptions.artifactTypes.map((item) => item.toLowerCase()))];
  queryOptions.tags = [...new Set(queryOptions.tags.map((item) => normalizeCapabilityTagFilter(item, '--tag')))];

  return queryOptions;
}

function parseSelectorCommandOptions(args, globalOptions, commandName) {
  const selectorOptions = {
    ...globalOptions,
    selector: undefined,
  };

  for (const argument of args) {
    if (argument === '--help' || argument === '-h') {
      selectorOptions.help = true;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new ToolCatalogError(`Unsupported ${commandName} option: ${argument}`, 2);
    }
    if (selectorOptions.selector) {
      throw new ToolCatalogError(`${commandName} accepts exactly one selector.`, 2);
    }
    selectorOptions.selector = argument;
  }

  if (selectorOptions.help) {
    return selectorOptions;
  }
  selectorOptions.selector = normalizeNullableString(selectorOptions.selector);
  if (!selectorOptions.selector) {
    throw new ToolCatalogError(`${commandName} requires a selector.`, 2);
  }

  return selectorOptions;
}

function expandHome(input) {
  if (input === '~') {
    return os.homedir();
  }
  if (input.startsWith(`~${path.sep}`) || input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function normalizePath(input) {
  const resolved = path.resolve(expandHome(input));
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return path.normalize(resolved);
  }
}

function getCatalogHome() {
  const override = process.env.TOOL_CATALOG_HOME?.trim();
  const root = override ? expandHome(override) : path.join(os.homedir(), DEFAULT_CATALOG_DIR);
  return path.resolve(root);
}

function getConfigPath(catalogHome) {
  return path.join(catalogHome, CONFIG_FILE_NAME);
}

function defaultConfig() {
  return {
    version: 1,
    project_mappings: {},
  };
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return defaultConfig();
  }

  const normalized = {
    ...config,
    version: 1,
  };

  if (!normalized.project_mappings || typeof normalized.project_mappings !== 'object' || Array.isArray(normalized.project_mappings)) {
    normalized.project_mappings = {};
  }

  return normalized;
}

function readUserConfig(catalogHome) {
  const configPath = getConfigPath(catalogHome);
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }

  try {
    const contents = fs.readFileSync(configPath, 'utf8');
    return normalizeConfig(JSON.parse(contents));
  } catch (error) {
    throw new ToolCatalogError(`Unable to read Tool Catalog config ${configPath}: ${error.message}`);
  }
}

function writeUserConfig(catalogHome, config) {
  fs.mkdirSync(catalogHome, { recursive: true });
  const configPath = getConfigPath(catalogHome);
  const tempPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(tempPath, configPath);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const output = (result.stdout || '').trim();
  return output || null;
}

function resolveTargetRoot(options) {
  if (options.root) {
    return normalizePath(options.root);
  }

  const gitRoot = runCommand('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
  });
  return normalizePath(gitRoot || process.cwd());
}

function resolveGitCommonDir(rootPath) {
  const commonDir = runCommand('git', ['-C', rootPath, 'rev-parse', '--git-common-dir']);
  if (!commonDir) {
    return null;
  }

  const absolutePath = path.isAbsolute(commonDir) ? commonDir : path.resolve(rootPath, commonDir);
  return normalizePath(absolutePath);
}

function resolveRemoteUrl(rootPath) {
  const remote = runCommand('git', ['-C', rootPath, 'config', '--get', 'remote.origin.url']);
  return remote ? normalizeRemoteUrl(remote) : null;
}

function normalizeRemoteUrl(remote) {
  const value = remote.trim();
  const scpMatch = value.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
  const urlLike = value.includes('://') ? value : null;
  const normalizedInput = urlLike || (scpMatch ? `ssh://${scpMatch[1]}/${scpMatch[2]}` : value);

  try {
    const url = new URL(normalizedInput);
    const host = url.hostname.toLowerCase();
    const port = url.port ? `:${url.port}` : '';
    const remotePath = normalizeRemotePath(url.pathname);
    return remotePath ? `${host}${port}/${remotePath}` : `${host}${port}`;
  } catch {
    return normalizeRemotePath(value.replace(/\\/g, '/'));
  }
}

function normalizeRemotePath(remotePath) {
  return remotePath
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+/g, '/');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeSlug(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'project';
}

function deriveProjectId(signal) {
  const prefix = signal.source === 'project-root' ? 'path' : signal.source.replace(/-+/g, '-');
  const nameSource = signal.source === 'remote-url' ? signal.key.split('/').at(-1) : path.basename(signal.key);
  return `${prefix}-${safeSlug(nameSource)}-${sha256(signal.key).slice(0, 12)}`;
}

function buildIdentitySignals(rootPath) {
  const signals = [];
  const commonDir = resolveGitCommonDir(rootPath);
  const remoteUrl = resolveRemoteUrl(rootPath);

  if (commonDir) {
    signals.push({
      source: 'git-common-dir',
      key: commonDir,
      projectId: deriveProjectId({ source: 'git-common-dir', key: commonDir }),
    });
  }

  if (remoteUrl) {
    signals.push({
      source: 'remote-url',
      key: remoteUrl,
      projectId: deriveProjectId({ source: 'remote-url', key: remoteUrl }),
    });
  }

  signals.push({
    source: 'project-root',
    key: rootPath,
    projectId: deriveProjectId({ source: 'project-root', key: rootPath }),
  });

  return signals;
}

function mappingKey(signal) {
  return `${signal.source}:${signal.key}`;
}

function getExplicitProjectId(config, signals) {
  for (const signal of signals) {
    const mapping = config.project_mappings[mappingKey(signal)];
    if (mapping?.project_id && isValidProjectId(mapping.project_id)) {
      return {
        projectId: mapping.project_id,
        identitySource: 'explicit-project-id',
        identityKey: mappingKey(signal),
        matchedSignal: signal.source,
      };
    }
  }

  return null;
}

function resolveProjectIdentity(config, signals) {
  const explicit = getExplicitProjectId(config, signals);
  if (explicit) {
    return explicit;
  }

  const signal = signals[0];
  return {
    projectId: signal.projectId,
    identitySource: signal.source,
    identityKey: signal.key,
    matchedSignal: signal.source,
  };
}

function isValidProjectId(projectId) {
  return PROJECT_ID_PATTERN.test(projectId) && projectId !== '.' && projectId !== '..';
}

function assertValidProjectId(projectId) {
  if (isValidProjectId(projectId)) {
    return;
  }

  throw new ToolCatalogError('Invalid project id. Use 1-128 characters from A-Z, a-z, 0-9, dot, underscore, or dash, and do not use path separators.', 2);
}

function setExplicitProjectId(config, rootPath, signals, projectId) {
  const nextConfig = normalizeConfig(JSON.parse(JSON.stringify(config)));
  const updatedAt = new Date().toISOString();

  for (const signal of signals) {
    nextConfig.project_mappings[mappingKey(signal)] = {
      project_id: projectId,
      root_path: rootPath,
      signal_source: signal.source,
      signal_key: signal.key,
      updated_at: updatedAt,
    };
  }

  return nextConfig;
}

function getProjectPaths(catalogHome, projectId) {
  const projectDir = path.join(catalogHome, 'projects', projectId);
  return {
    projectDir,
    dbPath: path.join(projectDir, 'catalog.sqlite'),
    lockPath: path.join(projectDir, 'apply.lock'),
  };
}

function createProjectContext(options, config) {
  const catalogHome = getCatalogHome();
  const rootPath = resolveTargetRoot(options);
  const signals = buildIdentitySignals(rootPath);
  const identity = resolveProjectIdentity(config, signals);
  const paths = getProjectPaths(catalogHome, identity.projectId);

  return {
    ...identity,
    catalogHome,
    configPath: getConfigPath(catalogHome),
    rootPath,
    signals,
    ...paths,
  };
}

function loadMigrations() {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(cliDir, '..', 'migrations');
  const names = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+-[A-Za-z0-9._-]+\.sql$/.test(name))
    .sort();

  if (names.length === 0) {
    throw new ToolCatalogError(`No Tool Catalog migrations found under ${migrationsDir}.`);
  }

  return names.map((name) => {
    const version = Number.parseInt(name.split('-')[0], 10);
    return {
      version,
      name,
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    };
  });
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

  if (result.error?.code === 'ENOENT') {
    throw new ToolCatalogError("Tool Catalog CLI environment error: missing required runtime dependency 'sqlite3'. Install the system sqlite3 CLI and retry.");
  }
  if (result.error) {
    throw new ToolCatalogError(`Unable to execute sqlite3: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new ToolCatalogError(detail ? `sqlite3 failed for ${dbPath}: ${detail}` : `sqlite3 failed for ${dbPath}.`);
  }

  return result.stdout || '';
}

function runSqliteJson(dbPath, sql) {
  const output = runSqlite(dbPath, sql, { json: true }).trim();
  if (!output) {
    return [];
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new ToolCatalogError(`Unable to parse sqlite3 JSON output: ${error.message}`);
  }
}

function runSqliteReadOnlyJson(dbPath, sql) {
  const output = runSqlite(dbPath, sql, { json: true, readOnly: true }).trim();
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
  if (!Number.isFinite(integer)) {
    return 'NULL';
  }
  return String(integer);
}

function sqlStringList(values) {
  const uniqueValues = [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))];
  if (uniqueValues.length === 0) {
    return null;
  }

  return uniqueValues.map((value) => sqlString(value)).join(', ');
}

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function truncateText(value, maxLength) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function normalizeRequiredText(value, fieldName, maxLength = MAX_SUMMARY_CHARS) {
  const normalized = truncateText(value, maxLength);
  if (!normalized) {
    throw new ToolCatalogError(`${fieldName} is required.`, 2);
  }

  return normalized;
}

function normalizeCapabilityTags(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolCatalogError(`${fieldName} must include at least one Capability Tag.`, 2);
  }

  const byTag = new Map();
  for (const item of value) {
    const rawTag = isPlainObject(item) ? item.tag : item;
    const tag = normalizeNullableString(rawTag)?.toLowerCase() ?? null;
    if (!tag) {
      throw new ToolCatalogError(`${fieldName} entries must include a tag value.`, 2);
    }
    if (!CAPABILITY_TAG_PATTERN.test(tag)) {
      throw new ToolCatalogError(`${fieldName} contains invalid tag '${rawTag}'. Use lowercase letters, numbers, underscore, or dash.`, 2);
    }

    const description = isPlainObject(item) ? truncateText(item.description, MAX_SUMMARY_CHARS) : null;
    byTag.set(tag, {
      tag,
      description: description ?? byTag.get(tag)?.description ?? null,
    });
  }

  return [...byTag.values()];
}

function transactionSql(sql) {
  return `PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
${sql.trim().replace(/;?\s*$/, ';')}
COMMIT;
`;
}

function getSchemaVersion(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return 0;
  }

  const metadataTables = runSqliteJson(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata';");
  if (metadataTables.length === 0) {
    return 0;
  }

  const rows = runSqliteJson(dbPath, "SELECT value FROM metadata WHERE key = 'schema_version';");
  const version = Number.parseInt(rows[0]?.value ?? '0', 10);
  return Number.isNaN(version) ? 0 : version;
}

function applyMigrations(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const migrations = loadMigrations();
  const currentVersion = getSchemaVersion(dbPath);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    runSqlite(dbPath, migration.sql);
  }
}

function upsertProjectRecord(context) {
  const sql = `
INSERT INTO projects (
  id,
  root_path,
  identity_source,
  identity_key,
  catalog_home,
  updated_at
) VALUES (
  ${sqlString(context.projectId)},
  ${sqlString(context.rootPath)},
  ${sqlString(context.identitySource)},
  ${sqlString(context.identityKey)},
  ${sqlString(context.catalogHome)},
  datetime('now')
) ON CONFLICT(id) DO UPDATE SET
  root_path = excluded.root_path,
  identity_source = excluded.identity_source,
  identity_key = excluded.identity_key,
  catalog_home = excluded.catalog_home,
  updated_at = datetime('now');
`;
  runSqlite(context.dbPath, transactionSql(sql));
}

function ensureProjectIndex(context) {
  applyMigrations(context.dbPath);
  upsertProjectRecord(context);
}

function acquireProjectApplyLock(context) {
  fs.mkdirSync(context.projectDir, { recursive: true });

  let fileDescriptor;
  try {
    fileDescriptor = fs.openSync(context.lockPath, 'wx', 0o600);
    fs.writeFileSync(fileDescriptor, JSON.stringify({
      pid: process.pid,
      project_id: context.projectId,
      created_at: new Date().toISOString(),
    }, null, 2));
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new ToolCatalogError(`Another discovery apply operation is already running for project ${context.projectId}.`);
    }
    throw error;
  }

  return {
    release() {
      if (fileDescriptor !== undefined) {
        fs.closeSync(fileDescriptor);
        fileDescriptor = undefined;
      }
      try {
        fs.unlinkSync(context.lockPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

function withProjectApplyLock(context, callback) {
  const lock = acquireProjectApplyLock(context);
  try {
    return callback();
  } finally {
    lock.release();
  }
}

function runProjectApplyTransaction(context, sql) {
  return withProjectApplyLock(context, () => runSqlite(context.dbPath, transactionSql(sql)));
}

function projectContextToOutput(context) {
  return {
    project_id: context.projectId,
    identity_source: context.identitySource,
    identity_key: context.identityKey,
    matched_signal: context.matchedSignal,
    root_path: context.rootPath,
    catalog_home: context.catalogHome,
    catalog_path: context.dbPath,
    config_path: context.configPath,
    apply_lock_path: context.lockPath,
  };
}

function printProjectContext(context, options, leadLine) {
  const output = projectContextToOutput(context);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  if (leadLine) {
    process.stdout.write(`${leadLine}\n`);
  }

  process.stdout.write(`Project identity:
- project_id: ${output.project_id}
- identity_source: ${output.identity_source}
- identity_key: ${output.identity_key}
- root_path: ${output.root_path}
- catalog_home: ${output.catalog_home}
- catalog_path: ${output.catalog_path}
`);
}

function toPosixPath(input) {
  return input.replace(/\\/g, '/');
}

function normalizeRelativePath(input) {
  return toPosixPath(input).replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function getRelativePath(rootPath, absolutePath) {
  return normalizeRelativePath(path.relative(rootPath, absolutePath));
}

function getPathSegments(relativePath) {
  return normalizeRelativePath(relativePath).split('/').filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
  const normalized = normalizeRelativePath(pattern);
  let source = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];
    if (character === '*' && nextCharacter === '*') {
      source += '.*';
      index += 1;
      continue;
    }
    if (character === '*') {
      source += '[^/]*';
      continue;
    }
    if (character === '?') {
      source += '[^/]';
      continue;
    }
    source += escapeRegExp(character);
  }

  return new RegExp(`^${source}$`);
}

function matchesPathPattern(relativePath, pattern) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedPattern = normalizeRelativePath(pattern);
  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.endsWith('/')) {
    const directoryPattern = normalizedPattern.replace(/\/+$/, '');
    return normalizedPath === directoryPattern || normalizedPath.startsWith(`${directoryPattern}/`);
  }

  if (!normalizedPattern.includes('/')) {
    const basename = path.posix.basename(normalizedPath);
    return globToRegExp(normalizedPattern).test(basename);
  }

  return globToRegExp(normalizedPattern).test(normalizedPath);
}

function matchesAnyPathPattern(relativePath, patterns) {
  return patterns.some((pattern) => matchesPathPattern(relativePath, pattern));
}

function parseGitignore(rootPath) {
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  return fs.readFileSync(gitignorePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
}

function isIgnoredByGitignore(relativePath, gitignorePatterns) {
  return matchesAnyPathPattern(relativePath, gitignorePatterns);
}

function hasDefaultExcludedPath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const basename = path.posix.basename(normalizedPath);
  const lowerBasename = basename.toLowerCase();
  const segments = getPathSegments(normalizedPath).map((segment) => segment.toLowerCase());

  if (segments.some((segment) => DEFAULT_EXCLUDED_DIRS.has(segment))) {
    return true;
  }
  if (DEFAULT_EXCLUDED_BASENAMES.has(lowerBasename)) {
    return true;
  }
  if (DEFAULT_EXCLUDED_SUFFIXES.some((suffix) => lowerBasename.endsWith(suffix))) {
    return true;
  }
  if (lowerBasename.includes('.generated.') || lowerBasename.includes('.gen.') || lowerBasename.includes('.pb.')) {
    return true;
  }

  return false;
}

function detectLanguage(relativePath) {
  return SUPPORTED_EXTENSIONS.get(path.extname(relativePath).toLowerCase()) ?? null;
}

function isInsideRoot(rootPath, absolutePath) {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function listGitProjectFiles(rootPath) {
  const result = spawnSync('git', ['-C', rootPath, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return (result.stdout || '')
    .split('\0')
    .map((item) => normalizeRelativePath(item))
    .filter(Boolean);
}

function walkProjectFiles(rootPath, currentPath, gitignorePatterns, files) {
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = getRelativePath(rootPath, absolutePath);
    if (isIgnoredByGitignore(relativePath, gitignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (hasDefaultExcludedPath(relativePath)) {
        continue;
      }
      walkProjectFiles(rootPath, absolutePath, gitignorePatterns, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

function listProjectFiles(rootPath) {
  const gitFiles = listGitProjectFiles(rootPath);
  if (gitFiles) {
    return {
      files: gitFiles,
      source: 'git-ls-files-exclude-standard',
    };
  }

  const files = [];
  walkProjectFiles(rootPath, rootPath, parseGitignore(rootPath), files);
  return {
    files,
    source: 'filesystem-walk-with-root-gitignore',
  };
}

function resolveChangedScopes(rootPath, changedPaths) {
  return changedPaths.map((inputPath) => {
    const absolutePath = path.resolve(rootPath, expandHome(inputPath));
    if (!isInsideRoot(rootPath, absolutePath)) {
      throw new ToolCatalogError(`Changed path is outside the target project root: ${inputPath}`, 2);
    }

    const relativePath = getRelativePath(rootPath, absolutePath);
    return {
      input: inputPath,
      relativePath,
      absolutePath,
      exists: fs.existsSync(absolutePath),
      isDirectory: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory(),
    };
  });
}

function isInChangedScopes(relativePath, changedScopes) {
  return changedScopes.some((scope) => {
    if (!scope.exists) {
      return false;
    }
    if (scope.isDirectory) {
      return relativePath === scope.relativePath || relativePath.startsWith(`${scope.relativePath}/`);
    }
    return relativePath === scope.relativePath;
  });
}

function shouldScanFile(relativePath, discoverOptions) {
  const language = detectLanguage(relativePath);
  const explicitInclude = discoverOptions.includeFilters.length > 0
    && matchesAnyPathPattern(relativePath, discoverOptions.includeFilters);

  if (!language) {
    return { scan: false, reason: 'unsupported-extension' };
  }
  if (discoverOptions.languages.length > 0 && !discoverOptions.languages.includes(language)) {
    return { scan: false, reason: 'language-filter' };
  }
  if (hasDefaultExcludedPath(relativePath) && !explicitInclude) {
    return { scan: false, reason: 'default-exclusion' };
  }
  if (discoverOptions.includeFilters.length > 0 && !explicitInclude) {
    return { scan: false, reason: 'include-filter' };
  }
  if (matchesAnyPathPattern(relativePath, discoverOptions.excludeFilters)) {
    return { scan: false, reason: 'exclude-filter' };
  }

  return { scan: true, language };
}

function buildScanScope(rootPath, discoverOptions) {
  const listed = listProjectFiles(rootPath);
  const changedScopes = discoverOptions.mode === 'changed'
    ? resolveChangedScopes(rootPath, discoverOptions.changedPaths)
    : [];
  const files = [];
  const skippedByReason = {};
  let scopedFiles = listed.files;

  if (discoverOptions.mode === 'changed') {
    scopedFiles = listed.files.filter((relativePath) => isInChangedScopes(relativePath, changedScopes));
  }

  for (const relativePath of scopedFiles) {
    const decision = shouldScanFile(relativePath, discoverOptions);
    if (!decision.scan) {
      skippedByReason[decision.reason] = (skippedByReason[decision.reason] ?? 0) + 1;
      continue;
    }

    const absolutePath = path.join(rootPath, relativePath);
    let size = 0;
    try {
      size = fs.statSync(absolutePath).size;
    } catch {
      skippedByReason['missing-file'] = (skippedByReason['missing-file'] ?? 0) + 1;
      continue;
    }
    if (size > MAX_SCAN_FILE_BYTES) {
      skippedByReason['file-too-large'] = (skippedByReason['file-too-large'] ?? 0) + 1;
      continue;
    }

    files.push({
      absolutePath,
      relativePath,
      language: decision.language,
      size,
    });
  }

  for (const scope of changedScopes) {
    if (!scope.exists) {
      skippedByReason['changed-path-missing'] = (skippedByReason['changed-path-missing'] ?? 0) + 1;
    }
  }

  return {
    source: listed.source,
    files,
    filesConsidered: listed.files.length,
    scopedFiles: scopedFiles.length,
    skippedByReason,
    changedScopes,
  };
}

function readScanFiles(scanFiles) {
  return scanFiles.map((file) => {
    const text = fs.readFileSync(file.absolutePath, 'utf8');
    return {
      ...file,
      text,
      lines: text.split(/\r?\n/),
    };
  });
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function makeSourceAnchor(relativePath, line, symbol) {
  return {
    path: relativePath,
    line,
    symbol,
    text: `${relativePath}:${line}${symbol ? `#${symbol}` : ''}`,
  };
}

function uniqueByKey(items, keySelector) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keySelector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function getModulePath(relativePath) {
  const segments = getPathSegments(relativePath);
  const srcIndex = segments.indexOf('src');
  if (srcIndex > 0) {
    return segments.slice(0, srcIndex).join('/') || null;
  }
  if (segments.includes('pom.xml')) {
    return segments.slice(0, -1).join('/') || null;
  }
  return segments.length > 1 ? segments[0] : null;
}

function getJavaPackage(text) {
  return text.match(/^\s*package\s+([A-Za-z_][\w.]*);/m)?.[1] ?? null;
}

function getJavaClass(text) {
  const match = text.match(/^\s*(?:public\s+)?(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)\b/m);
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    line: lineNumberForIndex(text, match.index ?? 0),
  };
}

function hasJavaBusinessRole(record, className) {
  const lowerPath = record.relativePath.toLowerCase();
  const lowerClassName = className.toLowerCase();
  if (JAVA_BUSINESS_ROLE_TERMS.some((term) => lowerPath.includes(`/${term}/`) || lowerClassName.endsWith(term))) {
    return true;
  }
  if (JAVA_BUSINESS_ANNOTATIONS.some((annotation) => record.text.includes(annotation))) {
    return true;
  }

  return false;
}

function extractJavaStaticMethods(record, qualifiedName) {
  const methods = [];
  const methodPattern = /^\s*public\s+static\s+(?:final\s+)?(?:<[^>]+>\s+)?([A-Za-z_$][\w$<>\[\], ?.&]+)\s+([A-Za-z_$][\w$]*)\s*\(([^;{}]*)\)\s*(?:throws\s+[^{;]+)?[{;]/;

  record.lines.forEach((line, index) => {
    const match = line.match(methodPattern);
    if (!match || match[2] === 'main') {
      return;
    }

    const name = match[2];
    const signature = line.trim().replace(/\s+/g, ' ').replace(/\s*\{\s*$/, '');
    methods.push({
      member_key: `${qualifiedName}#${name}`,
      name,
      member_type: 'method',
      signature,
      source_anchor: makeSourceAnchor(record.relativePath, index + 1, `${qualifiedName}#${name}`),
    });
  });

  return methods;
}

function extractJavaUtilityCandidate(record) {
  const javaClass = getJavaClass(record.text);
  if (!javaClass) {
    return null;
  }

  const packageName = getJavaPackage(record.text);
  const qualifiedName = packageName ? `${packageName}.${javaClass.name}` : javaClass.name;
  if (hasJavaBusinessRole(record, javaClass.name)) {
    return null;
  }

  const segments = getPathSegments(record.relativePath).map((segment) => segment.toLowerCase());
  const utilityPath = segments.some((segment) => UTILITY_PATH_SEGMENTS.has(segment));
  const utilityPackage = packageName ? packageName.split('.').some((segment) => UTILITY_PATH_SEGMENTS.has(segment.toLowerCase())) : false;
  const utilityName = /(Util|Utils|Helper|Helpers|Toolkit|Support)$/u.test(javaClass.name);
  const hasPrivateConstructor = new RegExp(`private\\s+${javaClass.name}\\s*\\(`).test(record.text);
  const members = extractJavaStaticMethods(record, qualifiedName);
  const evidence = [];

  if (utilityPath) {
    evidence.push('utility path segment');
  }
  if (utilityPackage) {
    evidence.push('utility package segment');
  }
  if (utilityName) {
    evidence.push('utility class name suffix');
  }
  if (hasPrivateConstructor) {
    evidence.push('private constructor');
  }
  if (members.length >= 2) {
    evidence.push(`${members.length} public static methods`);
  }

  if (!(members.length >= 2 && (utilityPath || utilityPackage || utilityName))) {
    return null;
  }

  return {
    candidate_id: `utility-artifact:java:${qualifiedName}`,
    candidate_type: 'utility_artifact',
    origin: 'project',
    language: 'java',
    framework: record.text.includes('org.springframework') ? 'spring' : null,
    name: javaClass.name,
    qualified_name: qualifiedName,
    artifact_type: 'java_utility_class',
    confidence: members.length >= 3 && (utilityName || utilityPackage) ? 'high' : 'medium',
    action: 'review',
    module_path: getModulePath(record.relativePath),
    source_anchor: makeSourceAnchor(record.relativePath, javaClass.line, qualifiedName),
    evidence,
    members,
    risks: ['Conservative structural scan; semantic business logic was not inferred.'],
  };
}

function extractJavaUtilityCandidates(records) {
  return records
    .filter((record) => record.language === 'java')
    .map((record) => extractJavaUtilityCandidate(record))
    .filter(Boolean);
}

function extractJsExports(record) {
  const exports = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g,
    /export\s+let\s+([A-Za-z_$][\w$]*)\s*=/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)\b/g,
    /exports\.([A-Za-z_$][\w$]*)\s*=/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(record.text)) !== null) {
      exports.push({
        name: match[1],
        member_type: 'export',
        line: lineNumberForIndex(record.text, match.index),
      });
    }
  }

  const namedExportPattern = /export\s*\{([^}]+)\}/g;
  let namedMatch;
  while ((namedMatch = namedExportPattern.exec(record.text)) !== null) {
    for (const rawName of namedMatch[1].split(',')) {
      const name = rawName.trim().split(/\s+as\s+/i).at(-1)?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) {
        exports.push({
          name,
          member_type: 'export',
          line: lineNumberForIndex(record.text, namedMatch.index),
        });
      }
    }
  }

  return uniqueByKey(exports, (item) => `${item.name}:${item.line}`);
}

function parseImportSpecifiers(importText) {
  const specifiers = [];
  const namedMatch = importText.match(/\{([^}]+)\}/);
  if (namedMatch) {
    for (const rawName of namedMatch[1].split(',')) {
      const parts = rawName.trim().split(/\s+as\s+/i);
      const localName = parts.at(-1)?.trim();
      if (localName && /^[A-Za-z_$][\w$]*$/.test(localName)) {
        specifiers.push(localName);
      }
    }
  }

  const namespaceMatch = importText.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) {
    specifiers.push(namespaceMatch[1]);
  }

  const defaultMatch = importText.match(/^import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|\s+from)/);
  if (defaultMatch) {
    specifiers.push(defaultMatch[1]);
  }

  return [...new Set(specifiers)];
}

function extractModuleImports(record) {
  const imports = [];
  const importFromPattern = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  const sideEffectPattern = /import\s+['"]([^'"]+)['"]/g;
  const requirePattern = /(?:const|let|var)\s+([^=]+?)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  let match;

  while ((match = importFromPattern.exec(record.text)) !== null) {
    imports.push({
      module: match[2],
      import_text: record.text.slice(match.index, importFromPattern.lastIndex).replace(/\s+/g, ' ').trim(),
      line: lineNumberForIndex(record.text, match.index),
      local_names: parseImportSpecifiers(`import ${match[1]} from '${match[2]}'`),
    });
  }
  while ((match = sideEffectPattern.exec(record.text)) !== null) {
    imports.push({
      module: match[1],
      import_text: match[0].replace(/\s+/g, ' ').trim(),
      line: lineNumberForIndex(record.text, match.index),
      local_names: [],
    });
  }
  while ((match = requirePattern.exec(record.text)) !== null) {
    const localNames = match[1]
      .replace(/[{}]/g, '')
      .split(',')
      .map((name) => name.trim().split(':').at(-1)?.trim())
      .filter((name) => name && /^[A-Za-z_$][\w$]*$/.test(name));
    imports.push({
      module: match[2],
      import_text: match[0].replace(/\s+/g, ' ').trim(),
      line: lineNumberForIndex(record.text, match.index),
      local_names: [...new Set(localNames)],
    });
  }

  return imports;
}

function buildRecordMap(records) {
  return new Map(records.map((record) => [record.relativePath, record]));
}

function resolveRelativeModule(fromRelativePath, moduleName, recordMap) {
  if (!moduleName.startsWith('.')) {
    return null;
  }

  const basePath = normalizeRelativePath(path.posix.normalize(path.posix.join(path.posix.dirname(fromRelativePath), moduleName)));
  const candidatePaths = [
    basePath,
    ...[...SUPPORTED_EXTENSIONS.keys()].map((extension) => `${basePath}${extension}`),
    ...[...SUPPORTED_EXTENSIONS.keys()].map((extension) => `${basePath}/index${extension}`),
  ];

  return candidatePaths.find((candidatePath) => recordMap.has(candidatePath)) ?? null;
}

function buildImportUsage(records) {
  const recordMap = buildRecordMap(records);
  const usageByTarget = new Map();

  for (const record of records.filter((item) => item.language !== 'java')) {
    for (const moduleImport of extractModuleImports(record)) {
      const targetPath = resolveRelativeModule(record.relativePath, moduleImport.module, recordMap);
      if (!targetPath) {
        continue;
      }

      if (!usageByTarget.has(targetPath)) {
        usageByTarget.set(targetPath, []);
      }
      usageByTarget.get(targetPath).push({
        source_path: record.relativePath,
        source_anchor: makeSourceAnchor(record.relativePath, moduleImport.line, moduleImport.module),
        import_text: moduleImport.import_text,
      });
    }
  }

  return usageByTarget;
}

function extractJsUtilityCandidate(record, usageByTarget) {
  const relativePath = record.relativePath;
  const segments = getPathSegments(relativePath).map((segment) => segment.toLowerCase());
  const basename = path.posix.basename(relativePath, path.posix.extname(relativePath));
  const exports = extractJsExports(record);
  const importedBy = usageByTarget.get(relativePath) ?? [];
  const utilityPath = segments.some((segment) => UTILITY_PATH_SEGMENTS.has(segment));
  const composablePath = segments.includes('composables') || /^use[A-Z]/.test(basename);
  const evidence = [];

  if (utilityPath) {
    evidence.push('common utility path segment');
  }
  if (composablePath) {
    evidence.push('Vue composable path or use* naming');
  }
  if (exports.length > 0) {
    evidence.push(`${exports.length} exported members`);
  }
  if (importedBy.length > 0) {
    evidence.push(`${importedBy.length} cross-file imports`);
  }

  if (!(exports.length > 0 && (utilityPath || composablePath))) {
    return null;
  }

  const members = exports.map((exported) => ({
    member_key: `${relativePath}#${exported.name}`,
    name: exported.name,
    member_type: exported.member_type,
    signature: exported.name,
    source_anchor: makeSourceAnchor(relativePath, exported.line, exported.name),
  }));
  const artifactType = composablePath ? 'vue_composable_or_js_utility' : `${record.language}_utility_module`;

  return {
    candidate_id: `utility-artifact:${record.language}:${relativePath}`,
    candidate_type: 'utility_artifact',
    origin: 'project',
    language: record.language,
    framework: record.language === 'vue' || composablePath ? 'vue3' : null,
    name: basename,
    qualified_name: relativePath,
    artifact_type: artifactType,
    confidence: importedBy.length > 0 ? 'high' : 'medium',
    action: 'review',
    module_path: getModulePath(relativePath),
    source_anchor: makeSourceAnchor(relativePath, members[0]?.source_anchor.line ?? 1, basename),
    evidence,
    members,
    imported_by: importedBy.slice(0, 10),
    risks: importedBy.length > 0 ? [] : ['No cross-file import observed in the scanned scope.'],
  };
}

function extractJsUtilityCandidates(records) {
  const usageByTarget = buildImportUsage(records);
  return records
    .filter((record) => record.language !== 'java')
    .map((record) => extractJsUtilityCandidate(record, usageByTarget))
    .filter(Boolean);
}

function getExternalPackageName(moduleName) {
  if (moduleName.startsWith('@')) {
    return moduleName.split('/').slice(0, 2).join('/');
  }

  return moduleName.split('/')[0];
}

function findCallText(record, localNames) {
  for (const localName of localNames) {
    const callPattern = new RegExp(`\\b${escapeRegExp(localName)}(?:\\.\\w+)?\\s*\\(`);
    const lineIndex = record.lines.findIndex((line) => callPattern.test(line));
    if (lineIndex >= 0) {
      return {
        text: record.lines[lineIndex].trim(),
        line: lineIndex + 1,
      };
    }
  }

  return null;
}

function extractJsExternalUsages(records) {
  const usages = [];

  for (const record of records.filter((item) => item.language !== 'java')) {
    for (const moduleImport of extractModuleImports(record)) {
      if (moduleImport.module.startsWith('.')) {
        continue;
      }

      const packageName = getExternalPackageName(moduleImport.module);
      if (!JS_EXTERNAL_UTILITY_PACKAGES.has(packageName)) {
        continue;
      }

      const call = findCallText(record, moduleImport.local_names);
      usages.push({
        candidate_id: `external-usage:${packageName}:${record.relativePath}:${moduleImport.line}`,
        candidate_type: 'observed_external_usage',
        origin: 'external',
        origin_key: packageName,
        language: record.language,
        framework: packageName === '@vueuse/core' ? 'vue3' : null,
        source_anchor: makeSourceAnchor(record.relativePath, moduleImport.line, packageName),
        import_text: moduleImport.import_text,
        call_text: call?.text ?? null,
        call_anchor: call ? makeSourceAnchor(record.relativePath, call.line, packageName) : null,
        evidence: ['observed external import in project source'],
      });
    }
  }

  return usages;
}

function extractJavaImports(record) {
  const imports = [];
  const pattern = /^\s*import\s+(static\s+)?([^;]+);/gm;
  let match;

  while ((match = pattern.exec(record.text)) !== null) {
    imports.push({
      static_import: Boolean(match[1]),
      import_path: match[2].trim(),
      import_text: match[0].trim(),
      line: lineNumberForIndex(record.text, match.index),
    });
  }

  return imports;
}

function findJavaCallText(record, javaImport) {
  const importParts = javaImport.import_path.split('.');
  const simpleName = importParts.at(-1);
  const ownerName = javaImport.static_import ? importParts.at(-2) : simpleName;
  const callPattern = javaImport.static_import
    ? new RegExp(`\\b${escapeRegExp(simpleName)}\\s*\\(`)
    : new RegExp(`\\b${escapeRegExp(ownerName)}\\.\\w+\\s*\\(`);
  const lineIndex = record.lines.findIndex((line) => callPattern.test(line));

  if (lineIndex < 0) {
    return null;
  }

  return {
    text: record.lines[lineIndex].trim(),
    line: lineIndex + 1,
  };
}

function extractJavaExternalUsages(records) {
  const usages = [];

  for (const record of records.filter((item) => item.language === 'java')) {
    for (const javaImport of extractJavaImports(record)) {
      if (!JAVA_EXTERNAL_UTILITY_PREFIXES.some((prefix) => javaImport.import_path.startsWith(prefix))) {
        continue;
      }

      const call = findJavaCallText(record, javaImport);
      usages.push({
        candidate_id: `external-usage:${javaImport.import_path}:${record.relativePath}:${javaImport.line}`,
        candidate_type: 'observed_external_usage',
        origin: 'external',
        origin_key: javaImport.import_path,
        language: 'java',
        framework: javaImport.import_path.startsWith('org.springframework') ? 'spring' : null,
        source_anchor: makeSourceAnchor(record.relativePath, javaImport.line, javaImport.import_path),
        import_text: javaImport.import_text,
        call_text: call?.text ?? null,
        call_anchor: call ? makeSourceAnchor(record.relativePath, call.line, javaImport.import_path) : null,
        evidence: ['observed external import in project source'],
      });
    }
  }

  return usages;
}

function extractObservedExternalUsages(records) {
  return uniqueByKey([
    ...extractJavaExternalUsages(records),
    ...extractJsExternalUsages(records),
  ], (usage) => usage.candidate_id);
}

function addTemplateInstance(instancesByPattern, patternKey, instance) {
  if (!instancesByPattern.has(patternKey)) {
    instancesByPattern.set(patternKey, []);
  }
  instancesByPattern.get(patternKey).push(instance);
}

function collectTemplateInstances(records) {
  const instancesByPattern = new Map();

  for (const record of records) {
    if (record.language === 'java') {
      if (record.text.includes('@RestController') || record.text.includes('@Controller')) {
        record.lines.forEach((line, index) => {
          if (/@(?:Get|Post|Put|Delete|Patch)Mapping\b/.test(line)) {
            addTemplateInstance(instancesByPattern, 'java-spring-mapping-method', {
              source_anchor: makeSourceAnchor(record.relativePath, index + 1, 'spring-mapping-method'),
              module_path: getModulePath(record.relativePath),
              snippet: line.trim(),
            });
          }
        });
      }
      if (/interface\s+\w+Mapper\s+extends\s+BaseMapper\s*</.test(record.text)) {
        const line = record.lines.findIndex((item) => /interface\s+\w+Mapper\s+extends\s+BaseMapper\s*</.test(item)) + 1;
        addTemplateInstance(instancesByPattern, 'java-mybatis-plus-base-mapper', {
          source_anchor: makeSourceAnchor(record.relativePath, line, 'mybatis-plus-base-mapper'),
          module_path: getModulePath(record.relativePath),
          snippet: record.lines[line - 1]?.trim() ?? '',
        });
      }
      continue;
    }

    if (/\/api\//.test(`/${record.relativePath}`) && /(axios|request|fetch)\s*(?:\.|\()/.test(record.text) && /export\s+(?:async\s+)?(?:function|const)\s+/.test(record.text)) {
      const line = record.lines.findIndex((item) => /export\s+(?:async\s+)?(?:function|const)\s+/.test(item)) + 1;
      addTemplateInstance(instancesByPattern, `${record.language}-api-client-request`, {
        source_anchor: makeSourceAnchor(record.relativePath, line || 1, 'api-client-request'),
        module_path: getModulePath(record.relativePath),
        snippet: record.lines[(line || 1) - 1]?.trim() ?? '',
      });
    }
    if (record.language === 'vue' && record.text.includes('<script setup') && record.text.includes('<el-table') && /\b(?:ref|reactive)\s*\(/.test(record.text)) {
      const line = record.lines.findIndex((item) => item.includes('<el-table')) + 1;
      addTemplateInstance(instancesByPattern, 'vue3-element-plus-table-page', {
        source_anchor: makeSourceAnchor(record.relativePath, line || 1, 'element-plus-table-page'),
        module_path: getModulePath(record.relativePath),
        snippet: record.lines[(line || 1) - 1]?.trim() ?? '',
      });
    }
  }

  return instancesByPattern;
}

function templateMetadata(patternKey) {
  const metadata = {
    'java-spring-mapping-method': {
      name: 'Spring mapped controller method',
      language: 'java',
      framework: 'spring',
      summary: 'Repeated Spring controller mapping method structure.',
    },
    'java-mybatis-plus-base-mapper': {
      name: 'MyBatis-Plus BaseMapper interface',
      language: 'java',
      framework: 'mybatis-plus',
      summary: 'Repeated mapper interface extending BaseMapper.',
    },
    'typescript-api-client-request': {
      name: 'TypeScript API client request function',
      language: 'typescript',
      framework: null,
      summary: 'Repeated exported API client function wrapping request utilities.',
    },
    'javascript-api-client-request': {
      name: 'JavaScript API client request function',
      language: 'javascript',
      framework: null,
      summary: 'Repeated exported API client function wrapping request utilities.',
    },
    'vue3-element-plus-table-page': {
      name: 'Vue 3 Element Plus table page',
      language: 'vue',
      framework: 'vue3',
      summary: 'Repeated Vue 3 table page using Element Plus and Composition API state.',
    },
  };

  return metadata[patternKey] ?? {
    name: patternKey,
    language: null,
    framework: null,
    summary: 'Repeated controlled structural pattern.',
  };
}

function extractTemplateCandidates(records) {
  const instancesByPattern = collectTemplateInstances(records);
  const candidates = [];

  for (const [patternKey, instances] of instancesByPattern.entries()) {
    if (instances.length < TEMPLATE_MIN_INSTANCES) {
      continue;
    }

    const metadata = templateMetadata(patternKey);
    candidates.push({
      candidate_id: `template-pattern:${patternKey}`,
      candidate_type: 'template_pattern',
      pattern_key: patternKey,
      name: metadata.name,
      language: metadata.language,
      framework: metadata.framework,
      action: 'review',
      confidence: 'medium',
      instance_count: instances.length,
      threshold: TEMPLATE_MIN_INSTANCES,
      summary: metadata.summary,
      evidence: ['controlled structural fingerprint', `observed ${instances.length} instances`],
      instances: instances.slice(0, 10),
    });
  }

  return candidates;
}

function addFindingDedupeKey(keys, kind, value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return;
  }

  keys.push({
    kind,
    value: normalized,
  });
}

function findingSymbol(finding) {
  if (finding.finding_type === 'utility_artifact') {
    return finding.qualified_name ?? finding.name ?? null;
  }
  if (finding.finding_type === 'template_pattern') {
    return finding.pattern_key ?? finding.name ?? null;
  }
  if (finding.finding_type === 'observed_external_usage') {
    return finding.origin_key ?? null;
  }

  return finding.name ?? null;
}

function primaryFindingAnchor(finding) {
  if (finding.source_anchor) {
    return finding.source_anchor;
  }
  if (Array.isArray(finding.instances) && finding.instances[0]?.source_anchor) {
    return finding.instances[0].source_anchor;
  }
  if (finding.call_anchor) {
    return finding.call_anchor;
  }

  return null;
}

function buildFindingDedupeKeys(finding) {
  const keys = [];
  const primaryAnchor = primaryFindingAnchor(finding);

  if (finding.finding_type === 'utility_artifact') {
    addFindingDedupeKey(keys, 'anchor', sourceAnchorText(primaryAnchor));
    addFindingDedupeKey(keys, 'symbol', findingSymbol(finding));
    const signatureBundle = (finding.members ?? [])
      .map((member) => `${member.member_key}|${member.signature}|${sourceAnchorText(member.source_anchor)}`)
      .sort()
      .join('||');
    addFindingDedupeKey(keys, 'signature', signatureBundle);
  } else if (finding.finding_type === 'observed_external_usage') {
    addFindingDedupeKey(keys, 'anchor', sourceAnchorText(primaryAnchor));
    addFindingDedupeKey(keys, 'import', `${sourceAnchorText(finding.source_anchor)}|${finding.import_text ?? ''}`);
    if (finding.call_anchor || finding.call_text) {
      addFindingDedupeKey(keys, 'call', `${sourceAnchorText(finding.call_anchor)}|${finding.call_text ?? ''}`);
    }
  } else if (finding.finding_type === 'template_pattern') {
    const instanceAnchors = (finding.instances ?? [])
      .map((instance) => sourceAnchorText(instance.source_anchor))
      .sort()
      .join('||');
    addFindingDedupeKey(keys, 'instance-anchor-set', instanceAnchors);
    addFindingDedupeKey(keys, 'anchor', sourceAnchorText(primaryAnchor));
  }

  return uniqueByKey(keys, (key) => `${key.kind}:${key.value}`);
}

function buildFindingFingerprint(finding, dedupeKeys) {
  const material = {
    finding_type: finding.finding_type,
    origin_key: finding.origin_key ?? null,
    language: finding.language ?? null,
    framework: finding.framework ?? null,
    name: finding.name ?? null,
    artifact_type: finding.artifact_type ?? null,
    module_path: finding.module_path ?? null,
    source_anchor: sourceAnchorText(finding.source_anchor),
    call_anchor: sourceAnchorText(finding.call_anchor),
    import_text: finding.import_text ?? null,
    call_text: finding.call_text ?? null,
    member_signatures: (finding.members ?? [])
      .map((member) => `${member.member_key}|${member.signature}|${sourceAnchorText(member.source_anchor)}`)
      .sort(),
    imported_by: (finding.imported_by ?? [])
      .map((item) => `${item.source_path}|${sourceAnchorText(item.source_anchor)}|${item.import_text ?? ''}`)
      .sort(),
    instance_anchors: (finding.instances ?? [])
      .map((instance) => `${sourceAnchorText(instance.source_anchor)}|${instance.module_path ?? ''}`)
      .sort(),
    dedupe_keys: dedupeKeys.map((key) => `${key.kind}:${key.value}`),
  };

  return sha256(JSON.stringify(material));
}

function candidateToFinding(candidate) {
  const finding = {
    finding_id: candidate.candidate_id,
    finding_type: candidate.candidate_type,
    origin: candidate.origin ?? null,
    language: candidate.language ?? null,
    framework: candidate.framework ?? null,
    name: candidate.name ?? null,
    qualified_name: candidate.qualified_name ?? null,
    artifact_type: candidate.artifact_type ?? null,
    module_path: candidate.module_path ?? null,
    origin_key: candidate.origin_key ?? null,
    pattern_key: candidate.pattern_key ?? null,
    source_anchor: candidate.source_anchor ?? null,
    call_anchor: candidate.call_anchor ?? null,
    import_text: candidate.import_text ?? null,
    call_text: candidate.call_text ?? null,
    structural_evidence: candidate.evidence ?? [],
  };

  if (Array.isArray(candidate.members) && candidate.members.length > 0) {
    finding.members = candidate.members.map((member) => ({
      member_key: member.member_key,
      name: member.name,
      member_type: member.member_type,
      signature: member.signature,
      source_anchor: member.source_anchor,
    }));
  }
  if (Array.isArray(candidate.imported_by) && candidate.imported_by.length > 0) {
    finding.imported_by = candidate.imported_by.map((item) => ({
      source_path: item.source_path,
      source_anchor: item.source_anchor,
      import_text: item.import_text,
    }));
  }
  if (Array.isArray(candidate.instances) && candidate.instances.length > 0) {
    finding.instances = candidate.instances.map((instance) => ({
      source_anchor: instance.source_anchor,
      module_path: instance.module_path ?? null,
      snippet: instance.snippet ?? null,
    }));
  }
  if (Number.isInteger(candidate.instance_count)) {
    finding.instance_count = candidate.instance_count;
  }
  if (Number.isInteger(candidate.threshold)) {
    finding.threshold = candidate.threshold;
  }

  const dedupeKeys = buildFindingDedupeKeys(finding);
  const fingerprint = buildFindingFingerprint(finding, dedupeKeys);

  finding.discovery_fingerprint = fingerprint;
  finding.fingerprint_algorithm = 'sha256';
  finding.mechanical_dedupe = {
    keys: [
      ...dedupeKeys,
      {
        kind: 'fingerprint',
        value: fingerprint,
      },
    ],
  };

  return finding;
}

function groupFindingsByType(findings) {
  const grouped = {
    utility_artifacts: [],
    observed_external_usages: [],
    template_patterns: [],
  };

  for (const finding of findings) {
    if (finding.finding_type === 'utility_artifact') {
      grouped.utility_artifacts.push(finding);
    } else if (finding.finding_type === 'observed_external_usage') {
      grouped.observed_external_usages.push(finding);
    } else if (finding.finding_type === 'template_pattern') {
      grouped.template_patterns.push(finding);
    }
  }

  return grouped;
}

function allDiscoveryFindings(groupedFindings) {
  return [
    ...groupedFindings.utility_artifacts,
    ...groupedFindings.observed_external_usages,
    ...groupedFindings.template_patterns,
  ];
}

function buildFindingCounts(groupedFindings) {
  const counts = {
    utility_artifacts: groupedFindings.utility_artifacts.length,
    observed_external_usages: groupedFindings.observed_external_usages.length,
    template_patterns: groupedFindings.template_patterns.length,
  };

  return {
    ...counts,
    total: counts.utility_artifacts + counts.observed_external_usages + counts.template_patterns,
  };
}

function mechanicallyDedupeFindings(groupedFindings) {
  const deduped = {
    utility_artifacts: [],
    observed_external_usages: [],
    template_patterns: [],
  };
  const seenKeys = new Map();
  const duplicateGroups = [];

  for (const groupName of ['utility_artifacts', 'observed_external_usages', 'template_patterns']) {
    for (const finding of groupedFindings[groupName]) {
      let duplicate = null;
      for (const key of finding.mechanical_dedupe.keys) {
        const identity = `${finding.finding_type}:${key.kind}:${key.value}`;
        const existing = seenKeys.get(identity);
        if (existing) {
          duplicate = {
            dedupe_key: key,
            kept_finding_id: existing.finding_id,
            removed_finding_id: finding.finding_id,
          };
          break;
        }
      }

      if (duplicate) {
        duplicateGroups.push({
          finding_type: finding.finding_type,
          dedupe_kind: duplicate.dedupe_key.kind,
          dedupe_value: duplicate.dedupe_key.value,
          kept_finding_id: duplicate.kept_finding_id,
          removed_finding_id: duplicate.removed_finding_id,
        });
        continue;
      }

      deduped[groupName].push(finding);
      for (const key of finding.mechanical_dedupe.keys) {
        seenKeys.set(`${finding.finding_type}:${key.kind}:${key.value}`, finding);
      }
    }
  }

  const inputTotal = allDiscoveryFindings(groupedFindings).length;
  const keptCounts = buildFindingCounts(deduped);
  return {
    findings: deduped,
    duplicate_groups: duplicateGroups,
    summary: {
      input_total: inputTotal,
      kept_total: keptCounts.total,
      removed_total: inputTotal - keptCounts.total,
      duplicate_groups: duplicateGroups.length,
      rules: ['anchor', 'symbol', 'signature', 'import', 'call', 'fingerprint'],
    },
  };
}

function buildFindingIndexItem(finding) {
  const primaryAnchor = primaryFindingAnchor(finding);
  const symbol = findingSymbol(finding);
  return {
    finding_id: finding.finding_id,
    finding_type: finding.finding_type,
    language: finding.language ?? null,
    framework: finding.framework ?? null,
    symbol,
    path: primaryAnchor?.path ?? null,
    anchor: sourceAnchorText(primaryAnchor),
    discovery_fingerprint: finding.discovery_fingerprint,
    dedupe_keys: finding.mechanical_dedupe.keys.map((key) => `${key.kind}:${key.value}`),
  };
}

function uniqueSortedStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))].sort();
}

function findingSourcePaths(finding) {
  return uniqueSortedStrings([
    finding.source_anchor?.path,
    finding.call_anchor?.path,
    ...(finding.members ?? []).map((member) => member.source_anchor?.path),
    ...(finding.imported_by ?? []).map((item) => item.source_anchor?.path),
    ...(finding.instances ?? []).map((instance) => instance.source_anchor?.path),
  ]);
}

function findingMatchKeys(finding) {
  const keys = [];
  const primaryAnchor = primaryFindingAnchor(finding);
  if (primaryAnchor?.text) {
    keys.push(`${finding.finding_type}|anchor|${primaryAnchor.text}`);
  }
  if (finding.finding_type === 'template_pattern' && finding.pattern_key) {
    keys.push(`${finding.finding_type}|pattern|${finding.pattern_key}`);
  }
  if (finding.call_anchor?.text) {
    keys.push(`${finding.finding_type}|call-anchor|${finding.call_anchor.text}`);
  }
  return uniqueSortedStrings(keys);
}

function utilityArtifactToFindingRecord(artifact) {
  return {
    finding_type: 'utility_artifact',
    origin_key: artifact.origin.originKey,
    language: artifact.language,
    framework: artifact.framework,
    name: artifact.name,
    artifact_type: artifact.artifactType,
    module_path: artifact.modulePath,
    source_anchor: artifact.sourceAnchor,
    members: artifact.members.flatMap((member) => member.signatures.map((signature) => ({
      member_key: member.memberKey,
      signature: signature.signature,
      source_anchor: signature.sourceAnchor,
    }))),
  };
}

function templatePatternToFindingRecord(pattern) {
  return {
    finding_type: 'template_pattern',
    language: pattern.language,
    framework: pattern.framework,
    name: pattern.name,
    module_path: pattern.modulePath,
    pattern_key: pattern.patternKey,
    instances: pattern.instances.map((instance) => ({
      source_anchor: instance.sourceAnchor,
      module_path: instance.modulePath,
    })),
  };
}

function externalUsageToFindingRecord(usage) {
  return {
    finding_type: 'observed_external_usage',
    origin_key: usage.origin.originKey,
    language: usage.language,
    framework: usage.framework,
    source_anchor: usage.sourceAnchor,
    import_text: usage.importText,
    call_text: usage.callText,
  };
}

function traceDecisionToFindingRecord(candidate) {
  return {
    finding_type: candidate.candidateType,
    source_anchor: candidate.sourceAnchor,
    pattern_key: candidate.patternKey ?? null,
  };
}

function fingerprintForFindingRecord(finding) {
  const dedupeKeys = buildFindingDedupeKeys(finding);
  return buildFindingFingerprint(finding, dedupeKeys);
}

function persistedDiscoveryRecord(recordFamily, recordKind, recordKey, finding, discoveryFingerprint = null) {
  return {
    recordFamily,
    recordKind,
    recordKey,
    sourceAnchor: primaryFindingAnchor(finding),
    sourcePaths: findingSourcePaths(finding),
    matchKeys: findingMatchKeys(finding),
    fingerprintAlgorithm: 'sha256',
    structuralFingerprint: discoveryFingerprint ?? fingerprintForFindingRecord(finding),
  };
}

function persistedDiscoveryRecordSummary(record) {
  return {
    record_family: record.recordFamily,
    record_kind: record.recordKind,
    record_key: record.recordKey,
    source_anchor: anchorToOutput(record.sourceAnchor),
  };
}

function emptyPreclassificationFindingCounts(totalFindings) {
  return {
    new: 0,
    unchanged_catalog_entries: 0,
    unchanged_suppressions: 0,
    unchanged_deferrals: 0,
    reopened_catalog_entries: 0,
    reopened_suppressions: 0,
    reopened_deferrals: 0,
    review_queue: 0,
    skipped: 0,
    total: totalFindings,
  };
}

function emptyPreclassificationCleanupCounts() {
  return {
    stale_catalog_entries: 0,
    stale_suppressions: 0,
    stale_deferrals: 0,
    missing_source_records: 0,
    total: 0,
  };
}

function buildReviewQueueItem(finding, reason, matchedRecord = null) {
  return {
    finding_id: finding.finding_id,
    finding_type: finding.finding_type,
    reason,
    matched_record: matchedRecord ? persistedDiscoveryRecordSummary(matchedRecord) : null,
  };
}

function buildSkippedFindingItem(finding, reason, matchedRecord) {
  return {
    finding_id: finding.finding_id,
    finding_type: finding.finding_type,
    reason,
    matched_record: persistedDiscoveryRecordSummary(matchedRecord),
  };
}

function buildCleanupQueueItem(record, reason, verification = null) {
  return {
    record_family: record.recordFamily,
    record_kind: record.recordKind,
    record_key: record.recordKey,
    reason,
    source_anchor: anchorToOutput(record.sourceAnchor),
    verification,
  };
}

function parseJsonArrayField(value) {
  const text = normalizeNullableString(value);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPathCoveredByChangedPaths(relativePath, changedPaths) {
  return changedPaths.some((scope) => {
    if (scope.is_directory) {
      return relativePath === scope.path || relativePath.startsWith(`${scope.path}/`);
    }
    return relativePath === scope.path;
  });
}

function recordInPreclassificationScope(record, scan) {
  if (scan.mode !== 'changed') {
    return true;
  }
  return record.sourcePaths.some((sourcePath) => isPathCoveredByChangedPaths(sourcePath, scan.changed_paths));
}

function preclassificationIndexState(context) {
  const exists = fs.existsSync(context.dbPath);
  const schemaVersion = exists ? getReadOnlySchemaVersion(context.dbPath) : 0;
  return {
    exists,
    schemaVersion,
    readable: exists && schemaVersion >= MIN_PRECLASS_SCHEMA_VERSION,
    reason: exists ? (schemaVersion >= MIN_PRECLASS_SCHEMA_VERSION ? null : 'schema-too-old') : 'missing-index',
  };
}

function loadPersistedDiscoveryRecords(context, scan) {
  const state = preclassificationIndexState(context);
  if (!state.readable) {
    return {
      state,
      records: [],
    };
  }

  const rows = runSqliteReadOnlyJson(context.dbPath, `
SELECT
  record_family,
  record_kind,
  record_key,
  source_anchor,
  source_paths,
  match_keys,
  structural_fingerprint,
  fingerprint_algorithm
FROM discovery_fingerprints
WHERE project_id = ${sqlString(context.projectId)}
ORDER BY record_family, record_kind, record_key;
`);

  const records = rows.map((row) => ({
    recordFamily: row.record_family,
    recordKind: row.record_kind,
    recordKey: row.record_key,
    sourceAnchor: parseStoredSourceAnchor(row.source_anchor),
    sourcePaths: uniqueSortedStrings(parseJsonArrayField(row.source_paths)),
    matchKeys: uniqueSortedStrings(parseJsonArrayField(row.match_keys)),
    structuralFingerprint: row.structural_fingerprint,
    fingerprintAlgorithm: row.fingerprint_algorithm ?? 'sha256',
  })).filter((record) => recordInPreclassificationScope(record, scan));

  return {
    state,
    records,
  };
}

function recordPriority(record) {
  if (record.recordFamily === 'catalog_entry') {
    return 3;
  }
  if (record.recordFamily === 'suppression') {
    return 2;
  }
  if (record.recordFamily === 'deferral') {
    return 1;
  }
  return 0;
}

function chooseBestMatchedRecord(records) {
  return [...records].sort((left, right) => {
    if (recordPriority(right) !== recordPriority(left)) {
      return recordPriority(right) - recordPriority(left);
    }
    if (left.recordKind !== right.recordKind) {
      return left.recordKind.localeCompare(right.recordKind);
    }
    return left.recordKey.localeCompare(right.recordKey);
  })[0] ?? null;
}

function preclassificationReasonForUnchanged(record) {
  if (record.recordFamily === 'catalog_entry') {
    return 'unchanged-catalog-entry';
  }
  if (record.recordFamily === 'suppression') {
    return 'unchanged-suppression';
  }
  return 'unchanged-deferral';
}

function preclassificationReasonForReopened(record) {
  if (record.recordFamily === 'catalog_entry') {
    return 'changed-catalog-entry';
  }
  if (record.recordFamily === 'suppression') {
    return 'stale-suppression';
  }
  return 'stale-deferral';
}

function incrementPreclassificationFindingCount(counts, reason) {
  if (reason === 'new-finding') {
    counts.new += 1;
  } else if (reason === 'unchanged-catalog-entry') {
    counts.unchanged_catalog_entries += 1;
    counts.skipped += 1;
  } else if (reason === 'unchanged-suppression') {
    counts.unchanged_suppressions += 1;
    counts.skipped += 1;
  } else if (reason === 'unchanged-deferral') {
    counts.unchanged_deferrals += 1;
    counts.skipped += 1;
  } else if (reason === 'changed-catalog-entry') {
    counts.reopened_catalog_entries += 1;
  } else if (reason === 'stale-suppression') {
    counts.reopened_suppressions += 1;
  } else if (reason === 'stale-deferral') {
    counts.reopened_deferrals += 1;
  }
  if (reason === 'new-finding' || reason === 'changed-catalog-entry' || reason === 'stale-suppression' || reason === 'stale-deferral') {
    counts.review_queue += 1;
  }
}

function incrementPreclassificationCleanupCount(counts, reason) {
  if (reason === 'stale-catalog-entry') {
    counts.stale_catalog_entries += 1;
  } else if (reason === 'stale-suppression') {
    counts.stale_suppressions += 1;
  } else if (reason === 'stale-deferral') {
    counts.stale_deferrals += 1;
  } else if (reason === 'missing-source') {
    counts.missing_source_records += 1;
  }
  counts.total += 1;
}

function preclassificationCleanupReason(record, verification) {
  if (!verification.ok) {
    return 'missing-source';
  }
  if (record.recordFamily === 'catalog_entry') {
    return 'stale-catalog-entry';
  }
  if (record.recordFamily === 'suppression') {
    return 'stale-suppression';
  }
  return 'stale-deferral';
}

function buildDiscoveryPreclassification(context, scan, groupedFindings) {
  const findings = allDiscoveryFindings(groupedFindings);
  const findingCounts = emptyPreclassificationFindingCounts(findings.length);
  const cleanupCounts = emptyPreclassificationCleanupCounts();
  const loaded = loadPersistedDiscoveryRecords(context, scan);
  const recordsByMatchKey = new Map();

  for (const record of loaded.records) {
    for (const matchKey of record.matchKeys) {
      const existing = recordsByMatchKey.get(matchKey) ?? [];
      existing.push(record);
      recordsByMatchKey.set(matchKey, existing);
    }
  }

  const matchedRecordKeys = new Set();
  const reviewQueue = [];
  const skipped = [];

  for (const finding of findings) {
    const candidateRecords = [];
    const seenRecords = new Set();
    for (const matchKey of findingMatchKeys(finding)) {
      for (const record of recordsByMatchKey.get(matchKey) ?? []) {
        const recordIdentity = `${record.recordFamily}:${record.recordKind}:${record.recordKey}`;
        if (!seenRecords.has(recordIdentity)) {
          seenRecords.add(recordIdentity);
          candidateRecords.push(record);
        }
      }
    }

    const unchangedRecord = candidateRecords.find((record) => record.structuralFingerprint === finding.discovery_fingerprint) ?? null;
    if (unchangedRecord) {
      const reason = preclassificationReasonForUnchanged(unchangedRecord);
      incrementPreclassificationFindingCount(findingCounts, reason);
      skipped.push(buildSkippedFindingItem(finding, reason, unchangedRecord));
      matchedRecordKeys.add(`${unchangedRecord.recordFamily}:${unchangedRecord.recordKind}:${unchangedRecord.recordKey}`);
      continue;
    }

    const reopenedRecord = chooseBestMatchedRecord(candidateRecords);
    if (reopenedRecord) {
      const reason = preclassificationReasonForReopened(reopenedRecord);
      incrementPreclassificationFindingCount(findingCounts, reason);
      reviewQueue.push(buildReviewQueueItem(finding, reason, reopenedRecord));
      matchedRecordKeys.add(`${reopenedRecord.recordFamily}:${reopenedRecord.recordKind}:${reopenedRecord.recordKey}`);
      continue;
    }

    incrementPreclassificationFindingCount(findingCounts, 'new-finding');
    reviewQueue.push(buildReviewQueueItem(finding, 'new-finding'));
  }

  const cleanupQueue = [];
  for (const record of loaded.records) {
    const recordIdentity = `${record.recordFamily}:${record.recordKind}:${record.recordKey}`;
    if (matchedRecordKeys.has(recordIdentity)) {
      continue;
    }
    const verification = verifySourceAnchor(context.rootPath, anchorToOutput(record.sourceAnchor));
    const reason = preclassificationCleanupReason(record, verification);
    incrementPreclassificationCleanupCount(cleanupCounts, reason);
    cleanupQueue.push(buildCleanupQueueItem(record, reason, verification));
  }

  const recordCounts = {
    catalog_entries: loaded.records.filter((record) => record.recordFamily === 'catalog_entry').length,
    suppressions: loaded.records.filter((record) => record.recordFamily === 'suppression').length,
    deferrals: loaded.records.filter((record) => record.recordFamily === 'deferral').length,
  };

  return {
    status: loaded.state.readable ? 'ready' : loaded.state.reason,
    index: {
      status: loaded.state.readable ? 'ready' : loaded.state.reason,
      schema_version: loaded.state.schemaVersion,
      readable: loaded.state.readable,
    },
    record_counts: {
      ...recordCounts,
      total: recordCounts.catalog_entries + recordCounts.suppressions + recordCounts.deferrals,
    },
    finding_counts: findingCounts,
    cleanup_counts: cleanupCounts,
    review_queue: reviewQueue,
    skipped,
    cleanup_queue: cleanupQueue,
  };
}

function buildDiscoveryDryRun(context, discoverOptions) {
  const scope = buildScanScope(context.rootPath, discoverOptions);
  const records = readScanFiles(scope.files);
  const utilityArtifacts = [
    ...extractJavaUtilityCandidates(records),
    ...extractJsUtilityCandidates(records),
  ].sort((left, right) => left.source_anchor.text.localeCompare(right.source_anchor.text));
  const observedExternalUsages = extractObservedExternalUsages(records)
    .sort((left, right) => left.source_anchor.text.localeCompare(right.source_anchor.text));
  const templatePatterns = extractTemplateCandidates(records)
    .sort((left, right) => left.pattern_key.localeCompare(right.pattern_key));

  const generatedAt = new Date().toISOString();
  const project = projectContextToOutput(context);
  const scan = {
    mode: discoverOptions.mode,
    root_path: context.rootPath,
    scan_source: scope.source,
    changed_paths: scope.changedScopes.map((scopeItem) => ({
      input: scopeItem.input,
      path: scopeItem.relativePath,
      exists: scopeItem.exists,
      is_directory: scopeItem.isDirectory,
    })),
    language_filters: discoverOptions.languages,
    include_filters: discoverOptions.includeFilters,
    exclude_filters: discoverOptions.excludeFilters,
    files_considered: scope.filesConsidered,
    files_in_scope: scope.scopedFiles,
    files_scanned: records.length,
    skipped_by_reason: scope.skippedByReason,
    max_scan_file_bytes: MAX_SCAN_FILE_BYTES,
  };
  const candidates = {
    utility_artifacts: utilityArtifacts,
    observed_external_usages: observedExternalUsages,
    template_patterns: templatePatterns,
  };
  const deduped = mechanicallyDedupeFindings(groupFindingsByType(allDiscoveryCandidates({
    candidates,
  }).map((candidate) => candidateToFinding(candidate))));
  const findingCounts = buildFindingCounts(deduped.findings);
  const preclassification = buildDiscoveryPreclassification(context, scan, deduped.findings);

  return {
    summary: {
      kind: 'tool_catalog_discovery_dry_run',
      version: 2,
      generated_at: generatedAt,
      dry_run: true,
      index_mutated: false,
      project,
      scan,
      finding_counts: findingCounts,
      mechanical_dedupe: deduped.summary,
      preclassification,
    },
    findings_payload: {
      kind: 'tool_catalog_discovery_findings',
      version: 1,
      generated_at: generatedAt,
      dry_run: true,
      index_mutated: false,
      project,
      scan,
      finding_counts: findingCounts,
      mechanical_dedupe: {
        ...deduped.summary,
        duplicate_groups: deduped.duplicate_groups,
      },
      preclassification,
      findings: deduped.findings,
    },
    finding_index_payload: {
      kind: 'tool_catalog_discovery_finding_index',
      version: 1,
      generated_at: generatedAt,
      dry_run: true,
      index_mutated: false,
      project: {
        project_id: project.project_id,
        root_path: project.root_path,
      },
      scan: {
        mode: scan.mode,
        files_scanned: scan.files_scanned,
      },
      finding_counts: findingCounts,
      items: allDiscoveryFindings(deduped.findings).map((finding) => buildFindingIndexItem(finding)),
    },
    compatibility_payload: {
      kind: 'tool_catalog_discovery_candidate_compat',
      version: 1,
      generated_at: generatedAt,
      dry_run: true,
      index_mutated: false,
      project,
      scan,
      candidates,
    },
  };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function allDiscoveryCandidates(output) {
  return [
    ...output.candidates.utility_artifacts,
    ...output.candidates.observed_external_usages,
    ...output.candidates.template_patterns,
  ];
}

function buildDiscoveryRunId(summary, findingsPayload) {
  const generatedAt = summary.generated_at.replace(/[-:.TZ]/g, '').slice(0, 17);
  const findingKeys = allDiscoveryFindings(findingsPayload.findings).map((finding) => finding.finding_id).sort().join('\n');
  return `${generatedAt}-${summary.scan.mode}-${sha256(`${summary.project.project_id}\n${findingKeys}`).slice(0, 12)}`;
}

function discoveryRunFilePaths(context, summary, findingsPayload) {
  const runId = buildDiscoveryRunId(summary, findingsPayload);
  const runDirectory = path.join(context.projectDir, 'runs', runId);
  return {
    run_id: runId,
    run_directory: runDirectory,
    findings_path: path.join(runDirectory, 'findings.json'),
    finding_index_path: path.join(runDirectory, 'finding-index.json'),
    finding_manifest_path: path.join(runDirectory, 'finding-manifest.json'),
    compatibility_candidates_path: path.join(runDirectory, 'compat-candidates.json'),
  };
}

function writeJsonRunFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sourceAnchorText(anchor) {
  return anchor?.text ?? 'n/a';
}

function buildFindingManifest(summary, runFiles) {
  return {
    kind: 'tool_catalog_discovery_finding_manifest',
    version: 1,
    generated_at: summary.generated_at,
    dry_run: true,
    index_mutated: false,
    project: {
      project_id: summary.project.project_id,
      root_path: summary.project.root_path,
      catalog_path: summary.project.catalog_path,
    },
    scan: {
      mode: summary.scan.mode,
      scan_source: summary.scan.scan_source,
      files_scanned: summary.scan.files_scanned,
      files_in_scope: summary.scan.files_in_scope,
      changed_paths: summary.scan.changed_paths,
    },
    finding_counts: summary.finding_counts,
    mechanical_dedupe: summary.mechanical_dedupe,
    preclassification: summary.preclassification,
    run_files: runFiles,
  };
}

function writeDiscoveryRunFiles(context, draft) {
  const runFiles = discoveryRunFilePaths(context, draft.summary, draft.findings_payload);
  const output = {
    ...draft.summary,
    run_files: runFiles,
  };
  const manifest = buildFindingManifest(output, runFiles);

  fs.mkdirSync(runFiles.run_directory, { recursive: true });
  writeJsonRunFile(runFiles.findings_path, {
    ...draft.findings_payload,
    run_files: runFiles,
  });
  writeJsonRunFile(runFiles.finding_index_path, {
    ...draft.finding_index_payload,
    run_files: runFiles,
  });
  writeJsonRunFile(runFiles.finding_manifest_path, manifest);
  writeJsonRunFile(runFiles.compatibility_candidates_path, {
    ...draft.compatibility_payload,
    run_files: runFiles,
  });

  return output;
}

function renderDiscoveryMarkdown(output) {
  const lines = [
    '# Tool Catalog Discovery Dry Run',
    '',
    `Project: \`${output.project.project_id}\``,
    `Root: \`${output.project.root_path}\``,
    `Mode: \`${output.scan.mode}\``,
    `Files: ${output.scan.files_scanned} scanned from ${output.scan.files_in_scope} in-scope ${pluralize(output.scan.files_in_scope, 'file')}.`,
    `Index mutated: \`${output.index_mutated}\``,
    '',
    '## Finding Counts',
    '',
    `- Utility artifacts: ${output.finding_counts.utility_artifacts}`,
    `- Observed external usages: ${output.finding_counts.observed_external_usages}`,
    `- Template patterns: ${output.finding_counts.template_patterns}`,
    `- Total findings: ${output.finding_counts.total}`,
    '',
    '## Mechanical Dedupe',
    '',
    `- Input findings: ${output.mechanical_dedupe.input_total}`,
    `- Kept findings: ${output.mechanical_dedupe.kept_total}`,
    `- Removed duplicates: ${output.mechanical_dedupe.removed_total}`,
    `- Duplicate groups: ${output.mechanical_dedupe.duplicate_groups}`,
    '',
    '## Preclassification',
    '',
    `- Index state: \`${output.preclassification.index.status}\``,
    `- Review queue: ${output.preclassification.finding_counts.review_queue}`,
    `- New findings: ${output.preclassification.finding_counts.new}`,
    `- Unchanged catalog entries: ${output.preclassification.finding_counts.unchanged_catalog_entries}`,
    `- Unchanged suppressions: ${output.preclassification.finding_counts.unchanged_suppressions}`,
    `- Unchanged deferrals: ${output.preclassification.finding_counts.unchanged_deferrals}`,
    `- Reopened catalog entries: ${output.preclassification.finding_counts.reopened_catalog_entries}`,
    `- Reopened suppressions: ${output.preclassification.finding_counts.reopened_suppressions}`,
    `- Reopened deferrals: ${output.preclassification.finding_counts.reopened_deferrals}`,
    `- Cleanup records: ${output.preclassification.cleanup_counts.total}`,
    `- Missing-source records: ${output.preclassification.cleanup_counts.missing_source_records}`,
    '',
    '## Run Files',
    '',
    `- Raw Findings: \`${output.run_files.findings_path}\``,
    `- Finding Index: \`${output.run_files.finding_index_path}\``,
    `- Finding Manifest: \`${output.run_files.finding_manifest_path}\``,
    '',
    '## Next Steps',
    '',
    '- Read the Finding Index first to shard review work without loading the full findings file.',
    '- Use raw Findings and the Finding Manifest as evidence harvest inputs for later review/finalization stages.',
  ];

  lines.push('', '## Scan Notes');
  lines.push('- Dry-run output is review-only and did not write SQLite project index data.');
  lines.push('- Discovery used lightweight structural scanning; project builds and tests were not run.');
  if (Object.keys(output.scan.skipped_by_reason).length > 0) {
    lines.push(`- Skipped files: \`${JSON.stringify(output.scan.skipped_by_reason)}\`.`);
  }

  return `${lines.join('\n')}\n`;
}

function printDiscoveryDryRun(output, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderDiscoveryMarkdown(output));
}

function readJsonFile(filePath) {
  const resolvedPath = path.resolve(expandHome(filePath));
  try {
    return {
      path: resolvedPath,
      data: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')),
    };
  } catch (error) {
    throw new ToolCatalogError(`Unable to read discovery decisions JSON ${resolvedPath}: ${error.message}`, 2);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function candidateTypeForGroup(groupName) {
  if (groupName === 'utility_artifacts') {
    return 'utility_artifact';
  }
  if (groupName === 'observed_external_usages') {
    return 'observed_external_usage';
  }
  if (groupName === 'template_patterns') {
    return 'template_pattern';
  }

  return null;
}

function collectCandidateArray(value, groupName, candidates) {
  if (!value) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new ToolCatalogError(`Discovery decisions field '${groupName}' must be an array.`, 2);
  }

  const impliedType = candidateTypeForGroup(groupName);
  for (const candidate of value) {
    if (!isPlainObject(candidate)) {
      throw new ToolCatalogError(`Discovery candidate in '${groupName}' must be an object.`, 2);
    }
    candidates.push({
      ...candidate,
      candidate_type: candidate.candidate_type ?? impliedType,
    });
  }
}

function collectApplyCandidates(input) {
  const candidates = [];

  if (Array.isArray(input.candidates)) {
    collectCandidateArray(input.candidates, 'candidates', candidates);
  } else if (isPlainObject(input.candidates)) {
    for (const groupName of CANDIDATE_GROUPS) {
      collectCandidateArray(input.candidates[groupName], groupName, candidates);
    }
  }

  for (const groupName of CANDIDATE_GROUPS) {
    collectCandidateArray(input[groupName], groupName, candidates);
  }

  const byId = new Map();
  for (const candidate of candidates) {
    const candidateId = normalizeNullableString(candidate.candidate_id);
    if (!candidateId) {
      throw new ToolCatalogError('Every discovery candidate must include candidate_id.', 2);
    }
    byId.set(candidateId, {
      ...candidate,
      candidate_id: candidateId,
    });
  }

  return byId;
}

function normalizeDecisionAction(value) {
  const action = normalizeNullableString(value)?.toLowerCase() ?? null;
  if (!action) {
    return null;
  }
  if (!DECISION_ACTIONS.has(action)) {
    throw new ToolCatalogError(`Unsupported discovery decision action '${value}'. Use accept, ignore, or defer.`, 2);
  }

  return action;
}

function parseDecisionOverrides(decisions) {
  const overrides = new Map();
  if (!decisions) {
    return overrides;
  }

  const items = Array.isArray(decisions)
    ? decisions
    : Object.entries(decisions).map(([candidateId, decision]) => {
      if (typeof decision === 'string') {
        return { candidate_id: candidateId, action: decision };
      }
      if (isPlainObject(decision)) {
        return { ...decision, candidate_id: decision.candidate_id ?? candidateId };
      }
      throw new ToolCatalogError(`Decision override for ${candidateId} must be a string or object.`, 2);
    });

  for (const item of items) {
    if (!isPlainObject(item)) {
      throw new ToolCatalogError('Each discovery decision override must be an object.', 2);
    }
    const candidateId = normalizeNullableString(item.candidate_id);
    if (!candidateId) {
      throw new ToolCatalogError('Each discovery decision override must include candidate_id.', 2);
    }
    overrides.set(candidateId, item);
  }

  return overrides;
}

function collectAcceptedEntryArray(value, groupName, entries) {
  if (!value) {
    return;
  }
  const impliedType = candidateTypeForGroup(groupName);

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isPlainObject(entry)) {
        throw new ToolCatalogError(`Accepted entry in '${groupName}' must be an object.`, 2);
      }
      entries.push({
        ...entry,
        candidate_type: entry.candidate_type ?? entry.entry_type ?? impliedType,
      });
    }
    return;
  }

  if (!isPlainObject(value)) {
    throw new ToolCatalogError(`Discovery decisions field '${groupName}' must be an array or object map.`, 2);
  }

  for (const [entryKey, entry] of Object.entries(value)) {
    if (!isPlainObject(entry)) {
      throw new ToolCatalogError(`Accepted entry '${entryKey}' in '${groupName}' must be an object.`, 2);
    }

    const selectorMatch = entryKey.match(/^(artifact|template|external):(.*)$/);
    const selectorType = selectorMatch?.[1] === 'artifact'
      ? 'utility_artifact'
      : selectorMatch?.[1] === 'template'
        ? 'template_pattern'
        : selectorMatch?.[1] === 'external'
          ? 'observed_external_usage'
          : null;
    const keyIdentity = selectorMatch?.[2] ?? entryKey;
    const candidateType = entry.candidate_type
      ?? entry.entry_type
      ?? selectorType
      ?? (Object.hasOwn(entry, 'artifact_key')
        ? 'utility_artifact'
        : Object.hasOwn(entry, 'pattern_key')
          ? 'template_pattern'
          : Object.hasOwn(entry, 'usage_key')
            ? 'observed_external_usage'
            : impliedType);

    if (!candidateType) {
      throw new ToolCatalogError(`Accepted entry '${entryKey}' in '${groupName}' must include candidate_type, entry_type, or a typed key prefix.`, 2);
    }
    if (selectorType && selectorType !== candidateType) {
      throw new ToolCatalogError(`Accepted entry '${entryKey}' in '${groupName}' uses selector type '${selectorType}' but declares candidate_type '${candidateType}'.`, 2);
    }

    const identityField = candidateType === 'utility_artifact'
      ? 'artifact_key'
      : candidateType === 'template_pattern'
        ? 'pattern_key'
        : candidateType === 'observed_external_usage'
          ? 'usage_key'
          : null;
    if (!identityField) {
      throw new ToolCatalogError(`Accepted entry '${entryKey}' in '${groupName}' has unsupported candidate_type '${candidateType}'.`, 2);
    }

    // 键控 accepted entry 的映射键就是最终 identity，payload 内同名字段只能显式重复，不能改写。
    const payloadIdentity = normalizeNullableString(entry[identityField]);
    if (payloadIdentity && payloadIdentity !== keyIdentity) {
      throw new ToolCatalogError(`Accepted entry '${entryKey}' in '${groupName}' must keep ${identityField} aligned with the map key '${keyIdentity}', received '${payloadIdentity}'.`, 2);
    }

    entries.push({
      ...entry,
      candidate_type: candidateType,
      artifact_key: candidateType === 'utility_artifact' ? keyIdentity : entry.artifact_key,
      pattern_key: candidateType === 'template_pattern' ? keyIdentity : entry.pattern_key,
      usage_key: candidateType === 'observed_external_usage' ? keyIdentity : entry.usage_key,
    });
  }
}

function collectFinalAcceptedEntries(input) {
  const entries = [];
  collectAcceptedEntryArray(input.accepted_entries, 'accepted_entries', entries);
  collectAcceptedEntryArray(input.accepted_utility_artifacts, 'utility_artifacts', entries);
  collectAcceptedEntryArray(input.accepted_observed_external_usages, 'observed_external_usages', entries);
  collectAcceptedEntryArray(input.accepted_template_patterns, 'template_patterns', entries);

  if (isPlainObject(input.accepted)) {
    for (const groupName of CANDIDATE_GROUPS) {
      collectAcceptedEntryArray(input.accepted[groupName], groupName, entries);
    }
  }

  return entries;
}

function collectTraceableDecisionArray(value, fieldName) {
  if (!value) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ToolCatalogError(`Discovery decisions field '${fieldName}' must be an array.`, 2);
  }

  return value.map((item) => {
    if (!isPlainObject(item)) {
      throw new ToolCatalogError(`Decision entry in '${fieldName}' must be an object.`, 2);
    }
    return item;
  });
}

function finalAcceptedCandidateId(entry) {
  return normalizeNullableString(entry.candidate_id)
    ?? normalizeNullableString(entry.artifact_key)
    ?? normalizeNullableString(entry.pattern_key)
    ?? normalizeNullableString(entry.usage_key);
}

function assertRelativeProjectPath(value, fieldName) {
  const rawValue = String(value ?? '');
  const normalized = normalizeRelativePath(rawValue);
  if (!normalized || path.isAbsolute(rawValue) || normalized === '..' || normalized.startsWith('../')) {
    throw new ToolCatalogError(`${fieldName} must be a relative path inside the target project.`, 2);
  }

  return normalized;
}

function parseSourceAnchorText(value) {
  const text = normalizeNullableString(value);
  if (!text) {
    return null;
  }

  const match = text.match(/^(.+?)(?::(\d+))?(?:#(.+))?$/);
  if (!match) {
    return null;
  }

  return {
    path: match[1],
    line: match[2] ? Number.parseInt(match[2], 10) : 1,
    symbol: match[3] ?? null,
  };
}

function normalizeSourceAnchor(value, fallbackSymbol, fieldName = 'source_anchor') {
  const rawAnchor = typeof value === 'string' ? parseSourceAnchorText(value) : value;
  if (!isPlainObject(rawAnchor)) {
    throw new ToolCatalogError(`${fieldName} must be an object with path, line, and symbol metadata.`, 2);
  }

  const relativePath = assertRelativeProjectPath(rawAnchor.path, `${fieldName}.path`);
  const line = Number.parseInt(rawAnchor.line ?? rawAnchor.line_hint ?? 1, 10);
  if (!Number.isFinite(line) || line < 1) {
    throw new ToolCatalogError(`${fieldName}.line must be a positive integer line hint.`, 2);
  }

  const symbol = normalizeNullableString(rawAnchor.symbol ?? rawAnchor.symbol_identity ?? fallbackSymbol);
  if (!symbol) {
    throw new ToolCatalogError(`${fieldName}.symbol must identify the source symbol.`, 2);
  }

  return {
    path: relativePath,
    line,
    symbol,
    text: `${relativePath}:${line}#${symbol}`,
  };
}

function sourceAnchorSql(anchor) {
  return sqlString(JSON.stringify(anchor));
}

function normalizeChangedPathScope(item) {
  if (typeof item === 'string') {
    return {
      path: assertRelativeProjectPath(item, 'scan.changed_paths.path'),
      isDirectory: item.endsWith('/'),
    };
  }
  if (!isPlainObject(item)) {
    throw new ToolCatalogError('scan.changed_paths entries must be strings or objects.', 2);
  }

  return {
    path: assertRelativeProjectPath(item.path ?? item.relativePath ?? item.input, 'scan.changed_paths.path'),
    isDirectory: Boolean(item.is_directory ?? item.isDirectory),
  };
}

function normalizeApplyScope(input) {
  const scan = isPlainObject(input.scan) ? input.scan : {};
  const mode = normalizeNullableString(scan.mode ?? input.mode);
  if (mode !== 'full' && mode !== 'changed') {
    throw new ToolCatalogError('Discovery decisions must include scan.mode as full or changed.', 2);
  }

  const changedPathInput = scan.changed_paths ?? input.changed_paths ?? [];
  if (!Array.isArray(changedPathInput)) {
    throw new ToolCatalogError('Discovery decisions scan.changed_paths must be an array.', 2);
  }
  const changedPaths = changedPathInput.map((item) => normalizeChangedPathScope(item));
  if (mode === 'changed' && changedPaths.length === 0) {
    throw new ToolCatalogError('Changed discovery apply requires scan.changed_paths.', 2);
  }

  return {
    mode,
    changedPaths,
    languageFilters: Array.isArray(scan.language_filters) ? scan.language_filters : [],
    includeFilters: Array.isArray(scan.include_filters) ? scan.include_filters : [],
    excludeFilters: Array.isArray(scan.exclude_filters) ? scan.exclude_filters : [],
  };
}

function normalizeOriginPriority(value, originType) {
  const defaultPriority = originType === 'external' ? 50 : 100;
  const normalizePriority = (rawValue) => {
    const priority = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(priority)) {
      throw new ToolCatalogError('origin_priority priority must be an integer.', 2);
    }
    return priority;
  };

  if (value === null || value === undefined) {
    return {
      priority: defaultPriority,
      reason: originType === 'external' ? 'Observed external utility usage.' : 'Project-owned utility artifact.',
    };
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return {
      priority: normalizePriority(value),
      reason: null,
    };
  }
  if (isPlainObject(value)) {
    return {
      priority: normalizePriority(value.priority ?? defaultPriority),
      reason: truncateText(value.reason, MAX_SUMMARY_CHARS),
    };
  }

  throw new ToolCatalogError('origin_priority must be a number, string, object, or null.', 2);
}

function normalizeUtilityOrigin(candidate) {
  const originType = normalizeNullableString(candidate.origin_type ?? candidate.origin) ?? 'project';
  const originKey = normalizeNullableString(candidate.origin_key)
    ?? (originType === 'project' ? `project:${candidate.module_path ?? 'root'}` : originType);
  const displayName = normalizeNullableString(candidate.origin_display_name)
    ?? (originType === 'project' ? `Project ${candidate.module_path ?? 'root'}` : originKey);

  return {
    originKey,
    originType,
    displayName,
    modulePath: normalizeNullableString(candidate.module_path),
    sourceAnchor: candidate.source_anchor,
    summary: truncateText(candidate.origin_summary ?? `${displayName} provides reusable catalog utilities.`, MAX_SUMMARY_CHARS),
    priority: normalizeOriginPriority(candidate.origin_priority, originType),
  };
}

function normalizeUtilityMember(rawMember, artifact) {
  if (!isPlainObject(rawMember)) {
    throw new ToolCatalogError(`Member for ${artifact.candidateId} must be an object.`, 2);
  }

  const name = normalizeNullableString(rawMember.name);
  if (!name) {
    throw new ToolCatalogError(`Member for ${artifact.candidateId} must include name.`, 2);
  }
  const memberKey = normalizeNullableString(rawMember.member_key) ?? `${artifact.artifactKey}#${name}`;
  const memberType = normalizeNullableString(rawMember.member_type) ?? 'member';
  const signatures = normalizeUtilityMemberSignatures(rawMember, memberKey, name);
  const sourceAnchor = signatures[0].sourceAnchor;
  const snippet = truncateText(rawMember.snippet, MAX_SNIPPET_CHARS) ?? signatures[0].snippet;

  return {
    memberKey,
    name,
    memberType,
    signature: signatures[0].signature,
    sourceAnchor,
    summary: normalizeRequiredText(rawMember.summary ?? rawMember.catalog_prose ?? rawMember.description, `Accepted artifact member ${memberKey} summary`),
    usageNotes: truncateText(rawMember.usage_notes, MAX_SUMMARY_CHARS),
    limitations: truncateText(rawMember.limitations, MAX_SUMMARY_CHARS),
    capabilityTags: normalizeCapabilityTags(rawMember.capability_tags ?? rawMember.tags, `Accepted artifact member ${memberKey} capability_tags`),
    snippet,
    signatures,
  };
}

function normalizeUtilityMemberSignatures(rawMember, memberKey, memberName) {
  const rawSignatures = Array.isArray(rawMember.signatures) && rawMember.signatures.length > 0
    ? rawMember.signatures
    : [{
      signature: rawMember.signature ?? memberName,
      source_anchor: rawMember.source_anchor,
      snippet: rawMember.snippet,
    }];
  const signatures = [];
  const seen = new Set();

  rawSignatures.forEach((rawSignature, index) => {
    const fieldPrefix = `Accepted artifact member ${memberKey} signatures[${index}]`;
    const signatureValue = isPlainObject(rawSignature) ? rawSignature.signature : rawSignature;
    const sourceAnchorValue = isPlainObject(rawSignature) ? rawSignature.source_anchor : rawMember.source_anchor;
    const snippetValue = isPlainObject(rawSignature) ? rawSignature.snippet : rawMember.snippet;
    const signature = normalizeRequiredText(signatureValue, `${fieldPrefix} signature`);
    const sourceAnchor = normalizeSourceAnchor(sourceAnchorValue, `${memberKey}#${index + 1}`, `${fieldPrefix} source_anchor`);
    const snippet = truncateText(snippetValue, MAX_SNIPPET_CHARS);
    const dedupeKey = `${sourceAnchor.text}::${signature}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    signatures.push({
      signature,
      sourceAnchor,
      snippet,
    });
  });

  if (signatures.length === 0) {
    throw new ToolCatalogError(`Accepted artifact member ${memberKey} must include at least one signature.`, 2);
  }

  return signatures;
}

function mergeCapabilityTagLists(existingTags, incomingTags) {
  const byTag = new Map();
  for (const tag of [...(existingTags ?? []), ...(incomingTags ?? [])]) {
    if (!tag?.tag) {
      continue;
    }
    const existing = byTag.get(tag.tag);
    byTag.set(tag.tag, {
      tag: tag.tag,
      description: tag.description ?? existing?.description ?? null,
    });
  }
  return [...byTag.values()];
}

function mergeMemberSignatures(existingSignatures, incomingSignatures) {
  const merged = [];
  const seen = new Set();

  for (const signature of [...(existingSignatures ?? []), ...(incomingSignatures ?? [])]) {
    if (!signature?.signature || !signature?.sourceAnchor?.text) {
      continue;
    }
    const key = `${signature.sourceAnchor.text}::${signature.signature}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(signature);
  }

  return merged;
}

function aggregateUtilityMembers(rawMembers, artifact) {
  const groupedMembers = new Map();

  for (const rawMember of rawMembers) {
    const normalized = normalizeUtilityMember(rawMember, artifact);
    const existing = groupedMembers.get(normalized.memberKey);
    if (!existing) {
      groupedMembers.set(normalized.memberKey, normalized);
      continue;
    }
    if (existing.name !== normalized.name || existing.memberType !== normalized.memberType) {
      throw new ToolCatalogError(`Accepted artifact member ${normalized.memberKey} has conflicting logical member metadata.`, 2);
    }

    existing.summary = existing.summary ?? normalized.summary;
    existing.usageNotes = existing.usageNotes ?? normalized.usageNotes;
    existing.limitations = existing.limitations ?? normalized.limitations;
    existing.snippet = existing.snippet ?? normalized.snippet;
    existing.capabilityTags = mergeCapabilityTagLists(existing.capabilityTags, normalized.capabilityTags);
    existing.signatures = mergeMemberSignatures(existing.signatures, normalized.signatures);
    existing.signature = existing.signatures[0].signature;
    existing.sourceAnchor = existing.signatures[0].sourceAnchor;
  }

  return [...groupedMembers.values()];
}

function normalizeUtilityArtifact(candidate) {
  const name = normalizeNullableString(candidate.name ?? candidate.qualified_name);
  if (!name) {
    throw new ToolCatalogError(`Accepted utility artifact ${candidate.candidate_id} must include name.`, 2);
  }
  const artifactKey = normalizeNullableString(candidate.artifact_key ?? candidate.candidate_id);
  const sourceAnchor = normalizeSourceAnchor(candidate.source_anchor, candidate.qualified_name ?? name, `${candidate.candidate_id} source_anchor`);
  const artifact = {
    candidateId: candidate.candidate_id,
    artifactKey,
    artifactType: normalizeNullableString(candidate.artifact_type) ?? 'utility_artifact',
    name,
    language: normalizeNullableString(candidate.language),
    framework: normalizeNullableString(candidate.framework),
    modulePath: normalizeNullableString(candidate.module_path),
    sourceAnchor,
    summary: normalizeRequiredText(candidate.summary ?? candidate.catalog_prose ?? candidate.description, `Accepted utility artifact ${candidate.candidate_id} summary`),
    usageNotes: truncateText(candidate.usage_notes, MAX_SUMMARY_CHARS),
    limitations: truncateText(candidate.limitations, MAX_SUMMARY_CHARS),
    capabilityTags: normalizeCapabilityTags(candidate.capability_tags ?? candidate.tags, `Accepted utility artifact ${candidate.candidate_id} capability_tags`),
    snippet: truncateText(candidate.snippet, MAX_SNIPPET_CHARS),
    discoveryFingerprint: normalizeNullableString(candidate.discovery_fingerprint),
  };
  const members = Array.isArray(candidate.members) ? aggregateUtilityMembers(candidate.members, artifact) : [];
  if (members.length === 0) {
    throw new ToolCatalogError(`Accepted utility artifact ${candidate.candidate_id} must include at least one member.`, 2);
  }

  return {
    ...artifact,
    origin: normalizeUtilityOrigin({ ...candidate, source_anchor: sourceAnchor }),
    members,
  };
}

function normalizeTemplateInstance(rawInstance, pattern) {
  if (!isPlainObject(rawInstance)) {
    throw new ToolCatalogError(`Template instance for ${pattern.candidateId} must be an object.`, 2);
  }
  const sourceAnchor = normalizeSourceAnchor(rawInstance.source_anchor, pattern.patternKey, `template ${pattern.patternKey} instance source_anchor`);

  return {
    sourceAnchor,
    modulePath: normalizeNullableString(rawInstance.module_path),
    snippet: truncateText(rawInstance.snippet, MAX_SNIPPET_CHARS),
  };
}

function normalizeTemplatePattern(candidate) {
  const patternKey = normalizeNullableString(candidate.pattern_key)
    ?? normalizeNullableString(candidate.candidate_id)?.replace(/^template-pattern:/, '');
  if (!patternKey) {
    throw new ToolCatalogError(`Accepted template pattern ${candidate.candidate_id} must include pattern_key.`, 2);
  }
  const name = normalizeNullableString(candidate.name) ?? patternKey;
  const pattern = {
    candidateId: candidate.candidate_id,
    patternKey,
    name,
    language: normalizeNullableString(candidate.language),
    framework: normalizeNullableString(candidate.framework),
    modulePath: normalizeNullableString(candidate.module_path),
    summary: normalizeRequiredText(candidate.summary ?? candidate.catalog_prose ?? candidate.description, `Accepted template pattern ${candidate.candidate_id} summary`),
    usageNotes: truncateText(candidate.usage_notes, MAX_SUMMARY_CHARS),
    limitations: truncateText(candidate.limitations, MAX_SUMMARY_CHARS),
    capabilityTags: normalizeCapabilityTags(candidate.capability_tags ?? candidate.tags, `Accepted template pattern ${candidate.candidate_id} capability_tags`),
    snippet: truncateText(candidate.snippet, MAX_SNIPPET_CHARS),
    discoveryFingerprint: normalizeNullableString(candidate.discovery_fingerprint),
  };
  const instances = Array.isArray(candidate.instances) ? candidate.instances.map((instance) => normalizeTemplateInstance(instance, pattern)) : [];
  if (instances.length === 0) {
    throw new ToolCatalogError(`Accepted template pattern ${candidate.candidate_id} must include representative instances.`, 2);
  }

  return {
    ...pattern,
    modulePath: pattern.modulePath ?? instances[0].modulePath,
    instances,
  };
}

function normalizeObservedExternalUsage(candidate) {
  const originKey = normalizeNullableString(candidate.origin_key);
  if (!originKey) {
    throw new ToolCatalogError(`Accepted observed external usage ${candidate.candidate_id} must include origin_key.`, 2);
  }
  const sourceAnchor = normalizeSourceAnchor(candidate.source_anchor, originKey, `${candidate.candidate_id} source_anchor`);
  const origin = normalizeUtilityOrigin({
    ...candidate,
    origin: 'external',
    origin_key: originKey,
    origin_display_name: candidate.origin_display_name ?? originKey,
    source_anchor: sourceAnchor,
  });

  return {
    candidateId: candidate.candidate_id,
    usageKey: normalizeNullableString(candidate.usage_key ?? candidate.candidate_id),
    origin,
    language: normalizeNullableString(candidate.language),
    framework: normalizeNullableString(candidate.framework),
    sourceAnchor,
    importText: truncateText(candidate.import_text, MAX_SNIPPET_CHARS),
    callText: truncateText(candidate.call_text, MAX_SNIPPET_CHARS),
    discoveryFingerprint: normalizeNullableString(candidate.discovery_fingerprint),
  };
}

function firstCandidateAnchor(candidate) {
  if (candidate.source_anchor) {
    return candidate.source_anchor;
  }
  if (Array.isArray(candidate.instances) && candidate.instances[0]?.source_anchor) {
    return candidate.instances[0].source_anchor;
  }
  if (candidate.call_anchor) {
    return candidate.call_anchor;
  }

  return null;
}

function normalizeIgnoredCandidate(candidate) {
  const candidateId = normalizeNullableString(candidate.candidate_id);
  const candidateType = normalizeNullableString(candidate.candidate_type) ?? 'unknown';
  const sourceAnchor = normalizeSourceAnchor(firstCandidateAnchor(candidate), candidateId, `${candidateId} source_anchor`);

  return {
    candidateId,
    candidateType,
    artifactKey: normalizeNullableString(candidate.artifact_key ?? candidate.candidate_id),
    patternKey: normalizeNullableString(candidate.pattern_key)
      ?? (candidateType === 'template_pattern' ? candidateId.replace(/^template-pattern:/, '') : null),
    usageKey: normalizeNullableString(candidate.usage_key ?? candidate.candidate_id),
    sourceAnchor,
    discoveryFingerprint: normalizeNullableString(candidate.discovery_fingerprint),
    reason: truncateText(candidate.reason ?? candidate.ignore_reason ?? 'Ignored by discovery apply decision.', MAX_SUMMARY_CHARS),
  };
}

function normalizeDeferredCandidate(candidate) {
  const candidateId = normalizeNullableString(candidate.candidate_id);
  const candidateType = normalizeNullableString(candidate.candidate_type) ?? 'unknown';
  const sourceAnchor = normalizeSourceAnchor(firstCandidateAnchor(candidate), candidateId, `${candidateId} source_anchor`);

  return {
    candidateId,
    candidateType,
    artifactKey: normalizeNullableString(candidate.artifact_key ?? candidate.candidate_id),
    patternKey: normalizeNullableString(candidate.pattern_key)
      ?? (candidateType === 'template_pattern' ? candidateId.replace(/^template-pattern:/, '') : null),
    usageKey: normalizeNullableString(candidate.usage_key ?? candidate.candidate_id),
    sourceAnchor,
    discoveryFingerprint: normalizeNullableString(candidate.discovery_fingerprint),
    reason: truncateText(candidate.reason ?? candidate.defer_reason ?? candidate.question ?? 'Deferred by discovery apply decision.', MAX_SUMMARY_CHARS),
  };
}

function hasSelectionDescription(value) {
  return Object.hasOwn(value, 'summary') || Object.hasOwn(value, 'catalog_prose') || Object.hasOwn(value, 'description');
}

function mergeCandidateMembers(candidateMembers, decisionMembers) {
  if (!Array.isArray(decisionMembers)) {
    return candidateMembers;
  }
  if (!Array.isArray(candidateMembers)) {
    return decisionMembers;
  }

  const decisionByKey = new Map();
  for (const member of decisionMembers) {
    const key = normalizeNullableString(member.member_key) ?? normalizeNullableString(member.name);
    if (key) {
      decisionByKey.set(key, member);
    }
  }

  return candidateMembers.map((member) => {
    const key = normalizeNullableString(member.member_key) ?? normalizeNullableString(member.name);
    const byKey = key ? decisionByKey.get(key) : null;
    const byName = normalizeNullableString(member.name) ? decisionByKey.get(normalizeNullableString(member.name)) : null;
    const decision = byKey ?? byName;
    if (!decision) {
      return member;
    }
    const merged = { ...member, ...decision };
    if (!hasSelectionDescription(decision)) {
      delete merged.summary;
      delete merged.catalog_prose;
      delete merged.description;
    }
    return merged;
  });
}

function mergeCandidateDecision(candidate, decision) {
  if (!decision) {
    return candidate;
  }

  const merged = {
    ...candidate,
    ...decision,
    candidate_id: candidate.candidate_id,
    candidate_type: decision.candidate_type ?? candidate.candidate_type,
    source_anchor: decision.source_anchor ?? candidate.source_anchor,
    members: mergeCandidateMembers(candidate.members, decision.members),
    instances: decision.instances ?? candidate.instances,
  };
  if (!hasSelectionDescription(decision)) {
    delete merged.summary;
    delete merged.catalog_prose;
    delete merged.description;
  }

  return merged;
}

function normalizeExplicitOriginPriorities(input) {
  if (!input.origin_priorities) {
    return [];
  }
  if (!Array.isArray(input.origin_priorities)) {
    throw new ToolCatalogError('origin_priorities must be an array.', 2);
  }

  return input.origin_priorities.map((item) => {
    if (!isPlainObject(item)) {
      throw new ToolCatalogError('Each origin priority must be an object.', 2);
    }
    const originKey = normalizeNullableString(item.origin_key);
    if (!originKey) {
      throw new ToolCatalogError('Each origin priority must include origin_key.', 2);
    }
    const originType = normalizeNullableString(item.origin_type) ?? 'project';
    const priority = normalizeOriginPriority(item.priority ?? item.origin_priority, originType);

    return {
      originKey,
      originType,
      displayName: normalizeNullableString(item.display_name) ?? originKey,
      modulePath: normalizeNullableString(item.module_path),
      sourceAnchor: item.source_anchor ? normalizeSourceAnchor(item.source_anchor, originKey, `origin ${originKey} source_anchor`) : null,
      summary: truncateText(item.summary, MAX_SUMMARY_CHARS),
      priority: {
        priority: priority.priority,
        reason: truncateText(item.reason ?? priority.reason, MAX_SUMMARY_CHARS),
      },
    };
  });
}

function normalizeApplyDecisions(input) {
  if (!isPlainObject(input)) {
    throw new ToolCatalogError('Discovery decisions JSON must be an object.', 2);
  }
  if (input.failed === true || input.extraction_failed === true || input.status === 'failed') {
    throw new ToolCatalogError('Refusing to apply failed discovery or extraction results.', 2);
  }

  const scope = normalizeApplyScope(input);
  const candidates = collectApplyCandidates(input);
  const overrides = parseDecisionOverrides(input.decisions);
  const finalAcceptedEntries = collectFinalAcceptedEntries(input);
  const ignoredDecisionEntries = collectTraceableDecisionArray(input.ignored_candidates, 'ignored_candidates');
  const deferredDecisionEntries = collectTraceableDecisionArray(input.deferred_candidates, 'deferred_candidates');
  const normalized = {
    scope,
    acceptedUtilities: [],
    acceptedTemplates: [],
    acceptedExternalUsages: [],
    ignoredCandidates: [],
    deferredCandidates: [],
    requiredDecisions: [],
    explicitOriginPriorities: normalizeExplicitOriginPriorities(input),
    protectedUtilityKeys: new Set(),
    protectedTemplateKeys: new Set(),
    protectedExternalUsageKeys: new Set(),
  };
  const resolvedCandidateIds = new Set();

  const protectCandidate = (candidateType, candidate) => {
    if (candidateType === 'utility_artifact') {
      normalized.protectedUtilityKeys.add(normalizeNullableString(candidate.artifactKey ?? candidate.artifact_key ?? candidate.candidate_id));
    } else if (candidateType === 'template_pattern') {
      normalized.protectedTemplateKeys.add(normalizeNullableString(candidate.patternKey ?? candidate.pattern_key) ?? normalizeNullableString(candidate.candidate_id)?.replace(/^template-pattern:/, ''));
    } else if (candidateType === 'observed_external_usage') {
      normalized.protectedExternalUsageKeys.add(normalizeNullableString(candidate.usageKey ?? candidate.usage_key ?? candidate.candidate_id));
    }
  };

  for (const entry of finalAcceptedEntries) {
    const candidateId = finalAcceptedCandidateId(entry);
    if (!candidateId) {
      throw new ToolCatalogError('Each accepted entry must include candidate_id, artifact_key, pattern_key, or usage_key.', 2);
    }
    const rawCandidate = candidates.get(candidateId);
    const merged = rawCandidate ? mergeCandidateDecision(rawCandidate, entry) : {
      ...entry,
      candidate_id: candidateId,
      candidate_type: entry.candidate_type ?? entry.entry_type,
    };

    if (merged.candidate_type === 'utility_artifact') {
      const artifact = normalizeUtilityArtifact(merged);
      normalized.acceptedUtilities.push(artifact);
      normalized.protectedUtilityKeys.add(artifact.artifactKey);
    } else if (merged.candidate_type === 'template_pattern') {
      const pattern = normalizeTemplatePattern(merged);
      normalized.acceptedTemplates.push(pattern);
      normalized.protectedTemplateKeys.add(pattern.patternKey);
    } else if (merged.candidate_type === 'observed_external_usage') {
      const usage = normalizeObservedExternalUsage(merged);
      normalized.acceptedExternalUsages.push(usage);
      normalized.protectedExternalUsageKeys.add(usage.usageKey);
    } else {
      throw new ToolCatalogError(`Unsupported accepted entry type '${merged.candidate_type}' for ${candidateId}.`, 2);
    }
    resolvedCandidateIds.add(candidateId);
  }

  for (const item of ignoredDecisionEntries) {
    const candidateId = normalizeNullableString(item.candidate_id);
    if (!candidateId) {
      throw new ToolCatalogError('Each ignored candidate decision must include candidate_id.', 2);
    }
    const merged = candidates.has(candidateId) ? mergeCandidateDecision(candidates.get(candidateId), item) : item;
    const ignored = normalizeIgnoredCandidate(merged);
    normalized.ignoredCandidates.push(ignored);
    protectCandidate(ignored.candidateType, ignored);
    resolvedCandidateIds.add(candidateId);
  }

  for (const item of deferredDecisionEntries) {
    const candidateId = normalizeNullableString(item.candidate_id);
    if (!candidateId) {
      throw new ToolCatalogError('Each deferred candidate decision must include candidate_id.', 2);
    }
    const merged = candidates.has(candidateId) ? mergeCandidateDecision(candidates.get(candidateId), item) : item;
    const deferred = normalizeDeferredCandidate(merged);
    normalized.deferredCandidates.push(deferred);
    protectCandidate(deferred.candidateType, deferred);
    resolvedCandidateIds.add(candidateId);
  }

  for (const [candidateId, candidate] of candidates.entries()) {
    if (resolvedCandidateIds.has(candidateId)) {
      continue;
    }
    const decision = overrides.get(candidateId);
    const merged = mergeCandidateDecision(candidate, decision);
    const action = normalizeDecisionAction(decision?.action ?? candidate.action ?? candidate.decision);

    if (action === 'accept') {
      if (merged.candidate_type === 'utility_artifact') {
        const artifact = normalizeUtilityArtifact(merged);
        normalized.acceptedUtilities.push(artifact);
        normalized.protectedUtilityKeys.add(artifact.artifactKey);
      } else if (merged.candidate_type === 'template_pattern') {
        const pattern = normalizeTemplatePattern(merged);
        normalized.acceptedTemplates.push(pattern);
        normalized.protectedTemplateKeys.add(pattern.patternKey);
      } else if (merged.candidate_type === 'observed_external_usage') {
        const usage = normalizeObservedExternalUsage(merged);
        normalized.acceptedExternalUsages.push(usage);
        normalized.protectedExternalUsageKeys.add(usage.usageKey);
      } else {
        throw new ToolCatalogError(`Unsupported accepted candidate_type '${merged.candidate_type}' for ${candidateId}.`, 2);
      }
      continue;
    }

    if (action === 'ignore') {
      const ignored = normalizeIgnoredCandidate(merged);
      normalized.ignoredCandidates.push(ignored);
      protectCandidate(ignored.candidateType, ignored);
      continue;
    }

    if (action === 'defer') {
      const deferred = normalizeDeferredCandidate(merged);
      normalized.deferredCandidates.push(deferred);
      protectCandidate(deferred.candidateType, deferred);
      continue;
    }

    normalized.requiredDecisions.push({
      candidate_id: candidateId,
      candidate_type: merged.candidate_type ?? 'unknown',
      action: action ?? 'missing',
      reason: 'Candidate was not accepted, ignored, or deferred.',
    });

    if (merged.candidate_type === 'utility_artifact') {
      normalized.protectedUtilityKeys.add(normalizeNullableString(merged.artifact_key ?? merged.candidate_id));
    } else if (merged.candidate_type === 'template_pattern') {
      normalized.protectedTemplateKeys.add(normalizeNullableString(merged.pattern_key) ?? merged.candidate_id.replace(/^template-pattern:/, ''));
    } else if (merged.candidate_type === 'observed_external_usage') {
      normalized.protectedExternalUsageKeys.add(normalizeNullableString(merged.usage_key ?? merged.candidate_id));
    }
  }

  for (const [candidateId, decision] of overrides.entries()) {
    if (candidates.has(candidateId) || resolvedCandidateIds.has(candidateId)) {
      continue;
    }
    const action = normalizeDecisionAction(decision.action);
    if (action === 'ignore') {
      const ignored = normalizeIgnoredCandidate(decision);
      normalized.ignoredCandidates.push(ignored);
      protectCandidate(ignored.candidateType, ignored);
      continue;
    }
    if (action === 'accept') {
      throw new ToolCatalogError(`Accepted decision ${candidateId} is missing its candidate payload.`, 2);
    }
    if (action === 'defer') {
      const deferred = normalizeDeferredCandidate(decision);
      normalized.deferredCandidates.push(deferred);
      protectCandidate(deferred.candidateType, deferred);
      continue;
    }
    normalized.requiredDecisions.push({
      candidate_id: candidateId,
      candidate_type: normalizeNullableString(decision.candidate_type) ?? 'unknown',
      action: action ?? 'missing',
      reason: 'Decision has no matching candidate payload.',
    });
  }

  return normalized;
}

function sourceAnchorValueSql(anchor) {
  return anchor ? sourceAnchorSql(anchor) : 'NULL';
}

function sourceAnchorPathSql(columnName) {
  return `CASE WHEN json_valid(${columnName}) THEN json_extract(${columnName}, '$.path') ELSE ${columnName} END`;
}

function sourceAnchorTextSql(columnName) {
  return `CASE
    WHEN json_valid(${columnName}) THEN json_extract(${columnName}, '$.path') || ':' || COALESCE(json_extract(${columnName}, '$.line'), 1) || '#' || COALESCE(json_extract(${columnName}, '$.symbol'), '')
    ELSE ${columnName}
  END`;
}

function pathScopeCondition(pathExpression, scope) {
  if (scope.mode === 'full') {
    return '1 = 1';
  }

  const conditions = scope.changedPaths.map((item) => {
    const exactPath = `${pathExpression} = ${sqlString(item.path)}`;
    if (!item.isDirectory) {
      return exactPath;
    }

    return `(${exactPath} OR ${pathExpression} LIKE ${sqlString(`${item.path.replace(/\/+$/, '')}/%`)})`;
  });

  return conditions.length > 0 ? `(${conditions.join(' OR ')})` : '0 = 1';
}

function artifactIdSql(projectId, artifactKey) {
  return `(SELECT id FROM artifacts WHERE project_id = ${sqlString(projectId)} AND artifact_key = ${sqlString(artifactKey)})`;
}

function patternIdSql(projectId, patternKey) {
  return `(SELECT id FROM template_patterns WHERE project_id = ${sqlString(projectId)} AND pattern_key = ${sqlString(patternKey)})`;
}

function memberIdSql(projectId, artifactKey, memberKey) {
  return `(SELECT artifact_members.id
FROM artifact_members
JOIN artifacts ON artifacts.id = artifact_members.artifact_id
WHERE artifacts.project_id = ${sqlString(projectId)}
  AND artifacts.artifact_key = ${sqlString(artifactKey)}
  AND artifact_members.member_key = ${sqlString(memberKey)})`;
}

function resetMemberSignaturesSql(memberId, signatures) {
  const statements = [`
DELETE FROM member_signatures
WHERE member_id = ${memberId};
`];

  for (const signature of signatures) {
    statements.push(`
INSERT INTO member_signatures (
  member_id, signature, source_anchor, updated_at
) VALUES (
  ${memberId},
  ${sqlString(signature.signature)},
  ${sourceAnchorSql(signature.sourceAnchor)},
  datetime('now')
) ON CONFLICT(member_id, source_anchor) DO UPDATE SET
  signature = excluded.signature,
  updated_at = datetime('now');
`);
  }

  return statements.join('\n');
}

function upsertOriginSql(projectId, origin) {
  return `
INSERT INTO utility_origins (
  project_id, origin_key, origin_type, display_name, module_path, source_anchor, summary, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(origin.originKey)},
  ${sqlString(origin.originType)},
  ${sqlString(origin.displayName)},
  ${sqlString(origin.modulePath)},
  ${sourceAnchorValueSql(origin.sourceAnchor)},
  ${sqlString(origin.summary)},
  datetime('now')
) ON CONFLICT(project_id, origin_key) DO UPDATE SET
  origin_type = excluded.origin_type,
  display_name = excluded.display_name,
  module_path = excluded.module_path,
  source_anchor = excluded.source_anchor,
  summary = excluded.summary,
  updated_at = datetime('now');
`;
}

function upsertOriginPrioritySql(projectId, origin) {
  return `
INSERT INTO origin_priorities (
  project_id, origin_id, priority, reason, updated_at
)
SELECT
  ${sqlString(projectId)},
  id,
  ${sqlInteger(origin.priority.priority)},
  ${sqlString(origin.priority.reason)},
  datetime('now')
FROM utility_origins
WHERE project_id = ${sqlString(projectId)}
  AND origin_key = ${sqlString(origin.originKey)}
ON CONFLICT(project_id, origin_id) DO UPDATE SET
  priority = excluded.priority,
  reason = excluded.reason,
  updated_at = datetime('now');
`;
}

function capabilityTagTexts(tags) {
  return tags.map((tag) => tag.tag).join('\n');
}

function upsertCapabilityTagSql(projectId, tag) {
  return `
INSERT INTO capability_tags (
  project_id, tag, description, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(tag.tag)},
  ${sqlString(tag.description)},
  datetime('now')
) ON CONFLICT(project_id, tag) DO UPDATE SET
  description = COALESCE(excluded.description, capability_tags.description),
  updated_at = datetime('now');
`;
}

function resetEntryCapabilityTagsSql(projectId, entryType, entryIdSql, tags) {
  const statements = [`
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = ${sqlString(entryType)}
  AND entry_id = ${entryIdSql};
`];

  for (const tag of tags) {
    statements.push(upsertCapabilityTagSql(projectId, tag));
    statements.push(`
INSERT OR IGNORE INTO entry_capability_tags (
  project_id, entry_type, entry_id, tag_id
)
SELECT
  ${sqlString(projectId)},
  ${sqlString(entryType)},
  ${entryIdSql},
  id
FROM capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND tag = ${sqlString(tag.tag)};
`);
  }

  return statements.join('\n');
}

function upsertArtifactSql(projectId, artifact) {
  const artifactId = artifactIdSql(projectId, artifact.artifactKey);
  const memberKeys = sqlStringList(artifact.members.map((member) => member.memberKey));
  const deleteMemberFilter = memberKeys ? `AND member_key NOT IN (${memberKeys})` : '';
  const statements = [
    upsertOriginSql(projectId, artifact.origin),
    upsertOriginPrioritySql(projectId, artifact.origin),
    `
INSERT INTO artifacts (
  project_id, origin_id, artifact_key, artifact_type, name, language, framework, module_path, source_anchor, summary, usage_notes, limitations, snippet, updated_at
) VALUES (
  ${sqlString(projectId)},
  (SELECT id FROM utility_origins WHERE project_id = ${sqlString(projectId)} AND origin_key = ${sqlString(artifact.origin.originKey)}),
  ${sqlString(artifact.artifactKey)},
  ${sqlString(artifact.artifactType)},
  ${sqlString(artifact.name)},
  ${sqlString(artifact.language)},
  ${sqlString(artifact.framework)},
  ${sqlString(artifact.modulePath)},
  ${sourceAnchorSql(artifact.sourceAnchor)},
  ${sqlString(artifact.summary)},
  ${sqlString(artifact.usageNotes)},
  ${sqlString(artifact.limitations)},
  ${sqlString(artifact.snippet)},
  datetime('now')
) ON CONFLICT(project_id, artifact_key) DO UPDATE SET
  origin_id = excluded.origin_id,
  artifact_type = excluded.artifact_type,
  name = excluded.name,
  language = excluded.language,
  framework = excluded.framework,
  module_path = excluded.module_path,
  source_anchor = excluded.source_anchor,
  summary = excluded.summary,
  usage_notes = excluded.usage_notes,
  limitations = excluded.limitations,
  snippet = excluded.snippet,
  updated_at = datetime('now');
`,
    resetEntryCapabilityTagsSql(projectId, 'artifact', artifactId, artifact.capabilityTags),
    `
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND artifact_id = ${artifactId};
`,
    `
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'member'
  AND entry_id IN (
    SELECT id FROM artifact_members
    WHERE artifact_id = ${artifactId}
      ${deleteMemberFilter}
  );
`,
    `
DELETE FROM artifact_members
WHERE artifact_id = ${artifactId}
  ${deleteMemberFilter};
`,
  ];

  for (const member of artifact.members) {
    const memberId = memberIdSql(projectId, artifact.artifactKey, member.memberKey);
    const body = [
      artifact.summary,
      artifact.usageNotes,
      artifact.limitations,
      capabilityTagTexts(member.capabilityTags),
      member.summary,
      member.usageNotes,
      member.limitations,
      ...member.signatures.map((signature) => signature.signature),
      artifact.language,
      artifact.framework,
      artifact.modulePath,
      artifact.origin.displayName,
    ].filter(Boolean).join('\n');
    statements.push(`
INSERT INTO artifact_members (
  artifact_id, member_key, name, member_type, signature, source_anchor, summary, usage_notes, limitations, snippet, updated_at
) VALUES (
  ${artifactId},
  ${sqlString(member.memberKey)},
  ${sqlString(member.name)},
  ${sqlString(member.memberType)},
  ${sqlString(member.signature)},
  ${sourceAnchorSql(member.sourceAnchor)},
  ${sqlString(member.summary)},
  ${sqlString(member.usageNotes)},
  ${sqlString(member.limitations)},
  ${sqlString(member.snippet)},
  datetime('now')
) ON CONFLICT(artifact_id, member_key) DO UPDATE SET
  name = excluded.name,
  member_type = excluded.member_type,
  signature = excluded.signature,
  source_anchor = excluded.source_anchor,
  summary = excluded.summary,
  usage_notes = excluded.usage_notes,
  limitations = excluded.limitations,
  snippet = excluded.snippet,
  updated_at = datetime('now');
`);
    statements.push(resetMemberSignaturesSql(memberId, member.signatures));
    statements.push(resetEntryCapabilityTagsSql(projectId, 'member', memberId, member.capabilityTags));
    statements.push(`
INSERT INTO fts_entries (
  project_id, entry_type, artifact_id, member_id, title, body, source_anchor
) VALUES (
  ${sqlString(projectId)},
  'member',
  ${artifactId},
  ${memberId},
  ${sqlString(`${artifact.name}.${member.name}`)},
  ${sqlString(body)},
  ${sqlString(member.sourceAnchor.text)}
);
`);
  }

  const artifactBody = [
    artifact.summary,
    artifact.usageNotes,
    artifact.limitations,
    capabilityTagTexts(artifact.capabilityTags),
    artifact.language,
    artifact.framework,
    artifact.modulePath,
    artifact.origin.displayName,
    artifact.members.map((member) => `${member.name} ${member.signatures.map((signature) => signature.signature).join(' | ')}`).join('\n'),
  ].filter(Boolean).join('\n');
  statements.push(`
INSERT INTO fts_entries (
  project_id, entry_type, artifact_id, title, body, source_anchor
) VALUES (
  ${sqlString(projectId)},
  'artifact',
  ${artifactId},
  ${sqlString(artifact.name)},
  ${sqlString(artifactBody)},
  ${sqlString(artifact.sourceAnchor.text)}
);
`);

  return statements.join('\n');
}

function upsertTemplateSql(projectId, pattern) {
  const patternId = patternIdSql(projectId, pattern.patternKey);
  const instanceAnchors = sqlStringList(pattern.instances.map((instance) => JSON.stringify(instance.sourceAnchor)));
  const deleteInstanceFilter = instanceAnchors ? `AND source_anchor NOT IN (${instanceAnchors})` : '';
  const statements = [
    `
INSERT INTO template_patterns (
  project_id, pattern_key, name, language, framework, module_path, summary, usage_notes, limitations, snippet, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(pattern.patternKey)},
  ${sqlString(pattern.name)},
  ${sqlString(pattern.language)},
  ${sqlString(pattern.framework)},
  ${sqlString(pattern.modulePath)},
  ${sqlString(pattern.summary)},
  ${sqlString(pattern.usageNotes)},
  ${sqlString(pattern.limitations)},
  ${sqlString(pattern.snippet)},
  datetime('now')
) ON CONFLICT(project_id, pattern_key) DO UPDATE SET
  name = excluded.name,
  language = excluded.language,
  framework = excluded.framework,
  module_path = excluded.module_path,
  summary = excluded.summary,
  usage_notes = excluded.usage_notes,
  limitations = excluded.limitations,
  snippet = excluded.snippet,
  updated_at = datetime('now');
`,
    resetEntryCapabilityTagsSql(projectId, 'template_pattern', patternId, pattern.capabilityTags),
    `
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND pattern_id = ${patternId};
`,
    `
DELETE FROM template_instances
WHERE pattern_id = ${patternId}
  ${deleteInstanceFilter};
`,
  ];

  for (const instance of pattern.instances) {
    statements.push(`
INSERT INTO template_instances (
  pattern_id, source_anchor, module_path, snippet, updated_at
) VALUES (
  ${patternId},
  ${sourceAnchorSql(instance.sourceAnchor)},
  ${sqlString(instance.modulePath)},
  ${sqlString(instance.snippet)},
  datetime('now')
) ON CONFLICT(pattern_id, source_anchor) DO UPDATE SET
  module_path = excluded.module_path,
  snippet = excluded.snippet,
  updated_at = datetime('now');
`);
  }

  const body = [
    pattern.summary,
    pattern.usageNotes,
    pattern.limitations,
    capabilityTagTexts(pattern.capabilityTags),
    pattern.language,
    pattern.framework,
    pattern.modulePath,
    pattern.instances.map((instance) => instance.sourceAnchor.text).join('\n'),
  ].filter(Boolean).join('\n');
  statements.push(`
INSERT INTO fts_entries (
  project_id, entry_type, pattern_id, title, body, source_anchor
) VALUES (
  ${sqlString(projectId)},
  'template_pattern',
  ${patternId},
  ${sqlString(pattern.name)},
  ${sqlString(body)},
  ${sqlString(pattern.instances[0].sourceAnchor.text)}
);
`);

  return statements.join('\n');
}

function upsertExternalUsageSql(projectId, usage) {
  return [
    upsertOriginSql(projectId, usage.origin),
    upsertOriginPrioritySql(projectId, usage.origin),
    `
INSERT INTO observed_external_usages (
  project_id, origin_id, artifact_id, usage_key, source_anchor, import_text, call_text, language, framework, updated_at
) VALUES (
  ${sqlString(projectId)},
  (SELECT id FROM utility_origins WHERE project_id = ${sqlString(projectId)} AND origin_key = ${sqlString(usage.origin.originKey)}),
  NULL,
  ${sqlString(usage.usageKey)},
  ${sourceAnchorSql(usage.sourceAnchor)},
  ${sqlString(usage.importText)},
  ${sqlString(usage.callText)},
  ${sqlString(usage.language)},
  ${sqlString(usage.framework)},
  datetime('now')
) ON CONFLICT(project_id, usage_key) DO UPDATE SET
  origin_id = excluded.origin_id,
  source_anchor = excluded.source_anchor,
  import_text = excluded.import_text,
  call_text = excluded.call_text,
  language = excluded.language,
  framework = excluded.framework,
  updated_at = datetime('now');
`,
  ].join('\n');
}

function upsertExplicitOriginPrioritySql(projectId, origin) {
  return [
    upsertOriginSql(projectId, origin),
    upsertOriginPrioritySql(projectId, origin),
  ].join('\n');
}

function ignoredCandidateSql(projectId, candidate) {
  return `
INSERT INTO ignored_candidates (
  project_id, candidate_key, candidate_type, source_anchor, reason, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(candidate.candidateId)},
  ${sqlString(candidate.candidateType)},
  ${sourceAnchorSql(candidate.sourceAnchor)},
  ${sqlString(candidate.reason)},
  datetime('now')
) ON CONFLICT(project_id, candidate_key) DO UPDATE SET
  candidate_type = excluded.candidate_type,
  source_anchor = excluded.source_anchor,
  reason = excluded.reason,
  updated_at = datetime('now');
`;
}

function deferredCandidateSql(projectId, candidate) {
  return `
INSERT INTO deferred_candidates (
  project_id, candidate_key, candidate_type, source_anchor, reason, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(candidate.candidateId)},
  ${sqlString(candidate.candidateType)},
  ${sourceAnchorSql(candidate.sourceAnchor)},
  ${sqlString(candidate.reason)},
  datetime('now')
) ON CONFLICT(project_id, candidate_key) DO UPDATE SET
  candidate_type = excluded.candidate_type,
  source_anchor = excluded.source_anchor,
  reason = excluded.reason,
  updated_at = datetime('now');
`;
}

function discoveryFingerprintSql(projectId, record) {
  return `
INSERT INTO discovery_fingerprints (
  project_id, record_family, record_kind, record_key, source_anchor, source_paths, match_keys, structural_fingerprint, fingerprint_algorithm, updated_at
) VALUES (
  ${sqlString(projectId)},
  ${sqlString(record.recordFamily)},
  ${sqlString(record.recordKind)},
  ${sqlString(record.recordKey)},
  ${sourceAnchorSql(record.sourceAnchor)},
  ${sqlString(JSON.stringify(record.sourcePaths))},
  ${sqlString(JSON.stringify(record.matchKeys))},
  ${sqlString(record.structuralFingerprint)},
  ${sqlString(record.fingerprintAlgorithm)},
  datetime('now')
) ON CONFLICT(project_id, record_family, record_kind, record_key) DO UPDATE SET
  source_anchor = excluded.source_anchor,
  source_paths = excluded.source_paths,
  match_keys = excluded.match_keys,
  structural_fingerprint = excluded.structural_fingerprint,
  fingerprint_algorithm = excluded.fingerprint_algorithm,
  updated_at = datetime('now');
`;
}

function buildPersistedDiscoveryRecords(decisions) {
  const records = [];

  for (const artifact of decisions.acceptedUtilities) {
    records.push(persistedDiscoveryRecord('catalog_entry', 'utility_artifact', artifact.artifactKey, utilityArtifactToFindingRecord(artifact), artifact.discoveryFingerprint));
  }
  for (const pattern of decisions.acceptedTemplates) {
    records.push(persistedDiscoveryRecord('catalog_entry', 'template_pattern', pattern.patternKey, templatePatternToFindingRecord(pattern), pattern.discoveryFingerprint));
  }
  for (const usage of decisions.acceptedExternalUsages) {
    records.push(persistedDiscoveryRecord('catalog_entry', 'observed_external_usage', usage.usageKey, externalUsageToFindingRecord(usage), usage.discoveryFingerprint));
  }
  for (const ignored of decisions.ignoredCandidates) {
    records.push(persistedDiscoveryRecord('suppression', ignored.candidateType, ignored.candidateId, traceDecisionToFindingRecord(ignored), ignored.discoveryFingerprint));
  }
  for (const deferred of decisions.deferredCandidates) {
    records.push(persistedDiscoveryRecord('deferral', deferred.candidateType, deferred.candidateId, traceDecisionToFindingRecord(deferred), deferred.discoveryFingerprint));
  }

  return records;
}

function cleanupDecisionTraceSql(projectId, decisions) {
  if (decisions.requiredDecisions.length > 0) {
    return '';
  }

  const traceScope = pathScopeCondition(sourceAnchorPathSql('source_anchor'), decisions.scope);
  if (decisions.scope.mode === 'full') {
    return `
DELETE FROM ignored_candidates
WHERE project_id = ${sqlString(projectId)};
DELETE FROM deferred_candidates
WHERE project_id = ${sqlString(projectId)};
DELETE FROM discovery_fingerprints
WHERE project_id = ${sqlString(projectId)}
  AND record_family IN ('suppression', 'deferral');
`;
  }

  return `
DELETE FROM ignored_candidates
WHERE project_id = ${sqlString(projectId)}
  AND ${traceScope};
DELETE FROM deferred_candidates
WHERE project_id = ${sqlString(projectId)}
  AND ${traceScope};
DELETE FROM discovery_fingerprints
WHERE project_id = ${sqlString(projectId)}
  AND record_family IN ('suppression', 'deferral')
  AND ${pathScopeCondition(sourceAnchorPathSql('source_anchor'), decisions.scope)};
`;
}

function deleteArtifactCapabilityTagsSql(projectId, artifactId) {
  return `
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND (
    (entry_type = 'artifact' AND entry_id = ${artifactId})
    OR (entry_type = 'member' AND entry_id IN (
      SELECT id FROM artifact_members
      WHERE artifact_id = ${artifactId}
    ))
  );
`;
}

function deleteTemplateCapabilityTagsSql(projectId, patternId) {
  return `
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND entry_id = ${patternId};
`;
}

function deleteIgnoredCatalogEntrySql(projectId, candidate) {
  if (candidate.candidateType === 'utility_artifact') {
    const artifactId = artifactIdSql(projectId, candidate.artifactKey);
    return `
${deleteArtifactCapabilityTagsSql(projectId, artifactId)}
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND artifact_id = ${artifactId};
DELETE FROM artifacts
WHERE project_id = ${sqlString(projectId)}
  AND artifact_key = ${sqlString(candidate.artifactKey)};
`;
  }
  if (candidate.candidateType === 'template_pattern') {
    const patternId = patternIdSql(projectId, candidate.patternKey);
    return `
${deleteTemplateCapabilityTagsSql(projectId, patternId)}
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND pattern_id = ${patternId};
DELETE FROM template_patterns
WHERE project_id = ${sqlString(projectId)}
  AND pattern_key = ${sqlString(candidate.patternKey)};
`;
  }
  if (candidate.candidateType === 'observed_external_usage') {
    return `
DELETE FROM observed_external_usages
WHERE project_id = ${sqlString(projectId)}
  AND usage_key = ${sqlString(candidate.usageKey)};
`;
  }

  return '';
}

function cleanupCatalogSql(projectId, decisions) {
  if (decisions.requiredDecisions.length > 0) {
    return '';
  }

  const artifactScope = pathScopeCondition(sourceAnchorPathSql('source_anchor'), decisions.scope);
  const artifactScopeOnArtifacts = pathScopeCondition(sourceAnchorPathSql('artifacts.source_anchor'), decisions.scope);
  const externalScope = pathScopeCondition(sourceAnchorPathSql('source_anchor'), decisions.scope);
  const instanceScope = pathScopeCondition(sourceAnchorPathSql('source_anchor'), decisions.scope);
  const instanceAnchorText = sourceAnchorTextSql('template_instances.source_anchor');
  const scopedInstanceAnchorText = sourceAnchorTextSql('scoped_instances.source_anchor');
  const protectedArtifacts = sqlStringList([...decisions.protectedUtilityKeys]);
  const protectedTemplates = sqlStringList([...decisions.protectedTemplateKeys]);
  const protectedUsages = sqlStringList([...decisions.protectedExternalUsageKeys]);
  const acceptedInstanceAnchors = sqlStringList(decisions.acceptedTemplates.flatMap((pattern) => pattern.instances.map((instance) => JSON.stringify(instance.sourceAnchor))));
  const artifactKeep = protectedArtifacts ? `AND artifact_key NOT IN (${protectedArtifacts})` : '';
  const templateKeep = protectedTemplates ? `AND pattern_key NOT IN (${protectedTemplates})` : '';
  const usageKeep = protectedUsages ? `AND usage_key NOT IN (${protectedUsages})` : '';
  const artifactFingerprintKeep = protectedArtifacts ? `AND record_key NOT IN (${protectedArtifacts})` : '';
  const templateFingerprintKeep = protectedTemplates ? `AND record_key NOT IN (${protectedTemplates})` : '';
  const usageFingerprintKeep = protectedUsages ? `AND record_key NOT IN (${protectedUsages})` : '';
  const instanceKeep = acceptedInstanceAnchors ? `AND source_anchor NOT IN (${acceptedInstanceAnchors})` : '';

  if (decisions.scope.mode === 'full') {
    return `
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND (
    (entry_type = 'artifact' AND entry_id IN (
      SELECT id FROM artifacts
      WHERE project_id = ${sqlString(projectId)}
        ${artifactKeep}
    ))
    OR (entry_type = 'member' AND entry_id IN (
      SELECT artifact_members.id
      FROM artifact_members
      JOIN artifacts ON artifacts.id = artifact_members.artifact_id
      WHERE artifacts.project_id = ${sqlString(projectId)}
        ${artifactKeep}
    ))
  );
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND artifact_id IN (
    SELECT id FROM artifacts
    WHERE project_id = ${sqlString(projectId)}
      ${artifactKeep}
  );
DELETE FROM artifacts
WHERE project_id = ${sqlString(projectId)}
  ${artifactKeep};
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND entry_id IN (
    SELECT id FROM template_patterns
    WHERE project_id = ${sqlString(projectId)}
      ${templateKeep}
  );
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND pattern_id IN (
    SELECT id FROM template_patterns
    WHERE project_id = ${sqlString(projectId)}
      ${templateKeep}
  );
DELETE FROM template_patterns
WHERE project_id = ${sqlString(projectId)}
  ${templateKeep};
DELETE FROM observed_external_usages
WHERE project_id = ${sqlString(projectId)}
  ${usageKeep};
DELETE FROM discovery_fingerprints
WHERE project_id = ${sqlString(projectId)}
  AND (
    (record_family = 'catalog_entry' AND record_kind = 'utility_artifact' ${protectedArtifacts ? `AND record_key NOT IN (${protectedArtifacts})` : ''})
    OR (record_family = 'catalog_entry' AND record_kind = 'template_pattern' ${protectedTemplates ? `AND record_key NOT IN (${protectedTemplates})` : ''})
    OR (record_family = 'catalog_entry' AND record_kind = 'observed_external_usage' ${protectedUsages ? `AND record_key NOT IN (${protectedUsages})` : ''})
  );
`;
  }

  return `
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND (
    (entry_type = 'artifact' AND entry_id IN (
      SELECT id FROM artifacts
      WHERE project_id = ${sqlString(projectId)}
        AND ${artifactScope}
        ${artifactKeep}
    ))
    OR (entry_type = 'member' AND entry_id IN (
      SELECT artifact_members.id
      FROM artifact_members
      JOIN artifacts ON artifacts.id = artifact_members.artifact_id
      WHERE artifacts.project_id = ${sqlString(projectId)}
        AND ${artifactScopeOnArtifacts}
        ${artifactKeep}
    ))
  );
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND artifact_id IN (
    SELECT id FROM artifacts
    WHERE project_id = ${sqlString(projectId)}
      AND ${artifactScope}
      ${artifactKeep}
  );
DELETE FROM artifacts
WHERE project_id = ${sqlString(projectId)}
  AND ${artifactScope}
  ${artifactKeep};
CREATE TEMP TABLE IF NOT EXISTS tool_catalog_changed_template_patterns (
  pattern_id INTEGER PRIMARY KEY
);
DELETE FROM tool_catalog_changed_template_patterns;
INSERT OR IGNORE INTO tool_catalog_changed_template_patterns (pattern_id)
SELECT DISTINCT template_instances.pattern_id
FROM template_instances
JOIN template_patterns ON template_patterns.id = template_instances.pattern_id
WHERE template_patterns.project_id = ${sqlString(projectId)}
  AND ${instanceScope}
  ${instanceKeep};
DELETE FROM template_instances
WHERE pattern_id IN (
    SELECT pattern_id FROM tool_catalog_changed_template_patterns
  )
  AND ${instanceScope}
  ${instanceKeep};
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND pattern_id IN (
    SELECT pattern_id FROM tool_catalog_changed_template_patterns
  );
INSERT INTO fts_entries (
  project_id, entry_type, pattern_id, title, body, source_anchor
)
SELECT
  template_patterns.project_id,
  'template_pattern',
  template_patterns.id,
  template_patterns.name,
  trim(
    COALESCE(template_patterns.summary, '')
    || char(10) || COALESCE(template_patterns.language, '')
    || char(10) || COALESCE(template_patterns.framework, '')
    || char(10) || COALESCE(template_patterns.module_path, '')
    || char(10) || COALESCE((
      SELECT group_concat(instance_anchor, char(10))
      FROM (
        SELECT ${scopedInstanceAnchorText} AS instance_anchor
        FROM template_instances AS scoped_instances
        WHERE scoped_instances.pattern_id = template_patterns.id
        ORDER BY scoped_instances.id
      )
    ), '')
  ),
  (
    SELECT ${instanceAnchorText}
    FROM template_instances
    WHERE template_instances.pattern_id = template_patterns.id
    ORDER BY template_instances.id
    LIMIT 1
  )
FROM template_patterns
WHERE template_patterns.project_id = ${sqlString(projectId)}
  AND template_patterns.id IN (
    SELECT pattern_id FROM tool_catalog_changed_template_patterns
  )
  AND EXISTS (
    SELECT 1 FROM template_instances
    WHERE template_instances.pattern_id = template_patterns.id
  );
DELETE FROM fts_entries
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND pattern_id IN (
    SELECT id FROM template_patterns
    WHERE project_id = ${sqlString(projectId)}
      AND NOT EXISTS (
        SELECT 1 FROM template_instances
        WHERE template_instances.pattern_id = template_patterns.id
      )
      ${templateKeep}
  );
DELETE FROM entry_capability_tags
WHERE project_id = ${sqlString(projectId)}
  AND entry_type = 'template_pattern'
  AND entry_id IN (
    SELECT id FROM template_patterns
    WHERE project_id = ${sqlString(projectId)}
      AND NOT EXISTS (
        SELECT 1 FROM template_instances
        WHERE template_instances.pattern_id = template_patterns.id
      )
      ${templateKeep}
  );
DELETE FROM template_patterns
WHERE project_id = ${sqlString(projectId)}
  AND NOT EXISTS (
    SELECT 1 FROM template_instances
    WHERE template_instances.pattern_id = template_patterns.id
  )
  ${templateKeep};
DELETE FROM tool_catalog_changed_template_patterns;
DELETE FROM observed_external_usages
WHERE project_id = ${sqlString(projectId)}
  AND ${externalScope}
  ${usageKeep};
DELETE FROM discovery_fingerprints
WHERE project_id = ${sqlString(projectId)}
  AND record_family = 'catalog_entry'
  AND (
    (record_kind = 'utility_artifact' AND ${artifactScope} ${artifactFingerprintKeep})
    OR (record_kind = 'template_pattern' AND ${instanceScope} ${templateFingerprintKeep})
    OR (record_kind = 'observed_external_usage' AND ${externalScope} ${usageFingerprintKeep})
  );
`;
}

function buildDiscoveryApplySql(context, decisions) {
  const statements = [];

  statements.push(cleanupDecisionTraceSql(context.projectId, decisions));

  for (const artifact of decisions.acceptedUtilities) {
    statements.push(upsertArtifactSql(context.projectId, artifact));
  }
  for (const pattern of decisions.acceptedTemplates) {
    statements.push(upsertTemplateSql(context.projectId, pattern));
  }
  for (const usage of decisions.acceptedExternalUsages) {
    statements.push(upsertExternalUsageSql(context.projectId, usage));
  }
  for (const origin of decisions.explicitOriginPriorities) {
    statements.push(upsertExplicitOriginPrioritySql(context.projectId, origin));
  }
  for (const ignored of decisions.ignoredCandidates) {
    statements.push(deleteIgnoredCatalogEntrySql(context.projectId, ignored));
    statements.push(ignoredCandidateSql(context.projectId, ignored));
  }
  for (const deferred of decisions.deferredCandidates) {
    statements.push(deferredCandidateSql(context.projectId, deferred));
  }
  statements.push(cleanupCatalogSql(context.projectId, decisions));
  for (const record of buildPersistedDiscoveryRecords(decisions)) {
    statements.push(discoveryFingerprintSql(context.projectId, record));
  }

  return statements.filter((statement) => statement.trim()).join('\n');
}

function getCatalogCounts(context) {
  const rows = runSqliteJson(context.dbPath, `
SELECT
  (SELECT COUNT(*) FROM utility_origins WHERE project_id = ${sqlString(context.projectId)}) AS utility_origins,
  (SELECT COUNT(*) FROM origin_priorities WHERE project_id = ${sqlString(context.projectId)}) AS origin_priorities,
  (SELECT COUNT(*) FROM artifacts WHERE project_id = ${sqlString(context.projectId)}) AS artifacts,
  (SELECT COUNT(*) FROM artifact_members
    JOIN artifacts ON artifacts.id = artifact_members.artifact_id
    WHERE artifacts.project_id = ${sqlString(context.projectId)}) AS artifact_members,
  (SELECT COUNT(*) FROM member_signatures
    JOIN artifact_members ON artifact_members.id = member_signatures.member_id
    JOIN artifacts ON artifacts.id = artifact_members.artifact_id
    WHERE artifacts.project_id = ${sqlString(context.projectId)}) AS member_signatures,
  (SELECT COUNT(*) FROM capability_tags WHERE project_id = ${sqlString(context.projectId)}) AS capability_tags,
  (SELECT COUNT(*) FROM entry_capability_tags WHERE project_id = ${sqlString(context.projectId)}) AS entry_capability_tags,
  (SELECT COUNT(*) FROM template_patterns WHERE project_id = ${sqlString(context.projectId)}) AS template_patterns,
  (SELECT COUNT(*) FROM template_instances
    JOIN template_patterns ON template_patterns.id = template_instances.pattern_id
    WHERE template_patterns.project_id = ${sqlString(context.projectId)}) AS template_instances,
  (SELECT COUNT(*) FROM observed_external_usages WHERE project_id = ${sqlString(context.projectId)}) AS observed_external_usages,
  (SELECT COUNT(*) FROM ignored_candidates WHERE project_id = ${sqlString(context.projectId)}) AS ignored_candidates,
  (SELECT COUNT(*) FROM deferred_candidates WHERE project_id = ${sqlString(context.projectId)}) AS deferred_candidates,
  (SELECT COUNT(*) FROM fts_entries WHERE project_id = ${sqlString(context.projectId)}) AS fts_entries;
`);

  return rows[0] ?? {};
}

function emptyCatalogCounts() {
  return Object.fromEntries(CATALOG_COUNT_KEYS.map((key) => [key, 0]));
}

function getCatalogCountsIfPresent(context) {
  if (!fs.existsSync(context.dbPath) || getSchemaVersion(context.dbPath) < MIN_CONSULT_SCHEMA_VERSION) {
    return emptyCatalogCounts();
  }

  return getCatalogCounts(context);
}

function diffCatalogCounts(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const diff = {};
  for (const key of keys) {
    diff[key] = Number(after[key] ?? 0) - Number(before[key] ?? 0);
  }

  return diff;
}

function collectDecisionRisks(decisions) {
  const risks = new Set();
  for (const artifact of decisions.acceptedUtilities) {
    if (artifact.framework === null) {
      risks.add(`Utility artifact ${artifact.artifactKey} has no detected framework metadata.`);
    }
  }
  if (decisions.requiredDecisions.length > 0) {
    risks.add('Index update was skipped because unresolved decisions remain; resolve or ignore every candidate before re-running apply.');
  }
  if (risks.size === 0) {
    risks.add('Line numbers are stored as hints and should be verified against source when used.');
  }

  return [...risks];
}

function buildApplySummary(context, decisions, beforeCounts, afterCounts, indexMutated = true) {
  const changedPaths = decisions.scope.changedPaths.map((item) => ({
    path: item.path,
    is_directory: item.isDirectory,
  }));

  return {
    kind: 'tool_catalog_discovery_apply',
    version: 1,
    applied_at: new Date().toISOString(),
    index_mutated: indexMutated,
    project: projectContextToOutput(context),
    scan: {
      mode: decisions.scope.mode,
      changed_paths: changedPaths,
      language_filters: decisions.scope.languageFilters,
      include_filters: decisions.scope.includeFilters,
      exclude_filters: decisions.scope.excludeFilters,
    },
    decisions: {
      accepted_utility_artifacts: decisions.acceptedUtilities.length,
      accepted_artifact_members: decisions.acceptedUtilities.reduce((count, artifact) => count + artifact.members.length, 0),
      accepted_template_patterns: decisions.acceptedTemplates.length,
      accepted_template_instances: decisions.acceptedTemplates.reduce((count, pattern) => count + pattern.instances.length, 0),
      accepted_observed_external_usages: decisions.acceptedExternalUsages.length,
      ignored_candidates: decisions.ignoredCandidates.length,
      deferred_candidates: decisions.deferredCandidates.length,
      required_decisions: decisions.requiredDecisions,
      explicit_origin_priorities: decisions.explicitOriginPriorities.length,
    },
    cleanup: {
      applied: indexMutated && decisions.requiredDecisions.length === 0,
      scope: decisions.scope.mode,
      changed_paths: changedPaths,
      skipped_reason: decisions.requiredDecisions.length > 0 ? 'unresolved-decisions' : null,
    },
    counts: {
      before: beforeCounts,
      after: afterCounts,
      delta: diffCatalogCounts(beforeCounts, afterCounts),
    },
    risks: collectDecisionRisks(decisions),
    follow_up_commands: [
      `tool-catalog config info --root ${context.rootPath}`,
      decisions.scope.mode === 'changed'
        ? `tool-catalog discover --changed ${changedPaths.map((item) => item.path).join(' ')} --dry-run --root ${context.rootPath}`
        : `tool-catalog discover --full --dry-run --root ${context.rootPath}`,
    ],
  };
}

function renderCountDelta(delta) {
  return Object.entries(delta)
    .map(([key, value]) => `- ${key}: ${value >= 0 ? '+' : ''}${value}`)
    .join('\n');
}

function renderDiscoveryApplyMarkdown(summary) {
  const required = summary.decisions.required_decisions;
  const lines = [
    '# Tool Catalog Discovery Apply',
    '',
    `Project: \`${summary.project.project_id}\``,
    `Root: \`${summary.project.root_path}\``,
    `Index: \`${summary.project.catalog_path}\``,
    `Mode: \`${summary.scan.mode}\``,
    `Index mutated: \`${summary.index_mutated}\``,
    '',
    '## Changed Counts',
    renderCountDelta(summary.counts.delta),
    '',
    '## Applied Decisions',
    `- Utility artifacts: ${summary.decisions.accepted_utility_artifacts}`,
    `- Artifact members: ${summary.decisions.accepted_artifact_members}`,
    `- Template patterns: ${summary.decisions.accepted_template_patterns}`,
    `- Template instances: ${summary.decisions.accepted_template_instances}`,
    `- Observed external usages: ${summary.decisions.accepted_observed_external_usages}`,
    `- Ignored candidates: ${summary.decisions.ignored_candidates}`,
    `- Deferred candidates: ${summary.decisions.deferred_candidates}`,
    `- Origin priorities: ${summary.decisions.explicit_origin_priorities}`,
    '',
    '## Required Decisions',
  ];

  if (required.length === 0) {
    lines.push('- None.');
  } else {
    for (const decision of required.slice(0, 20)) {
      lines.push(`- \`${decision.candidate_id}\` (${decision.candidate_type}): ${decision.reason}`);
    }
    if (required.length > 20) {
      lines.push(`- ${required.length - 20} more required decisions omitted from Markdown summary.`);
    }
  }

  lines.push('', '## Cleanup');
  lines.push(`- Applied: \`${summary.cleanup.applied}\``);
  lines.push(`- Scope: \`${summary.cleanup.scope}\``);
  if (summary.cleanup.skipped_reason) {
    lines.push(`- Skipped reason: \`${summary.cleanup.skipped_reason}\``);
  }

  lines.push('', '## Risks');
  for (const risk of summary.risks) {
    lines.push(`- ${risk}`);
  }

  lines.push('', '## Follow-up Commands');
  for (const command of summary.follow_up_commands) {
    lines.push(`- \`${command}\``);
  }

  return `${lines.join('\n')}\n`;
}

function printDiscoveryApplySummary(summary, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderDiscoveryApplyMarkdown(summary));
}

function applyDiscoveryDecisions(context, decisions) {
  if (decisions.requiredDecisions.length > 0) {
    const counts = getCatalogCountsIfPresent(context);
    return buildApplySummary(context, decisions, counts, counts, false);
  }

  return withProjectApplyLock(context, () => {
    applyMigrations(context.dbPath);
    upsertProjectRecord(context);
    const beforeCounts = getCatalogCounts(context);
    const sql = buildDiscoveryApplySql(context, decisions);
    if (sql.trim()) {
      runSqlite(context.dbPath, transactionSql(sql));
    }
    const afterCounts = getCatalogCounts(context);
    return buildApplySummary(context, decisions, beforeCounts, afterCounts);
  });
}

function createConsultContext(options) {
  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  return createProjectContext(options, config);
}

function getReadOnlySchemaVersion(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return 0;
  }

  const metadataTables = runSqliteReadOnlyJson(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata';");
  if (metadataTables.length === 0) {
    return 0;
  }

  const rows = runSqliteReadOnlyJson(dbPath, "SELECT value FROM metadata WHERE key = 'schema_version';");
  const version = Number.parseInt(rows[0]?.value ?? '0', 10);
  return Number.isNaN(version) ? 0 : version;
}

function consultIndexState(context) {
  const exists = fs.existsSync(context.dbPath);
  const schemaVersion = exists ? getReadOnlySchemaVersion(context.dbPath) : 0;
  return {
    exists,
    schemaVersion,
    readable: exists && schemaVersion >= MIN_CONSULT_SCHEMA_VERSION,
    reason: exists ? (schemaVersion >= MIN_CONSULT_SCHEMA_VERSION ? null : 'schema-too-old') : 'missing-index',
  };
}

function buildUnavailableIndexOutput(kind, context, state) {
  return {
    kind,
    version: 1,
    project: projectContextToOutput(context),
    index: {
      status: state.reason,
      schema_version: state.schemaVersion,
      readable: false,
    },
    results: [],
    warnings: [
      state.reason === 'missing-index'
        ? 'No project index exists for this project id. Run discovery before consulting.'
        : 'The project index schema is too old for consulting commands. Run discovery apply to migrate it.',
    ],
  };
}

function buildUnavailableTagsOutput(context, state) {
  const output = buildUnavailableIndexOutput('tool_catalog_tags', context, state);
  return {
    ...output,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    tags: [],
    results: undefined,
  };
}

function capabilityTagVocabularyEntry(tag) {
  return CAPABILITY_TAG_VOCABULARY.get(tag) ?? null;
}

function loadCapabilityTagVocabulary(context) {
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  capability_tags.tag,
  capability_tags.description,
  COUNT(DISTINCT entry_capability_tags.entry_type || ':' || entry_capability_tags.entry_id) AS entry_count
FROM capability_tags
LEFT JOIN entry_capability_tags
  ON entry_capability_tags.project_id = capability_tags.project_id
  AND entry_capability_tags.tag_id = capability_tags.id
WHERE capability_tags.project_id = ${sqlString(context.projectId)}
GROUP BY capability_tags.id, capability_tags.tag, capability_tags.description
ORDER BY capability_tags.tag;
`).map((row) => {
    const vocabulary = capabilityTagVocabularyEntry(row.tag);
    return {
      tag: row.tag,
      description: normalizeNullableString(row.description)
        ?? vocabulary?.description
        ?? 'Capability tag stored without a project-specific description.',
      aliases: [...(vocabulary?.aliases ?? [])],
      entry_count: Number(row.entry_count ?? 0),
    };
  });
}

function buildTagsOutput(context, state) {
  if (!state.readable) {
    return buildUnavailableTagsOutput(context, state);
  }

  return {
    kind: 'tool_catalog_tags',
    version: 1,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    tags: loadCapabilityTagVocabulary(context),
    warnings: [],
  };
}

function renderTagsMarkdown(output) {
  const lines = [
    '# Tool Catalog tags',
    '',
    `Project: \`${output.project.project_id}\``,
    `Root: \`${output.project.root_path}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Tags',
  ];

  if (output.tags.length === 0) {
    lines.push('- None.');
  } else {
    for (const entry of output.tags) {
      lines.push(`- \`${entry.tag}\` (${entry.entry_count} entries)`);
      lines.push(`  Description: ${entry.description}`);
      if (entry.aliases.length > 0) {
        lines.push(`  Aliases: ${entry.aliases.map((alias) => `\`${alias}\``).join(', ')}`);
      }
    }
  }

  if (output.warnings.length > 0) {
    lines.push('', '## Notes');
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printTagsOutput(output, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderTagsMarkdown(output));
}

function sqlLimit(value) {
  return sqlInteger(Math.min(Math.max(Number.parseInt(value, 10) || DEFAULT_QUERY_LIMIT, 1), 200));
}

function goalTerms(goal) {
  return [...new Set(String(goal)
    .toLowerCase()
    .match(/[a-z0-9_]+/g) ?? [])]
    .filter((term) => term.length >= 2)
    .slice(0, 12);
}

function ftsQueryFromTerms(terms) {
  return terms.map((term) => `${term.replace(/"/g, '""')}*`).join(' OR ');
}

function normalizeCurrentFile(rootPath, currentFile) {
  const value = normalizeNullableString(currentFile);
  if (!value) {
    return null;
  }

  const absolutePath = path.isAbsolute(value)
    ? normalizePath(value)
    : normalizePath(path.resolve(rootPath, value));
  if (!isInsideRoot(rootPath, absolutePath)) {
    throw new ToolCatalogError(`Current file is outside the target project root: ${currentFile}`, 2);
  }

  return getRelativePath(rootPath, absolutePath);
}

function moduleProximityScore(currentFile, modulePath) {
  if (!currentFile || !modulePath) {
    return 0;
  }

  const currentModule = getModulePath(currentFile);
  if (!currentModule) {
    return 0;
  }
  if (currentModule === modulePath) {
    return 3;
  }

  const currentFirst = currentModule.split('/')[0];
  const moduleFirst = modulePath.split('/')[0];
  return currentFirst && currentFirst === moduleFirst ? 1 : 0;
}

function parseStoredSourceAnchor(value) {
  const text = normalizeNullableString(value);
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (isPlainObject(parsed)) {
      const relativePath = normalizeNullableString(parsed.path);
      const line = Number.parseInt(parsed.line ?? parsed.line_hint ?? 1, 10);
      const symbol = normalizeNullableString(parsed.symbol ?? parsed.symbol_identity);
      if (relativePath && Number.isFinite(line) && line > 0) {
        return {
          path: normalizeRelativePath(relativePath),
          line,
          symbol,
          text: `${normalizeRelativePath(relativePath)}:${line}${symbol ? `#${symbol}` : ''}`,
        };
      }
    }
  } catch {
    const parsed = parseSourceAnchorText(text);
    if (parsed) {
      return {
        path: normalizeRelativePath(parsed.path),
        line: parsed.line,
        symbol: parsed.symbol,
        text: `${normalizeRelativePath(parsed.path)}:${parsed.line}${parsed.symbol ? `#${parsed.symbol}` : ''}`,
      };
    }
  }

  return {
    path: text,
    line: 1,
    symbol: null,
    text,
    invalid: true,
  };
}

function anchorToOutput(anchor) {
  if (!anchor) {
    return null;
  }

  return {
    path: anchor.path,
    line: anchor.line,
    symbol: anchor.symbol,
    text: anchor.text,
    invalid: Boolean(anchor.invalid),
  };
}

function compactSnippet(value, maxLength = 140) {
  return truncateText(String(value ?? '').replace(/\s+/g, ' ').trim(), maxLength);
}

function lowerSet(values) {
  return new Set(values.map((value) => String(value).toLowerCase()));
}

function entryHasAllTagsSql(projectId, entryType, entryIdSql, tags) {
  if (tags.length === 0) {
    return '1 = 1';
  }

  return tags.map((tag) => `
EXISTS (
  SELECT 1
  FROM entry_capability_tags
  JOIN capability_tags ON capability_tags.id = entry_capability_tags.tag_id
  WHERE entry_capability_tags.project_id = ${sqlString(projectId)}
    AND entry_capability_tags.entry_type = ${sqlString(entryType)}
    AND entry_capability_tags.entry_id = ${entryIdSql}
    AND capability_tags.project_id = entry_capability_tags.project_id
    AND capability_tags.tag = ${sqlString(tag)}
)`).join(' AND ');
}

function queryTagFilterSql(projectId, tags) {
  if (tags.length === 0) {
    return '';
  }

  return `
  AND (
    (fts_entries.entry_type = 'artifact' AND ${entryHasAllTagsSql(projectId, 'artifact', 'artifacts.id', tags)})
    OR (fts_entries.entry_type = 'member' AND ${entryHasAllTagsSql(projectId, 'member', 'artifact_members.id', tags)})
    OR (fts_entries.entry_type = 'template_pattern' AND ${entryHasAllTagsSql(projectId, 'template_pattern', 'template_patterns.id', tags)})
  )`;
}

function resultTypeAliases(result) {
  const aliases = new Set([result.kind]);
  if (result.kind === 'artifact') {
    aliases.add('utility_artifact');
    aliases.add(result.artifact_type);
  } else if (result.kind === 'member') {
    aliases.add('artifact_member');
    aliases.add(result.member_type);
    aliases.add(result.artifact_type);
  } else if (result.kind === 'template_pattern') {
    aliases.add('template');
    aliases.add('template_pattern');
  } else if (result.kind === 'external_usage') {
    aliases.add('external');
    aliases.add('external_usage');
    aliases.add('observed_external_usage');
  }

  return [...aliases].filter(Boolean).map((item) => String(item).toLowerCase());
}

function passesQueryFilters(result, queryOptions) {
  const languages = lowerSet(queryOptions.languages);
  const frameworks = lowerSet(queryOptions.frameworks);
  const artifactTypes = lowerSet(queryOptions.artifactTypes);

  if (languages.size > 0 && !languages.has(String(result.language ?? '').toLowerCase())) {
    return false;
  }
  if (frameworks.size > 0 && !frameworks.has(String(result.framework ?? '').toLowerCase())) {
    return false;
  }
  if (artifactTypes.size > 0 && !resultTypeAliases(result).some((item) => artifactTypes.has(item))) {
    return false;
  }

  return true;
}

function compactQueryMatch(result) {
  return {
    kind: result.kind,
    selector: result.selector,
    title: result.title,
    signature: result.signature,
    signatures: result.signatures,
    source_anchor: result.source_anchor,
    summary: result.summary,
    snippet: result.snippet,
  };
}

function createArtifactQueryGroup(result) {
  return {
    kind: 'artifact',
    selector: `artifact:${result.artifact_key}`,
    identifier: result.artifact_key,
    title: result.artifact_name ?? result.title,
    artifact_type: result.artifact_type,
    language: result.language,
    framework: result.framework,
    module_path: result.module_path,
    source_anchor: result.artifact_source_anchor ?? result.source_anchor,
    summary: result.artifact_summary ?? result.summary,
    origin_type: result.origin_type,
    origin_key: result.origin_key,
    origin_display_name: result.origin_display_name,
    origin_priority: result.origin_priority,
    origin_priority_reason: result.origin_priority_reason,
    matched_by: result.kind,
    best_match: compactQueryMatch(result),
    matching_members: [],
    member_match_count: 0,
  };
}

function addArtifactQueryMatch(group, result) {
  if (result.kind !== 'member') {
    return;
  }
  if (group.matching_members.some((member) => member.selector === result.selector)) {
    return;
  }

  group.matching_members.push({
    selector: result.selector,
    identifier: result.identifier,
    title: result.title,
    name: result.member_name,
    member_type: result.member_type,
    signature: result.signature,
    signatures: result.signatures,
    source_anchor: result.source_anchor,
    summary: result.summary,
    snippet: result.snippet,
  });
  group.member_match_count = group.matching_members.length;
}

function buildGroupedQueryResults(results, limit) {
  const grouped = [];
  const artifactGroups = new Map();

  for (const result of results) {
    if (result.kind === 'artifact' || result.kind === 'member') {
      const selector = `artifact:${result.artifact_key}`;
      let group = artifactGroups.get(selector);
      if (!group) {
        group = createArtifactQueryGroup(result);
        artifactGroups.set(selector, group);
        grouped.push(group);
      }
      addArtifactQueryMatch(group, result);
      continue;
    }

    grouped.push({
      kind: result.kind,
      selector: result.selector,
      identifier: result.identifier,
      title: result.title,
      artifact_type: result.artifact_type,
      member_type: result.member_type,
      language: result.language,
      framework: result.framework,
      module_path: result.module_path,
      source_anchor: result.source_anchor,
      summary: result.summary,
      signature: result.signature,
      signatures: result.signatures,
      snippet: result.snippet,
      origin_type: result.origin_type,
      origin_key: result.origin_key,
      origin_display_name: result.origin_display_name,
      origin_priority: result.origin_priority,
      origin_priority_reason: result.origin_priority_reason,
    });
  }

  return grouped
    .slice(0, limit)
    .map((result, index) => ({
      rank: index + 1,
      ...result,
    }));
}

function textIncludesTerm(value, term) {
  return String(value ?? '').toLowerCase().includes(term);
}

function wordBoundaryMatches(value, term) {
  return new RegExp(`\\b${escapeRegExp(term)}`, 'i').test(String(value ?? ''));
}

function functionalScore(result, terms) {
  const fields = [
    { value: result.title, weight: 12 },
    { value: result.identifier, weight: 10 },
    { value: result.summary, weight: 6 },
    { value: result.signature, weight: 6 },
    { value: result.body, weight: 4 },
    { value: result.import_text, weight: 4 },
    { value: result.call_text, weight: 4 },
    { value: result.artifact_type, weight: 3 },
    { value: result.origin_display_name, weight: 2 },
  ];
  let score = 0;

  for (const term of terms) {
    for (const field of fields) {
      if (textIncludesTerm(field.value, term)) {
        score += field.weight;
        if (wordBoundaryMatches(field.value, term)) {
          score += 1;
        }
      }
    }
  }

  if (Number.isFinite(result.fts_rank)) {
    score += Math.max(0, 10 - Math.abs(result.fts_rank));
  }

  return score;
}

function originRank(result) {
  return result.origin_type === 'external' ? 0 : 1;
}

function configuredOriginPriority(result) {
  if (Number.isFinite(result.origin_priority)) {
    return result.origin_priority;
  }

  return result.origin_type === 'external' ? 50 : 100;
}

function resultSelector(result) {
  if (result.kind === 'artifact') {
    return `artifact:${result.identifier}`;
  }
  if (result.kind === 'member') {
    return `member:${result.identifier}`;
  }
  if (result.kind === 'template_pattern') {
    return `template:${result.identifier}`;
  }
  if (result.kind === 'external_usage') {
    return `external:${result.identifier}`;
  }

  return result.identifier;
}

function mapFtsRow(row) {
  const kind = row.entry_type === 'template_pattern' ? 'template_pattern' : row.entry_type;
  const isMember = kind === 'member';
  const isTemplate = kind === 'template_pattern';
  const anchor = parseStoredSourceAnchor(isMember ? row.member_source_anchor : (isTemplate ? row.template_source_anchor : row.artifact_source_anchor));
  const artifactAnchor = parseStoredSourceAnchor(row.artifact_source_anchor);
  const identifier = isMember ? row.member_key : (isTemplate ? row.pattern_key : row.artifact_key);
  const title = isMember ? `${row.artifact_name}.${row.member_name}` : (isTemplate ? row.pattern_name : row.artifact_name);

  return {
    kind,
    identifier,
    title,
    artifact_id: row.artifact_id,
    member_id: row.member_id,
    pattern_id: row.pattern_id,
    artifact_key: row.artifact_key,
    artifact_name: row.artifact_name,
    artifact_type: row.artifact_type,
    artifact_source_anchor: anchorToOutput(artifactAnchor),
    artifact_summary: row.artifact_summary,
    member_type: row.member_type,
    member_name: row.member_name,
    language: isTemplate ? row.template_language : row.artifact_language,
    framework: isTemplate ? row.template_framework : row.artifact_framework,
    module_path: isTemplate ? row.template_module_path : row.artifact_module_path,
    source_anchor: anchorToOutput(anchor),
    summary: isMember ? row.member_summary : (isTemplate ? row.template_summary : row.artifact_summary),
    signature: row.signature,
    snippet: compactSnippet(isMember ? row.member_snippet : (isTemplate ? row.template_snippet : row.artifact_snippet)),
    origin_type: isTemplate ? 'project' : (row.origin_type ?? 'project'),
    origin_key: row.origin_key,
    origin_display_name: isTemplate ? 'Project template pattern' : row.origin_display_name,
    origin_priority: row.origin_priority === null || row.origin_priority === undefined ? null : Number(row.origin_priority),
    origin_priority_reason: row.origin_priority_reason,
    fts_rank: Number(row.fts_rank),
    body: row.fts_body,
    match_source: 'fts',
  };
}

function queryFtsRows(context, ftsQuery, queryOptions) {
  const rowLimit = Math.max(queryOptions.limit * 12, 120);
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  fts_entries.entry_type,
  bm25(fts_entries) AS fts_rank,
  artifacts.id AS artifact_id,
  artifact_members.id AS member_id,
  template_patterns.id AS pattern_id,
  artifacts.artifact_key,
  artifacts.artifact_type,
  artifacts.name AS artifact_name,
  artifacts.language AS artifact_language,
  artifacts.framework AS artifact_framework,
  artifacts.module_path AS artifact_module_path,
  artifacts.source_anchor AS artifact_source_anchor,
  artifacts.summary AS artifact_summary,
  artifacts.snippet AS artifact_snippet,
  artifact_members.member_key,
  artifact_members.name AS member_name,
  artifact_members.member_type,
  artifact_members.signature,
  artifact_members.source_anchor AS member_source_anchor,
  artifact_members.summary AS member_summary,
  artifact_members.snippet AS member_snippet,
  template_patterns.pattern_key,
  template_patterns.name AS pattern_name,
  template_patterns.language AS template_language,
  template_patterns.framework AS template_framework,
  template_patterns.module_path AS template_module_path,
  template_patterns.summary AS template_summary,
  template_patterns.snippet AS template_snippet,
  fts_entries.source_anchor AS template_source_anchor,
  utility_origins.origin_key,
  utility_origins.origin_type,
  utility_origins.display_name AS origin_display_name,
  origin_priorities.priority AS origin_priority,
  origin_priorities.reason AS origin_priority_reason,
  fts_entries.body AS fts_body
FROM fts_entries
LEFT JOIN artifact_members ON artifact_members.id = fts_entries.member_id
LEFT JOIN artifacts ON artifacts.id = COALESCE(fts_entries.artifact_id, artifact_members.artifact_id)
LEFT JOIN template_patterns ON template_patterns.id = fts_entries.pattern_id
LEFT JOIN utility_origins ON utility_origins.id = artifacts.origin_id
LEFT JOIN origin_priorities ON origin_priorities.project_id = artifacts.project_id
  AND origin_priorities.origin_id = utility_origins.id
WHERE fts_entries.project_id = ${sqlString(context.projectId)}
  AND fts_entries MATCH ${sqlString(ftsQuery)}
  ${queryTagFilterSql(context.projectId, queryOptions.tags)}
ORDER BY fts_rank ASC
LIMIT ${sqlLimit(rowLimit)};
`).map(mapFtsRow);
}

function externalUsageWhereSql(terms) {
  if (terms.length === 0) {
    return '1 = 1';
  }

  const conditions = terms.flatMap((term) => {
    const like = sqlString(`%${term}%`);
    return [
      `LOWER(COALESCE(observed_external_usages.usage_key, '')) LIKE ${like}`,
      `LOWER(COALESCE(observed_external_usages.import_text, '')) LIKE ${like}`,
      `LOWER(COALESCE(observed_external_usages.call_text, '')) LIKE ${like}`,
      `LOWER(COALESCE(utility_origins.origin_key, '')) LIKE ${like}`,
      `LOWER(COALESCE(utility_origins.display_name, '')) LIKE ${like}`,
    ];
  });

  return `(${conditions.join(' OR ')})`;
}

function mapExternalUsageRow(row) {
  const anchor = parseStoredSourceAnchor(row.source_anchor);
  return {
    kind: 'external_usage',
    identifier: row.usage_key,
    title: row.origin_display_name ?? row.origin_key ?? row.usage_key,
    usage_id: row.usage_id,
    language: row.language,
    framework: row.framework,
    module_path: getModulePath(anchor?.path ?? ''),
    source_anchor: anchorToOutput(anchor),
    summary: `Observed external utility usage from ${row.origin_display_name ?? row.origin_key}.`,
    import_text: row.import_text,
    call_text: row.call_text,
    snippet: compactSnippet(row.call_text ?? row.import_text),
    origin_type: row.origin_type ?? 'external',
    origin_key: row.origin_key,
    origin_display_name: row.origin_display_name,
    origin_priority: row.origin_priority === null || row.origin_priority === undefined ? null : Number(row.origin_priority),
    origin_priority_reason: row.origin_priority_reason,
    match_source: 'structured',
  };
}

function queryExternalUsageRows(context, terms, queryOptions) {
  if (queryOptions.tags.length > 0) {
    return [];
  }

  const rowLimit = Math.max(queryOptions.limit * 8, 100);
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  observed_external_usages.id AS usage_id,
  observed_external_usages.usage_key,
  observed_external_usages.source_anchor,
  observed_external_usages.import_text,
  observed_external_usages.call_text,
  observed_external_usages.language,
  observed_external_usages.framework,
  utility_origins.origin_key,
  utility_origins.origin_type,
  utility_origins.display_name AS origin_display_name,
  origin_priorities.priority AS origin_priority,
  origin_priorities.reason AS origin_priority_reason
FROM observed_external_usages
LEFT JOIN utility_origins ON utility_origins.id = observed_external_usages.origin_id
LEFT JOIN origin_priorities ON origin_priorities.project_id = observed_external_usages.project_id
  AND origin_priorities.origin_id = utility_origins.id
WHERE observed_external_usages.project_id = ${sqlString(context.projectId)}
  AND ${externalUsageWhereSql(terms)}
LIMIT ${sqlLimit(rowLimit)};
`).map(mapExternalUsageRow);
}

function rankQueryResults(results, terms, currentFile) {
  return results
    .map((result) => ({
      ...result,
      selector: resultSelector(result),
      functional_score: functionalScore(result, terms),
      origin_rank: originRank(result),
      origin_priority: configuredOriginPriority(result),
      module_proximity: moduleProximityScore(currentFile, result.module_path),
    }))
    .sort((left, right) => {
      if (right.functional_score !== left.functional_score) {
        return right.functional_score - left.functional_score;
      }
      if (right.origin_rank !== left.origin_rank) {
        return right.origin_rank - left.origin_rank;
      }
      if (right.origin_priority !== left.origin_priority) {
        return right.origin_priority - left.origin_priority;
      }
      if (right.module_proximity !== left.module_proximity) {
        return right.module_proximity - left.module_proximity;
      }
      return left.selector.localeCompare(right.selector);
    });
}

function hydrateQueryResult(context, result) {
  if (result.kind !== 'member' || !result.member_id) {
    return result;
  }

  return {
    ...result,
    ...memberSignatureFields(loadMemberSignatures(context, result.member_id)),
  };
}

function buildQueryOutput(context, state, queryOptions) {
  if (!state.readable) {
    return buildUnavailableIndexOutput('tool_catalog_query', context, state);
  }

  const terms = goalTerms(queryOptions.goal);
  if (terms.length === 0) {
    throw new ToolCatalogError('Query goal must include at least one searchable word.', 2);
  }

  const currentFile = normalizeCurrentFile(context.rootPath, queryOptions.currentFile);
  const ftsResults = queryFtsRows(context, ftsQueryFromTerms(terms), queryOptions);
  const externalResults = queryExternalUsageRows(context, terms, queryOptions);
  const rankedResults = rankQueryResults([...ftsResults, ...externalResults], terms, currentFile)
    .filter((result) => result.functional_score > 0)
    .filter((result) => passesQueryFilters(result, queryOptions))
    .map((result) => hydrateQueryResult(context, result));
  const groupedResults = buildGroupedQueryResults(rankedResults, queryOptions.limit);
  const warnings = [];

  if (rankedResults.some((result) => result.origin_type === 'external' && !result.origin_priority_reason)) {
    warnings.push('One or more external results have no configured priority reason; verify the origin before reuse.');
  }
  if (groupedResults.length === 0) {
    if (queryOptions.tags.length > 0) {
      warnings.push('No reusable catalog entries matched the exact tag filters. Inspect `tool-catalog tags` to remap once to a better canonical tag, or retry once without --tag.');
    } else {
      warnings.push('No reusable catalog entries matched the query and filters. Broaden the goal or run discovery if this index is incomplete.');
    }
  }

  return {
    kind: 'tool_catalog_query',
    version: 2,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    query: {
      goal: queryOptions.goal,
      tag_filters: queryOptions.tags,
      current_file: currentFile,
      language_filters: queryOptions.languages,
      framework_filters: queryOptions.frameworks,
      artifact_type_filters: queryOptions.artifactTypes,
      limit: queryOptions.limit,
      terms,
      ranking: ['functional_match', 'project_owned_origin', 'external_origin_priority', 'weak_module_proximity'],
    },
    results: groupedResults,
    warnings,
  };
}

function renderQueryMarkdown(output) {
  const lines = [
    '# Tool Catalog Query',
    '',
    `Project: \`${output.project.project_id}\``,
    `Root: \`${output.project.root_path}\``,
    `Goal: ${output.query ? `\`${output.query.goal}\`` : '`n/a`'}`,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Results',
  ];

  if (output.results.length === 0) {
    lines.push('- None.');
  } else {
    for (const result of output.results) {
      lines.push(`${result.rank}. \`${result.selector}\` ${result.title}`);
      lines.push(`   Kind: \`${result.kind}\`; language: \`${result.language ?? 'n/a'}\`; framework: \`${result.framework ?? 'n/a'}\`; type: \`${result.artifact_type ?? result.member_type ?? result.kind}\`.`);
      lines.push(`   Source: \`${result.source_anchor?.text ?? 'n/a'}\`; origin: \`${result.origin_type ?? 'project'}:${result.origin_display_name ?? result.origin_key ?? 'project'}\`.`);
      if (result.summary) {
        lines.push(`   Use: ${result.summary}`);
      }
      if (result.best_match && result.best_match.selector !== result.selector) {
        lines.push(`   Best match: \`${result.best_match.selector}\` at \`${result.best_match.source_anchor?.text ?? 'n/a'}\`.`);
      }
      if ((result.signatures?.length ?? 0) > 1) {
        lines.push(`   Signatures: ${result.signatures.map((signature) => `\`${signature.signature}\``).join('; ')}`);
      } else if (result.signature) {
        lines.push(`   Example: \`${result.signature}\``);
      } else if (result.snippet) {
        lines.push(`   Example: \`${result.snippet}\``);
      }
      if (result.matching_members?.length > 0) {
        lines.push('   Matching members:');
        for (const member of result.matching_members) {
          if ((member.signatures?.length ?? 0) > 1) {
            lines.push(`   - \`${member.selector}\` Signatures: ${member.signatures.map((signature) => `\`${signature.signature}\``).join('; ')} at \`${member.source_anchor?.text ?? 'n/a'}\``);
          } else if (member.signature) {
            lines.push(`   - \`${member.selector}\` \`${member.signature}\` at \`${member.source_anchor?.text ?? 'n/a'}\``);
          } else {
            lines.push(`   - \`${member.selector}\` at \`${member.source_anchor?.text ?? 'n/a'}\``);
          }
        }
      }
    }
  }

  if (output.warnings.length > 0) {
    lines.push('', '## Notes');
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printQueryOutput(output, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderQueryMarkdown(output));
}

function selectorCandidates(selector) {
  const raw = normalizeNullableString(selector);
  if (!raw) {
    return { kind: null, identifiers: [] };
  }

  const mappings = [
    { prefix: 'artifact:', kind: 'artifact' },
    { prefix: 'member:', kind: 'member' },
    { prefix: 'template:', kind: 'template_pattern' },
    { prefix: 'template-pattern:', kind: 'template_pattern' },
    { prefix: 'external:', kind: 'external_usage' },
  ];

  for (const mapping of mappings) {
    if (raw.startsWith(mapping.prefix)) {
      const stripped = raw.slice(mapping.prefix.length);
      return {
        kind: mapping.kind,
        identifiers: [...new Set([stripped, raw].filter(Boolean))],
      };
    }
  }

  return {
    kind: null,
    identifiers: [raw],
  };
}

function loadArtifactRows(context, identifiers) {
  const idList = sqlStringList(identifiers);
  if (!idList) {
    return [];
  }

  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  artifacts.id AS artifact_id,
  artifacts.artifact_key,
  artifacts.artifact_type,
  artifacts.name,
  artifacts.language,
  artifacts.framework,
  artifacts.module_path,
  artifacts.source_anchor,
  artifacts.summary,
  artifacts.usage_notes,
  artifacts.limitations,
  artifacts.snippet,
  utility_origins.origin_key,
  utility_origins.origin_type,
  utility_origins.display_name AS origin_display_name,
  utility_origins.summary AS origin_summary,
  origin_priorities.priority AS origin_priority,
  origin_priorities.reason AS origin_priority_reason
FROM artifacts
LEFT JOIN utility_origins ON utility_origins.id = artifacts.origin_id
LEFT JOIN origin_priorities ON origin_priorities.project_id = artifacts.project_id
  AND origin_priorities.origin_id = utility_origins.id
WHERE artifacts.project_id = ${sqlString(context.projectId)}
  AND artifacts.artifact_key IN (${idList});
`);
}

function loadMemberRows(context, identifiers) {
  const idList = sqlStringList(identifiers);
  if (!idList) {
    return [];
  }

  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  artifact_members.id AS member_id,
  artifact_members.member_key,
  artifact_members.name AS member_name,
  artifact_members.member_type,
  artifact_members.signature,
  artifact_members.source_anchor,
  artifact_members.summary,
  artifact_members.usage_notes,
  artifact_members.limitations,
  artifact_members.snippet,
  artifacts.id AS artifact_id,
  artifacts.artifact_key,
  artifacts.artifact_type,
  artifacts.name AS artifact_name,
  artifacts.language,
  artifacts.framework,
  artifacts.module_path,
  utility_origins.origin_key,
  utility_origins.origin_type,
  utility_origins.display_name AS origin_display_name,
  origin_priorities.priority AS origin_priority,
  origin_priorities.reason AS origin_priority_reason
FROM artifact_members
JOIN artifacts ON artifacts.id = artifact_members.artifact_id
LEFT JOIN utility_origins ON utility_origins.id = artifacts.origin_id
LEFT JOIN origin_priorities ON origin_priorities.project_id = artifacts.project_id
  AND origin_priorities.origin_id = utility_origins.id
WHERE artifacts.project_id = ${sqlString(context.projectId)}
  AND artifact_members.member_key IN (${idList});
`);
}

function loadTemplateRows(context, identifiers) {
  const idList = sqlStringList(identifiers);
  if (!idList) {
    return [];
  }

  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  template_patterns.id AS pattern_id,
  template_patterns.pattern_key,
  template_patterns.name,
  template_patterns.language,
  template_patterns.framework,
  template_patterns.module_path,
  template_patterns.summary,
  template_patterns.usage_notes,
  template_patterns.limitations,
  template_patterns.snippet,
  COUNT(template_instances.id) AS instance_count
FROM template_patterns
LEFT JOIN template_instances ON template_instances.pattern_id = template_patterns.id
WHERE template_patterns.project_id = ${sqlString(context.projectId)}
  AND template_patterns.pattern_key IN (${idList})
GROUP BY template_patterns.id;
`);
}

function loadExternalUsageRows(context, identifiers) {
  const idList = sqlStringList(identifiers);
  if (!idList) {
    return [];
  }

  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  observed_external_usages.id AS usage_id,
  observed_external_usages.usage_key,
  observed_external_usages.source_anchor,
  observed_external_usages.import_text,
  observed_external_usages.call_text,
  observed_external_usages.language,
  observed_external_usages.framework,
  utility_origins.origin_key,
  utility_origins.origin_type,
  utility_origins.display_name AS origin_display_name,
  utility_origins.summary AS origin_summary,
  origin_priorities.priority AS origin_priority,
  origin_priorities.reason AS origin_priority_reason
FROM observed_external_usages
LEFT JOIN utility_origins ON utility_origins.id = observed_external_usages.origin_id
LEFT JOIN origin_priorities ON origin_priorities.project_id = observed_external_usages.project_id
  AND origin_priorities.origin_id = utility_origins.id
WHERE observed_external_usages.project_id = ${sqlString(context.projectId)}
  AND observed_external_usages.usage_key IN (${idList});
`);
}

function loadArtifactMembers(context, artifactId) {
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  id,
  member_key,
  name,
  member_type,
  signature,
  source_anchor,
  summary,
  usage_notes,
  limitations,
  snippet
FROM artifact_members
WHERE artifact_id = ${sqlInteger(artifactId)}
ORDER BY name;
`);
}

function loadMemberSignatures(context, memberId) {
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  signature,
  source_anchor
FROM member_signatures
WHERE member_id = ${sqlInteger(memberId)}
ORDER BY
  CASE
    WHEN json_valid(source_anchor) THEN CAST(json_extract(source_anchor, '$.line') AS INTEGER)
    ELSE 1
  END,
  signature;
`);
}

function loadTemplateInstances(context, patternId) {
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  source_anchor,
  module_path,
  snippet
FROM template_instances
WHERE pattern_id = ${sqlInteger(patternId)}
ORDER BY source_anchor
LIMIT 20;
`);
}

function loadEntryCapabilityTags(context, entryType, entryId) {
  return runSqliteReadOnlyJson(context.dbPath, `
SELECT
  capability_tags.tag,
  capability_tags.description
FROM entry_capability_tags
JOIN capability_tags ON capability_tags.id = entry_capability_tags.tag_id
WHERE entry_capability_tags.project_id = ${sqlString(context.projectId)}
  AND entry_capability_tags.entry_type = ${sqlString(entryType)}
  AND entry_capability_tags.entry_id = ${sqlInteger(entryId)}
ORDER BY capability_tags.tag;
`);
}

function signatureEntryToOutput(signature) {
  return {
    signature: signature.signature,
    source_anchor: anchorToOutput(parseStoredSourceAnchor(signature.source_anchor)),
  };
}

function artifactEntryFromRow(context, row) {
  const members = loadArtifactMembers(context, row.artifact_id).map((member) => ({
    ...memberSignatureFields(loadMemberSignatures(context, member.id)),
    kind: 'member',
    identifier: member.member_key,
    name: member.name,
    member_type: member.member_type,
    source_anchor: anchorToOutput(parseStoredSourceAnchor(member.source_anchor)),
    summary: member.summary,
    usage_notes: member.usage_notes,
    limitations: member.limitations,
    capability_tags: loadEntryCapabilityTags(context, 'member', member.id),
    snippet: compactSnippet(member.snippet),
  }));

  return {
    kind: 'artifact',
    selector: `artifact:${row.artifact_key}`,
    identifier: row.artifact_key,
    title: row.name,
    artifact_type: row.artifact_type,
    language: row.language,
    framework: row.framework,
    module_path: row.module_path,
    source_anchor: anchorToOutput(parseStoredSourceAnchor(row.source_anchor)),
    summary: row.summary,
    usage_notes: row.usage_notes,
    limitations: row.limitations,
    capability_tags: loadEntryCapabilityTags(context, 'artifact', row.artifact_id),
    snippet: compactSnippet(row.snippet),
    origin: {
      key: row.origin_key,
      type: row.origin_type ?? 'project',
      display_name: row.origin_display_name,
      summary: row.origin_summary,
      priority: configuredOriginPriority({ origin_type: row.origin_type, origin_priority: row.origin_priority === null || row.origin_priority === undefined ? null : Number(row.origin_priority) }),
      priority_reason: row.origin_priority_reason,
    },
    members,
  };
}

function memberEntryFromRow(context, row) {
  const signatures = memberSignatureFields(loadMemberSignatures(context, row.member_id));
  return {
    ...signatures,
    kind: 'member',
    selector: `member:${row.member_key}`,
    identifier: row.member_key,
    title: `${row.artifact_name}.${row.member_name}`,
    name: row.member_name,
    member_type: row.member_type,
    language: row.language,
    framework: row.framework,
    module_path: row.module_path,
    source_anchor: anchorToOutput(parseStoredSourceAnchor(row.source_anchor)),
    summary: row.summary,
    usage_notes: row.usage_notes,
    limitations: row.limitations,
    capability_tags: loadEntryCapabilityTags(context, 'member', row.member_id),
    snippet: compactSnippet(row.snippet),
    artifact: {
      key: row.artifact_key,
      name: row.artifact_name,
      type: row.artifact_type,
    },
    origin: {
      key: row.origin_key,
      type: row.origin_type ?? 'project',
      display_name: row.origin_display_name,
      priority: configuredOriginPriority({ origin_type: row.origin_type, origin_priority: row.origin_priority === null || row.origin_priority === undefined ? null : Number(row.origin_priority) }),
      priority_reason: row.origin_priority_reason,
    },
  };
}

function memberSignatureFields(signatures) {
  const items = signatures.map(signatureEntryToOutput);
  return {
    signature: items[0]?.signature ?? null,
    signature_count: items.length,
    signatures: items,
  };
}

function templateEntryFromRow(context, row) {
  const instances = loadTemplateInstances(context, row.pattern_id).map((instance) => ({
    source_anchor: anchorToOutput(parseStoredSourceAnchor(instance.source_anchor)),
    module_path: instance.module_path,
    snippet: compactSnippet(instance.snippet),
  }));

  return {
    kind: 'template_pattern',
    selector: `template:${row.pattern_key}`,
    identifier: row.pattern_key,
    title: row.name,
    language: row.language,
    framework: row.framework,
    module_path: row.module_path,
    source_anchor: instances[0]?.source_anchor ?? null,
    summary: row.summary,
    usage_notes: row.usage_notes,
    limitations: row.limitations,
    capability_tags: loadEntryCapabilityTags(context, 'template_pattern', row.pattern_id),
    snippet: compactSnippet(row.snippet),
    instance_count: Number(row.instance_count ?? instances.length),
    instances,
  };
}

function externalUsageEntryFromRow(row) {
  return {
    kind: 'external_usage',
    selector: `external:${row.usage_key}`,
    identifier: row.usage_key,
    title: row.origin_display_name ?? row.origin_key ?? row.usage_key,
    language: row.language,
    framework: row.framework,
    module_path: getModulePath(parseStoredSourceAnchor(row.source_anchor)?.path ?? ''),
    source_anchor: anchorToOutput(parseStoredSourceAnchor(row.source_anchor)),
    summary: `Observed external utility usage from ${row.origin_display_name ?? row.origin_key}.`,
    import_text: row.import_text,
    call_text: row.call_text,
    snippet: compactSnippet(row.call_text ?? row.import_text),
    origin: {
      key: row.origin_key,
      type: row.origin_type ?? 'external',
      display_name: row.origin_display_name,
      summary: row.origin_summary,
      priority: configuredOriginPriority({ origin_type: row.origin_type ?? 'external', origin_priority: row.origin_priority === null || row.origin_priority === undefined ? null : Number(row.origin_priority) }),
      priority_reason: row.origin_priority_reason,
    },
  };
}

function loadCatalogEntry(context, selector) {
  const parsed = selectorCandidates(selector);
  const loaders = [
    {
      kind: 'artifact',
      load: () => loadArtifactRows(context, parsed.identifiers).map((row) => artifactEntryFromRow(context, row)),
    },
    {
      kind: 'member',
      load: () => loadMemberRows(context, parsed.identifiers).map((row) => memberEntryFromRow(context, row)),
    },
    {
      kind: 'template_pattern',
      load: () => loadTemplateRows(context, parsed.identifiers).map((row) => templateEntryFromRow(context, row)),
    },
    {
      kind: 'external_usage',
      load: () => loadExternalUsageRows(context, parsed.identifiers).map(externalUsageEntryFromRow),
    },
  ].filter((loader) => !parsed.kind || loader.kind === parsed.kind);

  const entries = loaders.flatMap((loader) => loader.load());
  if (entries.length === 0) {
    return {
      found: false,
      selector,
      entries: [],
      message: `No catalog entry matched selector '${selector}'.`,
    };
  }
  if (entries.length > 1) {
    return {
      found: false,
      selector,
      entries,
      message: `Selector '${selector}' is ambiguous; use a prefixed selector from query output.`,
    };
  }

  return {
    found: true,
    selector,
    entry: entries[0],
  };
}

function symbolNeedles(anchor, hints = {}) {
  const values = [
    anchor?.symbol,
    hints.name,
    hints.title,
    hints.signature,
    hints.importText,
    hints.callText,
    hints.snippet,
  ].filter(Boolean);
  const needles = new Set();

  for (const value of values) {
    const text = String(value).trim();
    if (!text) {
      continue;
    }
    needles.add(text);
    if (text.includes('#')) {
      needles.add(text.split('#').at(-1));
    }
    if (text.includes('.')) {
      needles.add(text.split('.').at(-1));
    }
    if (text.includes('/')) {
      needles.add(path.posix.basename(text, path.posix.extname(text)));
    }
  }

  return [...needles]
    .map((needle) => needle.replace(/\s+/g, ' ').trim())
    .filter((needle) => needle.length >= 2)
    .slice(0, 12);
}

function literalNeedles(values) {
  return [...new Set(values.filter(Boolean)
    .map((value) => String(value).replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 2))]
    .slice(0, 12);
}

function normalizedLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function findNeedleLine(lines, needles) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizedLine(lines[index]);
    if (needles.some((needle) => line.includes(normalizedLine(needle)))) {
      return index + 1;
    }
  }

  return null;
}

function verifySourceAnchor(rootPath, anchorOutput, hints = {}) {
  if (!anchorOutput || anchorOutput.invalid) {
    return {
      status: 'invalid-anchor',
      ok: false,
      anchor: anchorOutput,
      message: 'The stored source anchor is invalid.',
    };
  }

  const absolutePath = path.resolve(rootPath, anchorOutput.path);
  if (!isInsideRoot(rootPath, absolutePath)) {
    return {
      status: 'outside-root',
      ok: false,
      anchor: anchorOutput,
      message: 'The stored source anchor points outside the current root.',
    };
  }
  if (!fs.existsSync(absolutePath)) {
    return {
      status: 'missing-file',
      ok: false,
      anchor: anchorOutput,
      message: 'The referenced file is missing in the current working tree.',
    };
  }

  const text = fs.readFileSync(absolutePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const lineHint = Number.parseInt(anchorOutput.line, 10);
  const exactNeedles = literalNeedles(Array.isArray(hints.exactNeedles) ? hints.exactNeedles : []);
  const requiresExactNeedle = Boolean(hints.requireExactNeedle);
  const needles = exactNeedles.length > 0 || requiresExactNeedle
    ? exactNeedles
    : symbolNeedles(anchorOutput, hints);
  const identityLabel = requiresExactNeedle ? 'Stored usage text' : 'Symbol identity';
  const start = Math.max(1, lineHint - VERIFY_LINE_WINDOW);
  const end = Math.min(lines.length, lineHint + VERIFY_LINE_WINDOW);
  const windowLines = lines.slice(start - 1, end);
  const lineInWindow = findNeedleLine(windowLines, needles);

  if (lineInWindow !== null) {
    const actualLine = start + lineInWindow - 1;
    return {
      status: actualLine === lineHint ? 'verified' : 'verified-near-line-hint',
      ok: true,
      anchor: anchorOutput,
      actual_line: actualLine,
      message: actualLine === lineHint
        ? `${identityLabel} matched at the stored line hint.`
        : `${identityLabel} matched near the stored line hint.`,
    };
  }

  const relocatedLine = findNeedleLine(lines, needles);
  if (relocatedLine !== null) {
    return {
      status: 'relocated',
      ok: true,
      anchor: anchorOutput,
      actual_line: relocatedLine,
      message: `${identityLabel} moved away from the stored line hint.`,
    };
  }

  return {
    status: 'stale-symbol',
    ok: false,
    anchor: anchorOutput,
    message: requiresExactNeedle
      ? 'The referenced file exists, but the stored usage text was not found.'
      : 'The referenced file exists, but the symbol identity or snippet was not found.',
  };
}

function memberVerificationAnchors(member, labelPrefix) {
  const signatures = Array.isArray(member.signatures) && member.signatures.length > 0
    ? member.signatures
    : [{
      signature: member.signature,
      source_anchor: member.source_anchor,
    }];

  return signatures.map((signature, index) => ({
    label: `${labelPrefix}:signature:${index + 1}`,
    anchor: signature.source_anchor,
    hints: {
      name: member.name,
      signature: signature.signature,
      exactNeedles: [signature.signature],
      snippet: member.snippet,
    },
  }));
}

function verificationAnchors(entry) {
  if (entry.kind === 'artifact') {
    return [
      {
        label: 'artifact',
        anchor: entry.source_anchor,
        hints: {
          name: entry.title,
          snippet: entry.snippet,
        },
      },
      ...entry.members.flatMap((member) => memberVerificationAnchors(member, `member:${member.name}`)),
    ];
  }
  if (entry.kind === 'member') {
    return memberVerificationAnchors(entry, 'member');
  }
  if (entry.kind === 'template_pattern') {
    return entry.instances.map((instance, index) => ({
      label: `instance:${index + 1}`,
      anchor: instance.source_anchor,
      hints: {
        name: entry.identifier,
        snippet: instance.snippet ?? entry.snippet,
      },
    }));
  }
  if (entry.kind === 'external_usage') {
    return [{
      label: 'external-usage',
      anchor: entry.source_anchor,
      hints: {
        requireExactNeedle: true,
        exactNeedles: [
          entry.call_text,
          entry.call_text ? entry.snippet : null,
        ],
      },
    }];
  }

  return [];
}

function verifyCatalogEntry(context, entry) {
  const checks = verificationAnchors(entry).map((item) => ({
    label: item.label,
    ...verifySourceAnchor(context.rootPath, item.anchor, item.hints),
  }));

  return {
    status: checks.length > 0 && checks.every((check) => check.ok) ? 'verified' : 'stale-or-missing',
    ok: checks.length > 0 && checks.every((check) => check.ok),
    checks,
  };
}

function buildShowOutput(context, state, selector) {
  if (!state.readable) {
    return buildUnavailableIndexOutput('tool_catalog_show', context, state);
  }

  const loaded = loadCatalogEntry(context, selector);
  if (!loaded.found) {
    return {
      kind: 'tool_catalog_show',
      version: 1,
      generated_at: new Date().toISOString(),
      index_mutated: false,
      project: projectContextToOutput(context),
      selector,
      found: false,
      message: loaded.message,
      matches: loaded.entries.map((entry) => ({
        selector: entry.selector,
        kind: entry.kind,
        title: entry.title,
      })),
      warnings: [loaded.message],
    };
  }

  const verification = verifyCatalogEntry(context, loaded.entry);
  return {
    kind: 'tool_catalog_show',
    version: 1,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    selector,
    found: true,
    entry: loaded.entry,
    verification,
    warnings: verification.ok ? [] : ['This entry has stale or missing source anchors; run discovery to refresh the index.'],
  };
}

function renderCapabilityTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }

  return tags.map((tag) => `\`${tag.tag}\``).join(', ');
}

function renderSignatureLines(signatures, prefix = '- ') {
  return (signatures ?? []).map((signature) => `${prefix}\`${signature.signature}\` at \`${signature.source_anchor?.text ?? 'n/a'}\``);
}

function renderShowMarkdown(output) {
  const lines = [
    '# Tool Catalog Show',
    '',
    `Project: \`${output.project.project_id}\``,
    `Selector: \`${output.selector ?? 'n/a'}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
  ];

  if (!output.found) {
    lines.push('', '## Entry', `- ${output.message ?? 'Entry not found.'}`);
    if (output.matches?.length > 0) {
      lines.push('', '## Matching Selectors');
      for (const match of output.matches) {
        lines.push(`- \`${match.selector}\` ${match.kind} ${match.title}`);
      }
    }
  } else {
    const entry = output.entry;
    lines.push('', '## Entry');
    lines.push(`- Identifier: \`${entry.identifier}\``);
    lines.push(`- Kind: \`${entry.kind}\``);
    lines.push(`- Title: ${entry.title}`);
    lines.push(`- Source: \`${entry.source_anchor?.text ?? 'n/a'}\``);
    if (entry.language || entry.framework) {
      lines.push(`- Context: language \`${entry.language ?? 'n/a'}\`, framework \`${entry.framework ?? 'n/a'}\``);
    }
    if (entry.summary) {
      lines.push(`- Use: ${entry.summary}`);
    }
    const entryTags = renderCapabilityTags(entry.capability_tags);
    if (entryTags) {
      lines.push(`- Tags: ${entryTags}`);
    }
    if (entry.usage_notes) {
      lines.push(`- Usage notes: ${entry.usage_notes}`);
    }
    if (entry.limitations) {
      lines.push(`- Limitations: ${entry.limitations}`);
    }
    if ((entry.signatures?.length ?? 0) > 1) {
      lines.push(`- Signatures: ${entry.signatures.length}`);
      lines.push(...renderSignatureLines(entry.signatures, '  - '));
    } else if (entry.signature) {
      lines.push(`- Example: \`${entry.signature}\``);
    } else if (entry.snippet) {
      lines.push(`- Example: \`${entry.snippet}\``);
    }
    if (entry.origin) {
      lines.push(`- Origin: \`${entry.origin.type}:${entry.origin.display_name ?? entry.origin.key ?? 'project'}\`, priority \`${entry.origin.priority ?? 'n/a'}\``);
    }
    if (entry.members?.length > 0) {
      lines.push('', '## Members');
      for (const member of entry.members.slice(0, 12)) {
        const memberTags = renderCapabilityTags(member.capability_tags);
        lines.push(`- \`${member.name}\` ${member.signature_count > 1 ? `${member.signature_count} signatures ` : member.signature ? `\`${member.signature}\` ` : ''}at \`${member.source_anchor?.text ?? 'n/a'}\`${memberTags ? `; tags ${memberTags}` : ''}`);
        if (member.summary) {
          lines.push(`  Use: ${member.summary}`);
        }
        if (member.signature_count > 1) {
          lines.push(`  - Signatures: ${member.signature_count}`);
          lines.push(...renderSignatureLines(member.signatures.slice(0, 4), '  - '));
        }
      }
    }
    if (entry.instances?.length > 0) {
      lines.push('', '## Instances');
      for (const instance of entry.instances.slice(0, 8)) {
        lines.push(`- \`${instance.source_anchor?.text ?? 'n/a'}\`${instance.snippet ? ` example \`${instance.snippet}\`` : ''}`);
      }
    }
    if (entry.import_text) {
      lines.push('', '## Observed Usage');
      lines.push(`- Import: \`${entry.import_text}\``);
      if (entry.call_text) {
        lines.push(`- Call: \`${entry.call_text}\``);
      }
    }
    lines.push('', '## Verification');
    for (const check of output.verification.checks) {
      lines.push(`- \`${check.label}\` ${check.status}: ${check.message}`);
    }
  }

  if (output.warnings?.length > 0) {
    lines.push('', '## Notes');
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printShowOutput(output, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderShowMarkdown(output));
}

function buildVerifyOutput(context, state, selector) {
  if (!state.readable) {
    return buildUnavailableIndexOutput('tool_catalog_verify', context, state);
  }

  const loaded = loadCatalogEntry(context, selector);
  if (!loaded.found) {
    return {
      kind: 'tool_catalog_verify',
      version: 1,
      generated_at: new Date().toISOString(),
      index_mutated: false,
      project: projectContextToOutput(context),
      selector,
      found: false,
      ok: false,
      status: 'missing-entry',
      checks: [],
      warnings: [loaded.message],
    };
  }

  const verification = verifyCatalogEntry(context, loaded.entry);
  return {
    kind: 'tool_catalog_verify',
    version: 1,
    generated_at: new Date().toISOString(),
    index_mutated: false,
    project: projectContextToOutput(context),
    selector,
    found: true,
    entry: {
      selector: loaded.entry.selector,
      kind: loaded.entry.kind,
      identifier: loaded.entry.identifier,
      title: loaded.entry.title,
    },
    ok: verification.ok,
    status: verification.status,
    checks: verification.checks,
    warnings: verification.ok ? [] : ['One or more source anchors are stale or missing; refresh the index through discovery.'],
  };
}

function renderVerifyMarkdown(output) {
  const lines = [
    '# Tool Catalog Verify',
    '',
    `Project: \`${output.project.project_id}\``,
    `Selector: \`${output.selector ?? 'n/a'}\``,
    `Status: \`${output.status ?? 'n/a'}\``,
    `Index mutated: \`${output.index_mutated ?? false}\``,
    '',
    '## Checks',
  ];

  if (!output.checks || output.checks.length === 0) {
    lines.push('- None.');
  } else {
    for (const check of output.checks) {
      lines.push(`- \`${check.label}\` ${check.status}: ${check.anchor?.text ?? 'n/a'}${check.actual_line ? ` -> line ${check.actual_line}` : ''}`);
      lines.push(`  ${check.message}`);
    }
  }

  if (output.warnings?.length > 0) {
    lines.push('', '## Notes');
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printVerifyOutput(output, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderVerifyMarkdown(output));
}

function handleConfigProjectId(args, options) {
  const projectId = args[0];
  if (!projectId) {
    throw new ToolCatalogError('Missing project id. Usage: tool-catalog config project-id <id> [--root <path>]', 2);
  }

  assertValidProjectId(projectId);
  const catalogHome = getCatalogHome();
  const rootPath = resolveTargetRoot(options);
  const signals = buildIdentitySignals(rootPath);
  const config = readUserConfig(catalogHome);
  const nextConfig = setExplicitProjectId(config, rootPath, signals, projectId);
  const context = createProjectContext(options, nextConfig);

  ensureProjectIndex(context);
  writeUserConfig(catalogHome, nextConfig);
  printProjectContext(context, options, `Configured Tool Catalog project id '${projectId}'.`);
  return 0;
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
  const subcommandArgs = args.slice(1);

  if (options.help || subcommand === 'help') {
    printConfigHelp();
    return 0;
  }

  if (subcommand === 'project-id') {
    return handleConfigProjectId(subcommandArgs, options);
  }

  if (subcommand === 'info') {
    return handleConfigInfo(options);
  }

  throw new ToolCatalogError(`Unsupported Tool Catalog config command: ${subcommand}`, 2);
}

function handleDiscoverApply(discoverOptions) {
  const { data } = readJsonFile(discoverOptions.applyPath);
  const decisions = normalizeApplyDecisions(data);
  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  const context = createProjectContext(discoverOptions, config);
  const summary = applyDiscoveryDecisions(context, decisions);
  printDiscoveryApplySummary(summary, discoverOptions);
  return 0;
}

function handleDiscoverCommand(args, options) {
  const discoverOptions = parseDiscoverOptions(args, options);
  if (discoverOptions.help) {
    printDiscoverHelp();
    return 0;
  }
  if (discoverOptions.applyPath) {
    return handleDiscoverApply(discoverOptions);
  }

  const catalogHome = getCatalogHome();
  const config = readUserConfig(catalogHome);
  const context = createProjectContext(discoverOptions, config);
  const output = writeDiscoveryRunFiles(context, buildDiscoveryDryRun(context, discoverOptions));
  printDiscoveryDryRun(output, discoverOptions);
  return 0;
}

function handleTagsCommand(args, options) {
  const tagsOptions = parseTagsOptions(args, options);
  if (tagsOptions.help) {
    printTagsHelp();
    return 0;
  }

  const context = createConsultContext(tagsOptions);
  const state = consultIndexState(context);
  const output = buildTagsOutput(context, state);
  printTagsOutput(output, tagsOptions);
  return state.readable ? 0 : 1;
}

function handleQueryCommand(args, options) {
  const queryOptions = parseQueryOptions(args, options);
  if (queryOptions.help) {
    printQueryHelp();
    return 0;
  }

  const context = createConsultContext(queryOptions);
  const state = consultIndexState(context);
  const output = buildQueryOutput(context, state, queryOptions);
  printQueryOutput(output, queryOptions);
  return state.readable ? 0 : 1;
}

function handleShowCommand(args, options) {
  const showOptions = parseSelectorCommandOptions(args, options, 'show');
  if (showOptions.help) {
    printShowHelp();
    return 0;
  }

  const context = createConsultContext(showOptions);
  const state = consultIndexState(context);
  const output = buildShowOutput(context, state, showOptions.selector);
  printShowOutput(output, showOptions);
  return state.readable && output.found ? 0 : 1;
}

function handleVerifyCommand(args, options) {
  const verifyOptions = parseSelectorCommandOptions(args, options, 'verify');
  if (verifyOptions.help) {
    printVerifyHelp();
    return 0;
  }

  const context = createConsultContext(verifyOptions);
  const state = consultIndexState(context);
  const output = buildVerifyOutput(context, state, verifyOptions.selector);
  printVerifyOutput(output, verifyOptions);
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
    printHelp();
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
  process.stderr.write('Run `tool-catalog --help` for the available commands.\n');
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
