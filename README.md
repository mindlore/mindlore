<p align="center">
  <img src="assets/mindlore-logo.png" alt="Mindlore" width="320">
</p>

![CI](https://github.com/mindlore/mindlore/actions/workflows/ci.yml/badge.svg)
[![npm](https://img.shields.io/npm/v/mindlore)](https://www.npmjs.com/package/mindlore)
![Node](https://img.shields.io/node/v/mindlore)
![License](https://img.shields.io/badge/license-MIT-blue)
![Zero Telemetry](https://img.shields.io/badge/telemetry-zero-brightgreen)

> AI-native knowledge system for [Claude Code](https://claude.ai/claude-code)

Persistent, searchable, evolving knowledge base that compounds across sessions.

## Why Mindlore?

Claude Code forgets everything between sessions. Your corrections, discoveries, and decisions vanish. Mindlore gives Claude a persistent memory:

- **Knowledge persists** across sessions via FTS5-indexed Markdown files
- **Search happens automatically** — hooks inject relevant context as you work
- **Knowledge compounds** — query answers become searchable for future sessions

| Feature | Mindlore | Typical KB CLI | Wiki Compilers | Multi-Agent Memory |
|---------|----------|---------------|----------------|-------------------|
| Zero workflow change | Hook-based, invisible | Manual commands | Manual compile | Agent orchestration |
| Persistent search | FTS5 auto-indexed | Manual index | No search | Vector DB overhead |
| Knowledge compounding | Writeback loop | No | No | Partial |
| Token efficient | Progressive disclosure | Full dump | Full dump | Varies |
| Setup time | `npx mindlore init` | Config + setup | Complex | Complex |

## Quick Start

```bash
npx mindlore init
```

That's it. Mindlore creates a `~/.mindlore/` directory, sets up hooks, and starts working.

To add your first source:

```
/mindlore-ingest https://example.com/article
```

### CLI Commands

```bash
npx mindlore health          # 16-point structural health check
npx mindlore search "query"  # FTS5 keyword search
npx mindlore index           # Full FTS5 re-index
npx mindlore quality         # Bulk quality assignment for sources
npx mindlore backup init     # Git-based backup for ~/.mindlore/
npx mindlore backup status   # Show backup status + last commit
npx mindlore obsidian export --vault /path  # Export to Obsidian vault
npx mindlore obsidian import --vault /path  # Import from Obsidian vault
npx mindlore episodes list                  # List recent episodes
npx mindlore episodes search "query"        # Search episodic memory
npx mindlore episodes count                 # Episode count per project
```

## Features

| Skill | Description |
|-------|-------------|
| `/mindlore-ingest` | Add knowledge sources (URL, text, file, PDF) + 6-point quality gate |
| `/mindlore-health` | 16-point structural health check |
| `/mindlore-query` | Search, ask, stats, brief — compounding knowledge pipeline |
| `/mindlore-log` | Session logging, diary analysis, reflect pattern extraction |
| `/mindlore-decide` | Decision records with supersedes chain |
| `/mindlore-evolve` | Schema co-evolution and structural updates |
| `/mindlore-explore` | Cross-reference discovery between sources |

## Architecture

Knowledge flows through a compiler-like pipeline:

```
raw/        Immutable source captures (URL dumps, pasted text)
  |
sources/    Processed summaries (one per ingested source)
  |
domains/    Topic wiki pages (accumulated knowledge by subject)
  |
insights/   Query writebacks (answers that become searchable)
```

Nine directories, each mapping to a frontmatter `type`:

```
.mindlore/
├── raw/            # Immutable captures
├── sources/        # Processed summaries
├── domains/        # Topic wikis
├── analyses/       # Large syntheses (3+ sources)
├── insights/       # Short Q&A writebacks
├── connections/    # Cross-cutting links
├── learnings/      # Persistent rules from reflect
├── diary/          # Session deltas
├── decisions/      # Decision records
├── INDEX.md        # Navigation map (~15 lines)
├── SCHEMA.md       # LLM specification
└── mindlore.db     # FTS5 search database
```

## Installation

### Minimal (default)

```bash
npx mindlore init
```

Requires: Node.js 20+, `better-sqlite3` (installed automatically).

### Recommended

```bash
npx mindlore init --recommended
```

Also suggests installing:
- **markitdown** — better web/document extraction (URL, DOCX, YouTube)
- **context-mode** — token savings for large sessions

## How It Works

Mindlore operates through Claude Code lifecycle hooks — invisible background scripts
that fire automatically as you work. No commands to run, no workflow changes.

```
                          ┌─────────────────────────────┐
                          │     Claude Code Session      │
                          └──────────────┬──────────────┘
                                         │
  ┌──────────────────────────────────────┼──────────────────────────────────────┐
  │                                      │                                      │
  ▼                                      ▼                                      ▼
SESSION START                      DURING SESSION                         SESSION END
  │                                      │                                      │
  ├─ session-focus hook            ├─ search hook                         ├─ session-end hook
  │  reads INDEX.md + last delta   │  10-col FTS5 + porter stemmer        │  writes delta to diary/
  │  injects into context          │  per-keyword scoring, top 3 injected │
  │                                │                                      │
  │                                ├─ index + fts5-sync hooks             │
  │                                │  file changes → FTS5 update          │
  │                                │                                      │
  │                                ├─ /mindlore-ingest skill              │
  │                                │  URL → raw/ → sources/ → FTS5       │
  │                                │                                      │
  └────────────────────────────────┴──────────────────────────────────────┘
                                         │
                          ┌──────────────┴──────────────┐
                          │       NEXT SESSION           │
                          │  session-focus injects delta  │
                          │  → knowledge compounds       │
                          └─────────────────────────────┘
```

**Key design decisions:**

- **Hooks are global** — registered in `~/.claude/settings.json`, active in all projects
- **Single global store** — `~/.mindlore/` shared across projects; `project` FTS5 column namespaces per `path.basename(cwd)`
- **Project-scoped search** — results filtered by current project, falls back to all projects if none found
- **No `.mindlore/`?** — hooks silently skip, zero overhead
- **FTS5 search** — SQLite full-text search with BM25 ranking, no external services
- **Content-hash dedup** — SHA256 prevents re-indexing unchanged files

## Configuration

Mindlore creates `.mindlore/config.json` with model defaults for cost-optimized agent delegation:

```json
{
  "models": {
    "ingest": "haiku",
    "evolve": "sonnet",
    "explore": "sonnet",
    "default": "haiku"
  }
}
```

Skills spawn subagents with `[mindlore:SKILL]` markers — the model-router hook reads `config.json` and overrides the model automatically. Override any value to change routing.

## Hooks

13 Claude Code lifecycle hooks (v0.4.2):

| Event | Hook | What it does |
|-------|------|-------------|
| SessionStart | session-focus | Injects last delta + INDEX + last 3 episodes + version check |
| UserPromptSubmit | search | FTS5 search + episodes recall, project-scoped |
| UserPromptSubmit | decision-detector | TR+EN decision signal detection |
| FileChanged | index | Sync changed files to FTS5 |
| FileChanged | fts5-sync | Incremental batch re-index |
| SessionEnd | session-end | Structured delta + bare episode + FTS5 mirror + git sync |
| PreCompact | pre-compact | FTS5 flush before compaction |
| PostCompact | post-compact | Re-inject context |
| PreToolUse (Read) | read-guard | Repeated-read warning, blocks 3+ repeats |
| PostToolUse (Read) | post-read | Token estimation per file read |
| PreToolUse (Write\|Edit) | dont-repeat | LESSONS/learnings rule enforcement |
| CwdChanged | cwd-changed | Scope detection + _scope.json write |
| PreToolUse (Agent) | model-router | Cost-optimized model routing via markers |

## Uninstall

```bash
npx mindlore uninstall        # Remove hooks + skills (keep data)
npx mindlore uninstall --all  # Also remove ~/.mindlore/ global data
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

## Inspired By

- [Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — LLM Knowledge Bases concept
- [Spisak](https://github.com/nickspisak) — Practical second brain implementations
- [Letta](https://github.com/letta-ai/letta-code) — Context repository pattern validation

## License

[MIT](LICENSE)
