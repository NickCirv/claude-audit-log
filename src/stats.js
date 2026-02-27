import chalk from 'chalk';
import { readEntries, verifyChain } from './logger.js';

/**
 * Parse a user-supplied date string into a Date object.
 */
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: "${str}"`);
  return d;
}

/**
 * Aggregate and display summary statistics.
 */
export async function stats({ since: sinceStr } = {}) {
  let sinceDate = null;
  try {
    sinceDate = parseDate(sinceStr);
  } catch (err) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  const all = await readEntries();
  const entries = sinceDate
    ? all.filter((e) => new Date(e.timestamp) >= sinceDate)
    : all;

  if (entries.length === 0) {
    console.log(chalk.yellow('No audit entries found.'));
    return;
  }

  // --- Aggregate ---
  const byModel = {};
  const byTool = {};
  const byProject = {};
  const sessions = new Set();
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;
  let earliest = null;
  let latest = null;

  for (const e of entries) {
    const model = e.model || 'unknown';
    const tool = e.tool || 'unknown';
    const project = e.project || 'unknown';

    byModel[model] = (byModel[model] || 0) + 1;
    byTool[tool] = (byTool[tool] || 0) + 1;
    byProject[project] = (byProject[project] || 0) + 1;

    if (e.sessionId) sessions.add(e.sessionId);
    totalLinesAdded += e.linesAdded || 0;
    totalLinesRemoved += e.linesRemoved || 0;

    const ts = new Date(e.timestamp);
    if (!earliest || ts < earliest) earliest = ts;
    if (!latest || ts > latest) latest = ts;
  }

  // --- Chain integrity check ---
  const chain = await verifyChain();

  // --- Render ---
  const bar = chalk.dim('─'.repeat(50));

  console.log('');
  console.log(chalk.bold('claude-audit-log') + chalk.dim(' — summary stats'));
  console.log(bar);

  console.log(`${chalk.bold('Total entries:')}     ${entries.length}`);
  console.log(`${chalk.bold('Sessions:')}          ${sessions.size}`);
  console.log(
    `${chalk.bold('Lines added:')}       ${chalk.green('+' + totalLinesAdded)}`
  );
  console.log(
    `${chalk.bold('Lines removed:')}     ${chalk.red('-' + totalLinesRemoved)}`
  );
  if (earliest) {
    console.log(`${chalk.bold('First entry:')}       ${earliest.toLocaleString()}`);
    console.log(`${chalk.bold('Last entry:')}        ${latest.toLocaleString()}`);
  }
  console.log(
    `${chalk.bold('Chain integrity:')}   ` +
      (chain.valid ? chalk.green('VALID') : chalk.red(`BROKEN at entry #${chain.brokenAt}`))
  );

  // By model
  console.log('');
  console.log(chalk.bold('By model:'));
  Object.entries(byModel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([m, count]) => {
      const pct = ((count / entries.length) * 100).toFixed(1);
      console.log(`  ${chalk.magenta(m.padEnd(30))} ${count} (${pct}%)`);
    });

  // By tool
  console.log('');
  console.log(chalk.bold('By tool:'));
  Object.entries(byTool)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, count]) => {
      const pct = ((count / entries.length) * 100).toFixed(1);
      console.log(`  ${chalk.cyan(t.padEnd(30))} ${count} (${pct}%)`);
    });

  // By project (top 10)
  const projectEntries = Object.entries(byProject).sort((a, b) => b[1] - a[1]);
  console.log('');
  console.log(chalk.bold(`By project (top ${Math.min(10, projectEntries.length)}):`));
  projectEntries.slice(0, 10).forEach(([p, count]) => {
    const label = p.length > 40 ? '...' + p.slice(-37) : p;
    const pct = ((count / entries.length) * 100).toFixed(1);
    console.log(`  ${chalk.dim(label.padEnd(40))} ${count} (${pct}%)`);
  });

  console.log('');
}
