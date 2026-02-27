import { writeFile } from 'fs/promises';
import chalk from 'chalk';
import { readEntries } from './logger.js';

/**
 * Parse a user-supplied date string into a Date object.
 * Accepts ISO 8601 and YYYY-MM-DD.
 */
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: "${str}". Use ISO 8601 or YYYY-MM-DD.`);
  }
  return d;
}

/**
 * Apply date + project filters.
 */
function filterEntries(entries, { since, until, project }) {
  return entries.filter((e) => {
    const ts = new Date(e.timestamp);
    if (since && ts < since) return false;
    if (until && ts > until) return false;
    if (project && !(e.project || '').includes(project)) return false;
    return true;
  });
}

/**
 * Convert entries array to CSV string.
 * All fields are quoted to handle commas in paths.
 */
function toCSV(entries) {
  const HEADERS = [
    'timestamp',
    'sessionId',
    'model',
    'tool',
    'project',
    'files',
    'linesAdded',
    'linesRemoved',
    'gitHashBefore',
    'gitHashAfter',
    'hash',
    'prevHash',
  ];

  const escape = (val) => {
    if (val == null) return '';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = entries.map((e) => [
    escape(e.timestamp),
    escape(e.sessionId),
    escape(e.model),
    escape(e.tool),
    escape(e.project),
    escape(Array.isArray(e.files) ? e.files.join('; ') : e.files),
    escape(e.linesAdded),
    escape(e.linesRemoved),
    escape(e.gitHashBefore),
    escape(e.gitHashAfter),
    escape(e.hash),
    escape(e.prevHash),
  ]);

  return [HEADERS.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export audit log to CSV or JSON.
 */
export async function exportAudit({ format = 'csv', output, since: sinceStr, until: untilStr, project } = {}) {
  let sinceDate = null;
  let untilDate = null;

  try {
    sinceDate = parseDate(sinceStr);
    untilDate = parseDate(untilStr);
  } catch (err) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  const all = await readEntries();
  const filtered = filterEntries(all, { since: sinceDate, until: untilDate, project });

  if (filtered.length === 0) {
    console.error(chalk.yellow('No entries match the specified filters.'));
    return;
  }

  let content;
  const fmt = format.toLowerCase();

  if (fmt === 'json') {
    content = JSON.stringify(filtered, null, 2);
  } else if (fmt === 'csv') {
    content = toCSV(filtered);
  } else {
    console.error(chalk.red(`Unknown format: "${format}". Use csv or json.`));
    process.exit(1);
  }

  if (output) {
    await writeFile(output, content, 'utf8');
    console.log(chalk.green(`Exported ${filtered.length} entries → ${output}`));
  } else {
    process.stdout.write(content + '\n');
  }
}
