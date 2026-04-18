# Skill: Mindlore Query

Search, ask, analyze, and retrieve knowledge from `.mindlore/`.

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-query".
Compute: `MINDLORE_PKG = {base_directory}/../..`
Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

## Scope

Determine search scope using `getActiveMindloreDir()` / `getAllDbs()` logic:
- Default (no flag): search project `.mindlore/` DB, fall back to global
- `--global`: search only `~/.mindlore/` DB
- `--all`: search both project + global DBs, project results first
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

`/mindlore-query <mode> [query]` where mode is `search`, `ask`, `stats`, or `brief`.

## Modes

### search

FTS5 keyword search + episodes recall with unified results.

**Flow:**
1. Parse user query into keywords (strip stop words)
2. Run FTS5 MATCH on `mindlore_fts` table (knowledge: "ne biliyorum")
3. Run LIKE search on `episodes` table (memory: "ne oldu, ne karar aldım")
4. Merge results: FTS5 results first, then matching episodes
5. Return top 5 knowledge results + top 3 episode results
6. Display knowledge as table with snippet preview, episodes as timeline
7. If `--tags <tag>` flag provided: `WHERE tags MATCH '<tag>'` filter (FTS5 only)
8. If `--episodes-only` flag: skip FTS5, show only episode matches

**Output format:**
```
| # | Category | Title | Description | Score |
|---|----------|-------|-------------|-------|
| 1 | sources  | React Hooks | useEffect cleanup patterns | -2.34 |
```

### ask

Compounding query pipeline — knowledge grows with each answer.

**Flow:**
1. Parse user question
2. FTS5 search → find relevant files (sources + domains + analyses + insights — previous answers INCLUDED)
3. Read top 3-5 relevant files using ctx_execute_file if context-mode available, else Read
4. Synthesize answer from found knowledge
5. Cite sources: `[kaynak: sources/x.md]` format
6. Ask user: "Bu cevabı kaydetmemi ister misin?"
7. If yes → determine target:
   - Short answer (<200 lines, 1-2 sources) → `insights/{slug}.md`
   - Large synthesis (200+ lines, 3+ sources) → `analyses/{slug}.md`
8. Write with frontmatter:

```yaml
---
slug: react-hooks-cleanup-comparison
type: insight
title: React Hooks Cleanup Comparison
tags: [react, hooks, useEffect]
confidence: high
sources_used: [react-hooks, typescript-generics]
description: Comparison of cleanup patterns in useEffect vs useLayoutEffect
---
```

9. FTS5 auto-indexes via FileChanged hook → next query finds this answer
10. Update relevant domain page (max 1) with backlink if applicable
11. Append to `log.md`: `| {date} | query-ask | {slug}.md |`

**Compounding effect:** Step 2 searches ALL of `.mindlore/` including previous `insights/` and `analyses/`. Each saved answer enriches the next query.

**Error compounding prevention:**
- `confidence` field is REQUIRED on writebacks (high/medium/low)
- `sources_used` lists exact slugs — traceability
- Health check flags conflicting analyses on same topic (different confidence)
- User approval is the quality gate — low-quality answers are not saved

### stats

Knowledge base statistics.

**Flow:**
1. Count files per directory (9 directories)
2. Count FTS5 entries and file_hashes entries
3. Find most recent ingest (latest file by modified date per directory)
4. Count tags frequency (parse all frontmatter, aggregate tags)
5. Display summary:

```
Mindlore Stats
─────────────
Total files: 47 (FTS5: 47 indexed)
 - sources:     18
 - domains:      5
 - analyses:     6
 - insights:     3
 - connections:  2
 - learnings:    4
 - diary:        8
 - decisions:    1
 - raw:          0

Top tags: security (12), hooks (8), fts5 (6), testing (5)
Last ingest: 2026-04-11 (sources/react-hooks.md)
DB size: 1.2 MB
```

### brief

Quick context on a topic — token-efficient (~50 tokens output).

**Flow:**
1. FTS5 search for topic
2. If domain page exists → read first 3 lines of body (after frontmatter)
3. If no domain → read description field from top FTS5 match
4. Return: title + description + "Read full: {path}" pointer
5. Do NOT read full file — this mode is for quick "do I need to open this?" decisions

**Output format:**
```
[Mindlore Brief: Security]
SSH hardening, firewall rules, audit checks. 5 sources, 2 analyses linked.
→ Read full: .mindlore/domains/security.md
```

## Rules

- All modes respect the SCHEMA.md writeback rules (Section 6: Wiki vs Diary)
- search and brief are read-only — no writes
- ask writes only with user approval
- stats is read-only
- Token strategy: prefer ctx_execute_file (if context-mode installed), fallback to Read
- Tags filter: `--tags security` works in search and ask modes
- Max results: search=5, ask=3-5 (for synthesis), brief=1
