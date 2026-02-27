import chalk from 'chalk';
import { readEntries } from './logger.js';

/**
 * Format a single audit entry for terminal display.
 */
function formatEntry(entry, index) {
  const ts = new Date(entry.timestamp).toLocaleString();
  const linesAdded = entry.linesAdded != null ? chalk.green(`+${entry.linesAdded}`) : '';
  const linesRemoved = entry.linesRemoved != null ? chalk.red(`-${entry.linesRemoved}`) : '';
  const lineDelta = [linesAdded, linesRemoved].filter(Boolean).join(' ');

  const files = Array.isArray(entry.files)
    ? entry.files.map((f) => chalk.dim(f)).join('\n    ')
    : chalk.dim('(no files)');

  const gitBefore = entry.gitHashBefore ? chalk.dim(entry.gitHashBefore.slice(0, 8)) : chalk.dim('—');
  const gitAfter = entry.gitHashAfter ? chalk.dim(entry.gitHashAfter.slice(0, 8)) : chalk.dim('—');

  const lines = [
    chalk.bold(`#${index + 1}`) +
      chalk.dim(` [${entry.sessionId ? entry.sessionId.slice(0, 8) : '—'}]`) +
      '  ' +
      chalk.yellow(ts),
    `  ${chalk.cyan(entry.tool || '?')}  ` +
      chalk.magenta(entry.model || 'unknown') +
      (lineDelta ? `  ${lineDelta}` : ''),
    `  ${chalk.bold('Project:')} ${chalk.dim(entry.project || '—')}`,
    `  ${chalk.bold('Files:')}`,
    `    ${files}`,
    `  ${chalk.bold('Git:')} ${gitBefore} → ${gitAfter}`,
    `  ${chalk.bold('Hash:')} ${chalk.dim((entry.hash || '').slice(0, 16))}...`,
    chalk.dim('─'.repeat(60)),
  ];

  return lines.join('\n');
}

/**
 * Apply filters to the full entry list.
 */
function applyFilters(entries, { project, model, tool }) {
  return entries.filter((e) => {
    if (project && !(e.project || '').includes(project)) return false;
    if (model && (e.model || '') !== model) return false;
    if (tool && (e.tool || '') !== tool) return false;
    return true;
  });
}

/**
 * Paginated terminal viewer for audit entries.
 */
export async function view({ limit = 20, page = 1, project, model, tool } = {}) {
  const all = await readEntries();

  if (all.length === 0) {
    console.log(chalk.yellow('No audit entries found.'));
    console.log(chalk.dim('Run `claude-audit-log install` to set up the hook.'));
    return;
  }

  const filtered = applyFilters(all, { project, model, tool });

  if (filtered.length === 0) {
    console.log(chalk.yellow('No entries match the specified filters.'));
    return;
  }

  // Newest first
  const sorted = [...filtered].reverse();
  const totalPages = Math.ceil(sorted.length / limit);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;
  const slice = sorted.slice(start, start + limit);

  console.log('');
  console.log(
    chalk.bold('claude-audit-log') +
      chalk.dim(` — ${filtered.length} entries`) +
      (project ? chalk.dim(` · project: ${project}`) : '') +
      (model ? chalk.dim(` · model: ${model}`) : '') +
      (tool ? chalk.dim(` · tool: ${tool}`) : '')
  );
  console.log(chalk.dim('─'.repeat(60)));
  console.log('');

  slice.forEach((entry, i) => {
    console.log(formatEntry(entry, start + i));
    console.log('');
  });

  if (totalPages > 1) {
    console.log(
      chalk.dim(`Page ${safePage} of ${totalPages}`) +
        '  ' +
        chalk.dim(`Use --page ${safePage + 1} for next page`)
    );
  }
}
