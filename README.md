# Mindlore

AI-native knowledge system for [Claude Code](https://claude.ai/claude-code).

Persistent, searchable, evolving knowledge base that compounds across sessions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)

## Why

Claude Code forgets everything between sessions. Your corrections, discoveries, and decisions vanish. Mindlore gives Claude a persistent memory:

- **Knowledge persists** across sessions via FTS5-indexed Markdown files
- **Search happens automatically** — hooks inject relevant context as you work
- **Knowledge compounds** — query answers become searchable for future sessions

## Why Mindlore?

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

That's it. Mindlore creates a `.mindlore/` directory, sets up hooks, and starts working.

To add your first source:

```
/mindlore-ingest https://example.com/article
```

## Features

| Skill | Version | Description |
|-------|---------|-------------|
| `/mindlore-ingest` | v0.1 | Add knowledge sources (URL, text, file, PDF) |
| `/mindlore-health` | v0.1 | 16-point structural health check |
| `/mindlore-query` | v0.2 | Search and retrieve knowledge (4 modes) |
| `/mindlore-log` | v0.2 | Session logging with reflect and status |
| `/mindlore-decide` | v0.2 | Decision records with supersedes chain |
| `/mindlore-evolve` | v0.3 | Schema co-evolution and structural updates |
| `/mindlore-explore` | v0.3 | Cross-reference discovery between sources |

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
  │  reads INDEX.md + last delta   │  7-col FTS5 + porter stemmer         │  writes delta to diary/
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
- **Data is per-project** — `.mindlore/` lives in each project directory
- **No `.mindlore/`?** — hooks silently skip, zero overhead
- **FTS5 search** — SQLite full-text search with BM25 ranking, no external services
- **Content-hash dedup** — SHA256 prevents re-indexing unchanged files

## Hooks

7 Claude Code lifecycle hooks (v0.1):

| Event | Hook | What it does |
|-------|------|-------------|
| SessionStart | session-focus | Injects last delta + INDEX |
| UserPromptSubmit | search | FTS5 search, top 3 results |
| FileChanged | index | Sync changed files to FTS5 |
| FileChanged | fts5-sync | Incremental batch re-index |
| SessionEnd | session-end | Write delta to diary/ |
| PreCompact | pre-compact | FTS5 flush before compaction |
| PostCompact | post-compact | Re-inject context |

## Uninstall

Remove Mindlore from your system:

```bash
npx mindlore uninstall
```

This removes:
- Hooks from `~/.claude/settings.json`
- Skills from `~/.claude/skills/`
- Optionally: `.mindlore/` project data (asks for confirmation)

## Inspired By

- [Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — LLM Knowledge Bases concept
- [Spisak](https://github.com/nickspisak) — Practical second brain implementations
- [Letta](https://github.com/letta-ai/letta-code) — Context repository pattern validation

## License

[MIT](LICENSE)
