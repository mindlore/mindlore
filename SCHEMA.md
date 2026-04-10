# Mindlore Schema

This file is the single source of truth for how the `.mindlore/` knowledge base works.
It is written for LLM agents — not humans. Every rule here must be followed exactly.

## 1. Identity

Mindlore is an AI-native knowledge system. It stores, indexes, and evolves knowledge
across Claude Code sessions. Knowledge lives in `.mindlore/` as plain Markdown files
with YAML frontmatter. Search is powered by FTS5 (SQLite full-text search).

## 2. Directory Structure

```
.mindlore/
├── raw/            # Immutable source captures (URL dumps, pasted text)
├── sources/        # Processed source summaries (one per ingested source)
├── domains/        # Topic wiki pages (entities + concepts)
├── analyses/       # Large syntheses (200+ lines, 3+ sources)
├── insights/       # Short Q&A writebacks (<200 lines, 1-2 sources)
├── connections/    # Cross-cutting links between 2+ sources
├── learnings/      # Persistent rules extracted from reflect (topic-based)
├── diary/          # Session logs, delta files (delta-YYYY-MM-DD-HHmm.md)
├── decisions/      # Decision records with context and rationale
├── INDEX.md        # Minimal navigation map (~15-20 lines, fixed size)
├── SCHEMA.md       # This file (copied from repo template)
├── log.md          # Operation log (append-only)
└── mindlore.db     # FTS5 search database (SQLite)
```

### Directory Rules

- Each directory corresponds to exactly one frontmatter `type` value
- `type: raw` → `raw/`, `type: source` → `sources/`, etc.
- Files MUST live in the directory matching their `type`
- The health check script validates this cross-reference

## 3. Frontmatter

Every `.md` file in `.mindlore/` MUST have YAML frontmatter. Format:

```yaml
---
slug: kebab-case-unique-identifier
type: raw|source|domain|analysis|insight|connection|learning|decision|diary
title: Human-readable title
tags: [tag1, tag2]
---
```

### Required Fields (all types)

| Field | Format | Rule |
|-------|--------|------|
| `slug` | kebab-case | Unique within directory. Used as filename: `{slug}.md` |
| `type` | enum | Must match the parent directory (see Section 2) |

### Type-Specific Fields

| Type | Required Fields | Optional |
|------|----------------|----------|
| `raw` | slug, type, source_url | tags |
| `source` | slug, type, title, tags, quality, source_url, ingested | date_captured |
| `domain` | slug, type, title, tags | — |
| `analysis` | slug, type, title, tags, confidence, sources_used | — |
| `insight` | slug, type, title, tags | sources_used |
| `connection` | slug, type, title, tags | sources_used |
| `learning` | slug, type, title, tags | — |
| `decision` | slug, type, title, tags | supersedes, status |
| `diary` | slug, type, date | — (hook adds automatically) |

### Field Value Rules

- `quality`: `high` | `medium` | `low`
- `confidence`: `high` | `medium` | `low` (how certain is this analysis)
- `ingested`: `true` | `false` (has this source been processed into domains)
- `sources_used`: list of slugs referenced in the analysis
- `supersedes`: slug of the decision this one replaces
- `date`: ISO 8601 date (YYYY-MM-DD)

## 4. Seven Operations

### 4.1 Ingest (skill: /mindlore-ingest)

Add new knowledge. Flow: capture → raw/ → process → sources/ → update domains/ → FTS5.

- URL mode: markitdown CLI (if available) or WebFetch → raw/ → Sonnet summarizes → sources/
- Text mode: user paste → raw/ → summarize → sources/
- PDF mode: CC Read tool (max 20 pages/request) → raw/ → summarize → sources/
- **markitdown is NOT used for PDF** — quality is poor. Use CC Read tool or Marker/Chandra (v0.3+)

### 4.2 Query (skill: /mindlore-query, v0.2)

Search and retrieve knowledge. Four modes:
- `search`: FTS5 keyword search, return top 3 matches with snippets
- `ask`: Natural language question → FTS5 → read relevant files → synthesize answer
- `stats`: Knowledge base statistics (counts by type, recent activity)
- `brief`: Quick context on a topic (read domain page if exists)

### 4.3 Health (skill: /mindlore-health)

Run 16-point structural check:
- 9 directory existence checks
- SCHEMA.md parse validation
- INDEX.md format check (~15-20 lines)
- mindlore.db FTS5 integrity
- Orphan file detection (files not in FTS5)
- Frontmatter validation (type-directory cross-reference)

### 4.4 Log (skill: /mindlore-log, v0.2)

Session logging with four modes:
- `log`: Write session/task record to diary/
- `reflect`: Scan old deltas, extract patterns, move to learnings/
- `status`: Recent N sessions summary, trends, open items
- `save`: Structured delta + log.md append + wiki update

### 4.5 Decide (skill: /mindlore-decide, v0.2)

Record decisions with context, options considered, rationale, and outcome.
Supports `supersedes` chain for decision evolution.

### 4.6 Evolve (skill: /mindlore-evolve, v0.3)

Schema co-evolution. Scan domains + sources, suggest structural updates.
Run monthly or after major changes.

### 4.7 Explore (skill: /mindlore-explore, v0.3)

Discover unexpected connections between sources. Cross-reference analysis.

## 5. Search Behavior

### FTS5 Search (hooks + scripts)

- Database: `.mindlore/mindlore.db`
- Table: `mindlore_fts` (columns: path, content)
- Dedup: `file_hashes` table with SHA256 content-hash
- Tokenizer: `unicode61`
- Max results: 3 per query (BM25 ranking)
- Hook injects: file path + first 2 headings

### Search Flow (UserPromptSubmit hook)

1. Extract keywords from user prompt
2. Query FTS5 with BM25 ranking
3. Return max 3 results as stderr additionalContext
4. Agent reads full file only if needed (progressive disclosure)

## 6. Compounding

Knowledge compounds when outputs become inputs:

```
Query answer → writeback to insights/ → FTS5 indexes → next query finds it
Reflect → patterns to learnings/ → session-focus injects → agent applies
```

### Writeback Triggers

Offer to save when:
- Comparison table generated (X vs Y)
- Architectural decision or evaluation made
- 3+ sources synthesized
- User says "save this" or "remember this"

### Writeback Rules

- Short answer (<200 lines) → insights/
- Large synthesis (200+ lines, 3+ sources) → analyses/
- Cross-cutting link → connections/

## 7. Learnings

Persistent rules extracted from reflect operations.
Organized by topic: `git.md`, `testing.md`, `security.md`, etc.

### Format

```markdown
---
slug: testing
type: learning
title: Testing Learnings
tags: [testing, jest, mock]
---

# Testing Learnings

- YAPMA: Error handling testinde mock'u dolayli tetikleme
- BEST PRACTICE: Side-effect'li moduller eklerken TUM test'lerde mock ekle
```

### Rules

- One file per topic (not per lesson)
- Append new learnings to existing topic file
- Use `YAPMA:` / `BEST PRACTICE:` / `KRITIK:` prefixes
- Reflect skill proposes, user approves before writing

## 8. Naming Conventions

### Files

- Filename = `{slug}.md` (kebab-case)
- Diary: `delta-YYYY-MM-DD-HHmm.md`
- No spaces, no uppercase in filenames

### Slugs

- kebab-case only: `my-analysis-topic`
- Unique within directory
- Descriptive but concise (3-5 words max)

### INDEX.md

- Fixed size: ~15-20 lines
- Domain list (entities/concepts headings)
- Stats line: "N source, N analysis, N total"
- Last 5 added (initially empty)
- NO full file listing — discovery via FTS5
