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

### Global Scope (v0.3.3)

Mindlore uses a single global directory:
- **Global:** `~/.mindlore/` (or `$MINDLORE_HOME` if set)
- All projects share one DB; project namespace is stored in the `project` FTS5 column
- `project` = `path.basename(cwd)` at index/search time
- `npx mindlore init` always initializes `~/.mindlore/` with git repo for auto-sync
- Search defaults to current project; use `--all` flag to search all projects

### Directory Rules

- Each directory corresponds to exactly one frontmatter `type` value
- `type: raw` → `raw/`, `type: source` → `sources/`, etc.
- Files MUST live in the directory matching their `type`
- The health check script validates this cross-reference

### Session Storage (v0.5.3)

```
raw/sessions/
├── kastell/          # Proje bazlı CC session dosyaları
├── mindlore/
├── Stok-Takip/
└── {project-slug}/   # cc-session-sync.ts tarafından yazılır
```

Session dosyaları `cc-session-sync.ts` tarafından `~/.claude/projects/*/` altından taranır,
`projectSlug()` ile temiz isme dönüştürülür (ör. `C--Users-Omrfc-Documents-kastell` → `kastell`),
ve `raw/sessions/{slug}/{date}-{shortId}.md` olarak yazılır.
Frontmatter: `type: raw, project: {slug}, category: cc-session`

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
| `raw` | slug, type, source_url | tags, description |
| `source` | slug, type, title, tags, quality, source_url, ingested | date_captured, description, raw_slug |
| `domain` | slug, type, title, tags | description, status |
| `analysis` | slug, type, title, tags, confidence, sources_used | description |
| `insight` | slug, type, title, tags | sources_used, description |
| `connection` | slug, type, title, tags | sources_used, description |
| `learning` | slug, type, title, tags | description |
| `decision` | slug, type, title, tags | supersedes, status, description |
| `diary` | slug, type, date | — (hook adds automatically) |

### Field Value Rules

- `quality`: `high` | `medium` | `low`
- `confidence`: `high` | `medium` | `low` (how certain is this analysis)
- `ingested`: `true` | `false` (has this source been processed into domains)
- `sources_used`: list of slugs referenced in the analysis
- `supersedes`: slug of the decision this one replaces
- `date`: ISO 8601 date (YYYY-MM-DD)
- `description`: one-line summary (15-30 words). Used in FTS5 search and inject output. Optional but strongly recommended for search quality
- `raw_slug`: slug of the raw/ file this source was processed from (source→raw traceability)
- `status`: `stub` | `active` | `archived` (domain maturity indicator)

## 4. Ten Operations

### 4.1 Ingest (skill: /mindlore-ingest)

Add new knowledge. Flow: capture → raw/ → process → sources/ → update domains/ → FTS5.

- URL mode: markitdown CLI (if available) or WebFetch → raw/ → Sonnet summarizes → sources/
- Text mode: user paste → raw/ → summarize → sources/
- PDF mode: CC Read tool (max 20 pages/request) → raw/ → summarize → sources/
- **markitdown is NOT used for PDF** — quality is poor. Use CC Read tool or Marker/Chandra (v0.3+)

### 4.2 Query (skill: /mindlore-query) — IMPLEMENTED (v0.2)

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

### 4.4 Log (skill: /mindlore-log) — IMPLEMENTED (v0.2)

Session logging with four modes:
- `log`: Write session/task record to diary/
- `reflect`: Scan old deltas, extract patterns, move to learnings/
- `status`: Recent N sessions summary, trends, open items
- `save`: Structured delta + log.md append + wiki update

### 4.5 Decide (skill: /mindlore-decide) — IMPLEMENTED (v0.2)

Record decisions with context, options considered, rationale, and outcome.
Supports `supersedes` chain for decision evolution.

### 4.6 Evolve (skill: /mindlore-evolve) — IMPLEMENTED (v0.3)

Schema co-evolution. Scan domains + sources, suggest structural updates.
Run monthly or after major changes.

### 4.7 Explore (skill: /mindlore-explore) — IMPLEMENTED (v0.3)

Discover unexpected connections between sources. Cross-reference analysis.

### 4.8 Diary (skill: /mindlore-diary) — IMPLEMENTED (v0.5.3)

Session analysis — decisions, discoveries, frictions, learnings.

### 4.9 Reflect (skill: /mindlore-reflect) — IMPLEMENTED (v0.5.3)

Pattern extraction from episodes, CLAUDE.md update proposals.

### 4.10 Maintain (skill: /mindlore-maintain) — IMPLEMENTED (v0.5.3)

Decay/archive, episode consolidation, contradiction detection.

## 5. Search Behavior

### FTS5 Search (hooks + scripts)

- Database: `.mindlore/mindlore.db`
- Table: `mindlore_fts` (columns: path, content)
- Dedup: `file_hashes` table with SHA256 content-hash
- Tokenizer: `unicode61`
- Max results: 3 per query (BM25 ranking)
- Hook injects: file path + first 2 headings

### FTS5 Columns (11-col schema, v0.5.9)

| Column | Indexed | Source |
|--------|---------|--------|
| `path` | UNINDEXED | File system path |
| `slug` | Yes | Frontmatter slug |
| `description` | Yes | Frontmatter description |
| `type` | UNINDEXED | Frontmatter type |
| `category` | Yes | Parent directory name |
| `title` | Yes | Frontmatter title or first heading |
| `content` | Yes | Markdown body (sans frontmatter) |
| `tags` | Yes | Frontmatter tags (comma-separated) |
| `quality` | UNINDEXED | Frontmatter quality (high/medium/low) |
| `date_captured` | UNINDEXED | Frontmatter date_captured or date |
| `project` | UNINDEXED | path.basename(cwd) at index time |

### Search Flow (UserPromptSubmit hook)

1. Extract keywords from user prompt
2. Query FTS5 with BM25 ranking
3. Return max 3 results as stdout additionalContext
4. Agent reads full file only if needed (progressive disclosure)

## 6. Wiki vs Diary (Writeback Target Rules)

Knowledge goes to one of two layers. The agent MUST pick the correct one.

### Wiki Layer (permanent knowledge)

Directories: `sources/`, `domains/`, `analyses/`, `insights/`, `connections/`, `learnings/`

- Persists across sessions — reference value
- Indexed by FTS5, discoverable via search hook
- Updated by ingest, query writeback, reflect, evolve
- Content should be factual, sourced, and reusable

### Diary Layer (session-scoped logs)

Directories: `diary/`, `decisions/`

- Session-specific: deltas, logs, decision snapshots
- diary/ entries get `archived: true` after reflect processes them
- decisions/ are permanent but session-originated (context + rationale)
- Patterns extracted from diary → moved to `learnings/` (wiki layer)

### Selection Rule

| Content Type | Target | Example |
|-------------|--------|---------|
| Ingested source summary | `sources/` | URL or text summary |
| Topic wiki page | `domains/` | Consolidated knowledge on a subject |
| Multi-source synthesis | `analyses/` | Comparison table, architecture decision |
| Short Q&A answer | `insights/` | Query writeback (<200 lines) |
| Cross-reference finding | `connections/` | Link between 2+ unrelated sources |
| Persistent rule/lesson | `learnings/` | YAPMA/BEST PRACTICE from reflect |
| Session log/delta | `diary/` | What happened this session |
| Decision record | `decisions/` | Why X was chosen over Y |
| Raw capture | `raw/` | Immutable original (URL dump, paste) |

### Anti-patterns

- Do NOT write session-specific notes to `insights/` — use `diary/`
- Do NOT write permanent rules to `diary/` — use `learnings/`
- Do NOT write decision rationale to `analyses/` — use `decisions/`

## 7. Compounding

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

## 8. Learnings

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

## 9. Naming Conventions

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

## 10. Database Tables

### mindlore_fts (FTS5 virtual table)

11 kolon: path (UNINDEXED), slug, description, type (UNINDEXED), category, title, content, tags, quality (UNINDEXED), date_captured (UNINDEXED), project (UNINDEXED)

Tokenizer: `porter unicode61`

### file_hashes

Dedup tablosu — content-hash ile aynı dosyanın tekrar indexlenmesini engeller.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| path | TEXT PK | Dosya tam yolu |
| content_hash | TEXT | SHA256 hash |
| last_indexed | TEXT | Son index zamanı |
| created_at | TEXT | İlk index zamanı |
| updated_at | TEXT | Son güncelleme zamanı |
| source_type | TEXT | Kaynak tipi (cc-session, cc-subagent, vb.) |
| project_scope | TEXT | Proje adı |
| recall_count | INTEGER | Kaç kez recall edildi |
| last_recalled_at | TEXT | Son recall zamanı |
| archived_at | TEXT | Arşivlenme zamanı (null = aktif) |
| importance | REAL | Kalite→önem dönüşümü (0.0–1.0) |

### episodes

Session ve bilgi olayları — decision, discovery, friction, learning, reflection.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | TEXT PK | `ep-{kind}-{timestamp}-{random}` |
| kind | TEXT | decision, discovery, friction, learning, reflection, correction |
| scope | TEXT | session, cross-session, global |
| project | TEXT | Proje adı |
| summary | TEXT | Tek satır özet |
| body | TEXT | Detaylı içerik |
| tags | TEXT | Virgülle ayrılmış etiketler |
| entities | TEXT | İlgili entity'ler |
| parent_id | TEXT | Üst episode referansı |
| status | TEXT | active, archived |
| supersedes | TEXT | Geçersiz kıldığı episode ID |
| source | TEXT | Kaynak (session ID, hook adı) |
| created_at | TEXT | Oluşturulma zamanı |
| consolidation_status | TEXT | raw, consolidated |
| consolidated_into | TEXT | Konsolide edildiği episode ID |
| decay_score | REAL | 0.0–1.0 (1.0 = taze) |
| last_decay_calc | TEXT | Son decay hesaplama zamanı |

### skill_memory

Skill'lerin kalıcı belleği — fork'lar arası veri paylaşımı.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| key | TEXT PK | Skill + anahtar adı |
| value | TEXT | JSON veya düz metin |
| updated_at | TEXT | Son güncelleme |

## 11. Agents

3 agent tanımlı (`agents/` dizini). Model routing `model-router` hook'u tarafından yapılır.

| Agent | Model | Görev |
|-------|-------|-------|
| mindlore-assistant | sonnet | Genel KB asistanı — query, ingest yönlendirme |
| mindlore-researcher | sonnet | Araştırma — web fetch, kaynak analizi |
| mindlore-librarian | haiku | Organizasyon — tag, kategori, duplicate tespiti |
