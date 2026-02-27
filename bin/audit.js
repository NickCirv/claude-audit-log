#!/usr/bin/env node

import { program } from 'commander';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(join(__dirname, '../package.json'));

import { install } from '../src/installer.js';
import { view } from '../src/viewer.js';
import { exportAudit } from '../src/exporter.js';
import { stats } from '../src/stats.js';
import { search } from '../src/index.js';

program
  .name('claude-audit-log')
  .description('Compliance audit trail for AI-generated code changes')
  .version(pkg.version);

program
  .command('install')
  .description('Install PostToolUse hook into Claude Code settings.json')
  .option('--settings <path>', 'Path to Claude settings.json', null)
  .action(async (opts) => {
    await install(opts.settings);
  });

program
  .command('view')
  .description('Browse audit entries in paginated terminal view')
  .option('-n, --limit <number>', 'Number of entries to show', '20')
  .option('-p, --page <number>', 'Page number', '1')
  .option('--project <path>', 'Filter by project path')
  .option('--model <name>', 'Filter by model')
  .option('--tool <name>', 'Filter by tool name')
  .action(async (opts) => {
    await view({
      limit: parseInt(opts.limit, 10),
      page: parseInt(opts.page, 10),
      project: opts.project,
      model: opts.model,
      tool: opts.tool,
    });
  });

program
  .command('export')
  .description('Export audit log for compliance (CSV or JSON)')
  .option('--format <type>', 'Output format: csv or json', 'csv')
  .option('--output <file>', 'Output file path (default: stdout)')
  .option('--since <date>', 'Filter entries after date (ISO 8601 or YYYY-MM-DD)')
  .option('--until <date>', 'Filter entries before date (ISO 8601 or YYYY-MM-DD)')
  .option('--project <path>', 'Filter by project path')
  .action(async (opts) => {
    await exportAudit({
      format: opts.format,
      output: opts.output,
      since: opts.since,
      until: opts.until,
      project: opts.project,
    });
  });

program
  .command('stats')
  .description('Summary statistics: total changes, by model, by project')
  .option('--since <date>', 'Filter entries after date (ISO 8601 or YYYY-MM-DD)')
  .action(async (opts) => {
    await stats({ since: opts.since });
  });

program
  .command('search <query>')
  .description('Search audit entries by file path, session, model, or tool')
  .option('-n, --limit <number>', 'Max results', '20')
  .action(async (query, opts) => {
    await search(query, { limit: parseInt(opts.limit, 10) });
  });

program.parseAsync(process.argv);
