import { createHash } from 'crypto';
import { appendFile, readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const AUDIT_DIR = join(homedir(), '.claude-audit');
const AUDIT_FILE = join(AUDIT_DIR, 'audit.jsonl');
const CHAIN_FILE = join(AUDIT_DIR, 'chain-head.txt');

/**
 * Ensure ~/.claude-audit/ exists.
 */
async function ensureDir() {
  if (!existsSync(AUDIT_DIR)) {
    await mkdir(AUDIT_DIR, { recursive: true });
  }
}

/**
 * Read the current chain head hash (last entry hash).
 * Returns '0'.repeat(64) if this is the first entry.
 */
async function readChainHead() {
  try {
    const head = await readFile(CHAIN_FILE, 'utf8');
    return head.trim();
  } catch {
    return '0'.repeat(64);
  }
}

/**
 * Write updated chain head.
 */
async function writeChainHead(hash) {
  await writeFile(CHAIN_FILE, hash, 'utf8');
}

/**
 * Compute SHA-256 of an entry payload + previous hash.
 * Provides a tamper-evident chain: changing any past entry
 * breaks all subsequent hashes.
 */
function computeHash(entry, prevHash) {
  const payload = JSON.stringify(entry) + prevHash;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Append one audit entry to the JSONL file.
 *
 * @param {object} entry - The audit record (pre-built by hook or caller)
 */
export async function appendEntry(entry) {
  await ensureDir();

  const prevHash = await readChainHead();
  const hash = computeHash(entry, prevHash);

  const record = { ...entry, prevHash, hash };
  await appendFile(AUDIT_FILE, JSON.stringify(record) + '\n', 'utf8');
  await writeChainHead(hash);

  return record;
}

/**
 * Read all entries from the JSONL file.
 * Returns an array sorted oldest-first.
 */
export async function readEntries() {
  await ensureDir();

  if (!existsSync(AUDIT_FILE)) {
    return [];
  }

  const raw = await readFile(AUDIT_FILE, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Verify the hash chain integrity.
 * Returns { valid: boolean, brokenAt: number|null }
 */
export async function verifyChain() {
  const entries = await readEntries();
  let prevHash = '0'.repeat(64);

  for (let i = 0; i < entries.length; i++) {
    const { prevHash: storedPrev, hash, ...rest } = entries[i];

    if (storedPrev !== prevHash) {
      return { valid: false, brokenAt: i, entry: entries[i] };
    }

    const expected = computeHash(rest, prevHash);
    if (expected !== hash) {
      return { valid: false, brokenAt: i, entry: entries[i] };
    }

    prevHash = hash;
  }

  return { valid: true, brokenAt: null };
}

export { AUDIT_FILE, AUDIT_DIR };
