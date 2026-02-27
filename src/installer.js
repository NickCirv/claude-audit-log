import { readFile, writeFile, chmod } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve Claude Code global settings.json path.
 * Falls back to ~/.claude/settings.json.
 */
function resolveSettingsPath(override) {
  if (override) return resolve(override);
  return join(homedir(), '.claude', 'settings.json');
}

/**
 * Build the hook entry for settings.json.
 * Points at the hook.sh script shipped with this package.
 */
function buildHookEntry() {
  const hookScript = resolve(join(__dirname, '../scripts/hook.sh'));
  return {
    type: 'command',
    command: `bash "${hookScript}"`,
  };
}

/**
 * Install the PostToolUse hook into Claude Code settings.json.
 */
export async function install(settingsPathOverride = null) {
  const settingsPath = resolveSettingsPath(settingsPathOverride);

  console.log(chalk.cyan('claude-audit-log') + ' — installing PostToolUse hook');
  console.log(chalk.dim(`Settings file: ${settingsPath}`));

  let settings = {};

  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(raw);
    } catch (err) {
      console.error(chalk.red(`Failed to parse ${settingsPath}: ${err.message}`));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow(`Settings file not found — creating at ${settingsPath}`));
  }

  // Ensure hooks structure exists
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  // Check for duplicate
  const hookEntry = buildHookEntry();
  const alreadyInstalled = settings.hooks.PostToolUse.some(
    (h) => typeof h === 'object' && h.command && h.command === hookEntry.command
  );

  if (alreadyInstalled) {
    console.log(chalk.green('Hook already installed. Nothing to do.'));
    return;
  }

  settings.hooks.PostToolUse.push(hookEntry);

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  // Ensure hook.sh is executable
  const hookScript = resolve(join(__dirname, '../scripts/hook.sh'));
  try {
    await chmod(hookScript, 0o755);
  } catch {
    // Non-fatal — may not have permissions in npx context
  }

  console.log(chalk.green('PostToolUse hook installed successfully.'));
  console.log(chalk.dim('Audit entries will be written to ~/.claude-audit/audit.jsonl'));
  console.log('');
  console.log(`Run ${chalk.cyan('claude-audit-log view')} to browse entries after your next Claude Code session.`);
}
