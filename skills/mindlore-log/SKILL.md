# Skill: Mindlore Log

Session logging, pattern extraction, and wiki updates.

## Scope

Determine target using `getActiveMindloreDir()` logic:
- If CWD has `.mindlore/` → write to project scope
- Otherwise → write to global `~/.mindlore/`
- Reflect mode: scans both project + global diary/ for patterns
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

`/mindlore-log <mode>` where mode is `log`, `diary`, `reflect`, `status`, or `save`.

## Modes

### log

Write a manual diary entry.

**Flow:**
1. User provides note/observation (or extract from conversation context)
2. Generate slug: `note-YYYY-MM-DD-HHmm`
3. Write to `.mindlore/diary/{slug}.md`:

```yaml
---
slug: note-2026-04-11-1530
type: diary
date: 2026-04-11
---
```

4. Body: user's note as-is
5. Append to `log.md`: `| {date} | log | {slug}.md |`

### diary

LLM-driven session analysis → enriched episodes in the episodes table.

**Trigger:** User runs `/mindlore-log diary` or Stop hook asks "Diary analizi yapayım mı?"

**Model:** `[mindlore:diary]` marker → sonnet (analysis needed)

**Flow:**
1. Open `~/.mindlore/mindlore.db`, ensure episodes table exists
2. Find the latest bare session episode for current project: `WHERE kind = 'session' AND project = ? AND source = 'hook' ORDER BY created_at DESC LIMIT 1`
3. Gather context:
   - The bare episode's body (commits, files, read stats)
   - Git log last 10 commits
   - Decision-detector captures (if any in session)
4. LLM analyzes and extracts structured episodes:
   - **Decisions** → `kind: 'decision'` — architectural/tool/format choices
   - **Discoveries** → `kind: 'discovery'` — assumption vs reality findings
   - **Frictions** → `kind: 'friction'` — tool errors, blockers, recurring issues
   - **Learnings** → `kind: 'learning'` — reusable knowledge
   - **Preferences** → `kind: 'preference'` — user behavioral preferences
   - **Events** → `kind: 'event'` — releases, incidents, milestones
5. **Deduplication rule:** Each finding belongs to exactly ONE kind. Priority: `decision > discovery > friction > learning > preference > event`. Never write the same finding to multiple kinds.
6. Present to user, get approval
7. Write approved episodes to DB:
   - `source: 'diary'`
   - `parent_id: {bare_session_episode_id}` — links enriched episodes to source session
   - `scope: 'project'` (default) or `'global'` if cross-project
8. Optionally mirror to FTS5 for text search
9. Append to `log.md`: `| {date} | diary | {N} episodes extracted from session |`

**Rules:**
- NEVER write episodes without user approval
- parent_id always points to the source session episode
- Each episode gets its own summary (max 100 chars) and body (markdown, unbounded)
- entities field: JSON array of relevant file paths (max 10)

### reflect

LLM-driven pattern extraction from episodes → persistent learnings.

**Flow (v0.4 — episodes-powered):**
1. Read active episodes: `WHERE status = 'active' AND source IN ('hook', 'diary')`
2. Optionally filter by time: `--days 7` (default 7), `--days 30`
3. Present summary: "Found N episodes spanning DATE1 to DATE2"
4. LLM analyzes episodes (not deltas) for patterns:
   - Repeated decisions (same choice 2+ times)
   - Recurring frictions (same blocker/error)
   - Discovery patterns (assumptions that keep breaking)
   - Workflow patterns that worked well
5. **Structured report output:**

```
── Reflect Raporu (son {days} gün, {N} episode) ──

Friction ({count}):
  - {summary} — {repeat_count}x tekrar

Discoveries ({count}):
  - {summary}

Decisions ({count}):
  - {summary}

Patterns:
  - "{pattern_description}" → kural adayı

Önerilen:
  [ ] {rule} ({repeat_count}x, {confidence} confidence)
```

6. User approves → write to `learnings/{topic}.md`
7. Format: `YAPMA:` / `BEST PRACTICE:` / `KRITIK:` prefixed rules
8. Update relevant domain page if pattern relates to an existing domain
9. Mark processed episodes: future reflect skips already-processed timeranges
10. Append to `log.md`: `| {date} | reflect | {N} episodes processed, {M} learnings written |`

**Fallback:** Also reads non-archived delta files if episodes table is empty (backward compat with v0.3 deltas).

**Rules:**
- NEVER write learnings without user approval
- Group related patterns into existing topic files (don't create one file per pattern)
- Reflect scans both project + global diary/ in `--all` mode
- Deduplication: same pattern found in both episodes and deltas → episodes win

### status

Show recent session summary.

**Flow:**
1. Read last 5 delta files from `diary/` (sorted by date, newest first)
2. For each delta, extract: date, commits count, changed files count
3. Display as compact table
4. Show any open items (from delta "Yarım Kalan" sections if present)
5. Show total: "N sessions, M commits, K unique files changed"

### save

Structured delta + log.md append + domain wiki update.

**Flow:**
1. Gather current session context:
   - Recent git commits (last 5)
   - Changed files
   - Decisions made (if decision-detector captured any)
2. Write structured delta to `diary/delta-YYYY-MM-DD-HHmm.md` (same format as session-end hook)
3. Append to `log.md`
4. Ask user: "Which domain pages should be updated with this session's findings?"
5. If user specifies domains → update those `.mindlore/domains/{slug}.md` pages with new findings
6. Max 2 domain updates per save (prevent sprawl)

## Rules

- Diary files are session-scoped (temporary), learnings are permanent
- reflect marks deltas as `archived: true` — they stay in diary/ but are not processed again
- Health check warns on deltas older than 30 days without `archived: true`
- learnings/ files are topic-based (one per topic), append-only
- save mode is the manual equivalent of what session-end hook does automatically
