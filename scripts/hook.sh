#!/usr/bin/env bash
# claude-audit-log — PostToolUse hook
# Receives tool invocation context via stdin (JSON) and appends to audit log.
# Runs after every tool call in a Claude Code session.

AUDIT_DIR="${HOME}/.claude-audit"
AUDIT_FILE="${AUDIT_DIR}/audit.jsonl"
CHAIN_FILE="${AUDIT_DIR}/chain-head.txt"

# Ensure audit directory exists
mkdir -p "${AUDIT_DIR}"

# Read stdin into a temp file to avoid heredoc quoting issues
TMPFILE="$(mktemp)"
cat > "${TMPFILE}"

# Bail out if nothing was passed
if [ ! -s "${TMPFILE}" ]; then
  rm -f "${TMPFILE}"
  exit 0
fi

# Delegate all processing to Python — avoids jq dependency
python3 - "${TMPFILE}" "${AUDIT_FILE}" "${CHAIN_FILE}" <<'PYEOF'
import json, hashlib, sys, os, subprocess, re
from datetime import datetime, timezone

_, input_file, audit_file, chain_file = sys.argv[:4]

# Read raw JSON from temp file
try:
    with open(input_file, 'r') as f:
        raw = f.read().strip()
    payload = json.loads(raw) if raw else {}
except Exception:
    sys.exit(0)

# --- Extract fields ---
tool_name   = payload.get('tool_name', payload.get('tool', 'unknown'))
tool_input  = payload.get('tool_input', payload.get('input', {}))
session_id  = payload.get('session_id', os.environ.get('CLAUDE_SESSION_ID', ''))
model       = payload.get('model', os.environ.get('CLAUDE_MODEL', 'unknown'))
project     = os.environ.get('CLAUDE_PROJECT', os.getcwd())

if not isinstance(tool_input, dict):
    tool_input = {}

# --- Derive file paths affected ---
files = []

if tool_name in ('Edit', 'MultiEdit', 'str_replace_editor', 'str_replace_based_edit_tool'):
    p = tool_input.get('path') or tool_input.get('file_path', '')
    if p:
        files.append(p)

elif tool_name == 'Write':
    p = tool_input.get('file_path', '')
    if p:
        files.append(p)

elif tool_name == 'Bash':
    cmd = tool_input.get('command', '')
    # Heuristic: grab absolute paths from command string
    found = re.findall(r'(?:^|\s)(\/[^\s"\'`]+\.\w+)', cmd)
    files.extend(found[:5])

elif tool_name in ('Read', 'Glob', 'Grep'):
    p = tool_input.get('file_path') or tool_input.get('path', '')
    if p:
        files.append(p)

# Deduplicate while preserving order
seen = set()
files = [f for f in files if not (f in seen or seen.add(f))]

# --- Derive line delta ---
lines_added   = None
lines_removed = None

if tool_name in ('Edit', 'str_replace_editor', 'str_replace_based_edit_tool'):
    old = tool_input.get('old_string', '')
    new = tool_input.get('new_string', '')
    lines_added   = len(new.splitlines()) if new else 0
    lines_removed = len(old.splitlines()) if old else 0

elif tool_name == 'Write':
    content = tool_input.get('content', '')
    lines_added   = len(content.splitlines()) if content else 0
    lines_removed = 0

# --- Git hash ---
git_hash = ''
try:
    git_hash = subprocess.check_output(
        ['git', 'rev-parse', '--short', 'HEAD'],
        cwd=project,
        stderr=subprocess.DEVNULL
    ).decode().strip()
except Exception:
    pass

# --- Session ID fallback (stable per Claude session via parent PID) ---
if not session_id:
    ppid = str(os.environ.get('PPID', os.getppid()))
    session_id = hashlib.sha256(ppid.encode()).hexdigest()[:16]

# --- Build entry ---
entry = {
    'timestamp':     datetime.now(timezone.utc).isoformat(),
    'sessionId':     session_id,
    'model':         model,
    'tool':          tool_name,
    'project':       project,
    'files':         files,
    'linesAdded':    lines_added,
    'linesRemoved':  lines_removed,
    'gitHashBefore': git_hash,
    'gitHashAfter':  git_hash,
}

# --- Hash chain (tamper detection) ---
def read_chain_head():
    try:
        with open(chain_file, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return '0' * 64

def write_chain_head(h):
    with open(chain_file, 'w') as f:
        f.write(h)

def compute_hash(entry_dict, prev):
    payload = json.dumps(entry_dict, separators=(',', ':'), sort_keys=True) + prev
    return hashlib.sha256(payload.encode()).hexdigest()

prev_hash = read_chain_head()
h = compute_hash(entry, prev_hash)

record = {**entry, 'prevHash': prev_hash, 'hash': h}

# --- Atomic append to JSONL ---
with open(audit_file, 'a') as f:
    f.write(json.dumps(record) + '\n')

write_chain_head(h)
PYEOF

rm -f "${TMPFILE}"
exit 0
