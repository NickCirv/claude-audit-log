import chalk from 'chalk';
import { readEntries } from './logger.js';

/**
 * Search audit entries by query string.
 * Matches against: file paths, model, tool, project, sessionId.
 */
export async function search(query, { limit = 20 } = {}) {
  if (!query || !query.trim()) {
    console.error(chalk.red('Search query cannot be empty.'));
    process.exit(1);
  }

  const all = await readEntries();

  if (all.length === 0) {
    console.log(chalk.yellow('No audit entries found.'));
    return;
  }

  const q = query.toLowerCase();

  const matches = all.filter((e) => {
    const fields = [
      e.model,
      e.tool,
      e.project,
      e.sessionId,
      ...(Array.isArray(e.files) ? e.files : []),
    ]
      .filter(Boolean)
      .map((f) => f.toLowerCase());

    return fields.some((f) => f.includes(q));
  });

  if (matches.length === 0) {
    console.log(chalk.yellow(`No entries matched "${query}".`));
    return;
  }

  // Newest first, respect limit
  const sorted = [...matches].reverse().slice(0, limit);

  console.log('');
  console.log(
    chalk.bold('claude-audit-log') +
      chalk.dim(` — search: "${query}"  ${matches.length} match${matches.length !== 1 ? 'es' : ''}`)
  );
  console.log(chalk.dim('─'.repeat(60)));
  console.log('');

  sorted.forEach((entry, i) => {
    const ts = new Date(entry.timestamp).toLocaleString();
    const files = Array.isArray(entry.files) ? entry.files : [];

    console.log(
      chalk.bold(`#${i + 1}`) +
        chalk.dim(` [${(entry.sessionId || '').slice(0, 8)}]`) +
        '  ' +
        chalk.yellow(ts)
    );
    console.log(
      `  ${chalk.cyan(entry.tool || '?')}  ${chalk.magenta(entry.model || 'unknown')}  ` +
        chalk.dim(entry.project || '—')
    );

    if (files.length > 0) {
      files.forEach((f) => {
        // Highlight the matched portion
        const idx = f.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const before = f.slice(0, idx);
          const match = f.slice(idx, idx + q.length);
          const after = f.slice(idx + q.length);
          console.log(`  ${chalk.dim(before)}${chalk.yellow(match)}${chalk.dim(after)}`);
        } else {
          console.log(`  ${chalk.dim(f)}`);
        }
      });
    }

    console.log(chalk.dim('─'.repeat(60)));
    console.log('');
  });

  if (matches.length > limit) {
    console.log(chalk.dim(`Showing ${limit} of ${matches.length} matches. Use --limit to see more.`));
  }
}
