<div align="center">

# claude-audit-log

**Tamper-evident audit trail for every Claude Code tool call — SOC2 / ISO 27001 ready**

[![License: MIT](https://img.shields.io/badge/License-MIT-0B0A09?style=flat-square&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Node: >=18](https://img.shields.io/badge/Node-%3E%3D18-0B0A09?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)

</div>

## Install

```bash
npx github:NickCirv/claude-audit-log install
```

Adds a `PostToolUse` hook to `~/.claude/settings.json`. Logging starts on the next Claude Code session.

## Usage

```bash
# Browse entries (newest first)
npx github:NickCirv/claude-audit-log view
npx github:NickCirv/claude-audit-log view --limit 50 --project /my/repo --model claude-sonnet-4-6

# Export for compliance
npx github:NickCirv/claude-audit-log export --format csv --output audit-2026-02.csv
npx github:NickCirv/claude-audit-log export --format json --since 2026-02-01 --until 2026-02-28

# Summary statistics
npx github:NickCirv/claude-audit-log stats --since 2026-01-01

# Search by file path, model, or session
npx github:NickCirv/claude-audit-log search src/auth
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max entries to show (default: 20) |
| `--page <n>` | Page number for view |
| `--project <path>` | Filter by project path |
| `--model <name>` | Filter by model name |
| `--tool <name>` | Filter by tool name (Edit, Write, Bash…) |
| `--format csv\|json` | Export format |
| `--since / --until` | ISO 8601 date range filter |
| `--output <file>` | Export destination (default: stdout) |

## What it does

Hooks into Claude Code's `PostToolUse` event and appends one JSON line per tool call to `~/.claude-audit/audit.jsonl`, recording the model, tool name, files touched, lines added/removed, and git hash before/after. Each entry is SHA-256 chained to the previous — any tampering breaks the chain. Export to CSV or JSON for SOC2 Type II evidence, ISO 27001 audit trails, or GDPR/HIPAA oversight reports.

---
<sub>Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
