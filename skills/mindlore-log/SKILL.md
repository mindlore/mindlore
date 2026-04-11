# Skill: Mindlore Log

Session logging, pattern extraction, and wiki updates.

## Scope

Determine target using `getActiveMindloreDir()` logic:
- If CWD has `.mindlore/` → write to project scope
- Otherwise → write to global `~/.mindlore/`
- Reflect mode: scans both project + global diary/ for patterns
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

`/mindlore-log <mode>` where mode is `log`, `reflect`, `status`, or `save`.

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

### reflect

LLM-driven pattern extraction from diary deltas → persistent learnings.

**Flow (v0.3 — LLM-driven):**
1. Read last N non-archived delta files in `diary/` (no `archived: true` frontmatter)
2. Present summary: "Found N unprocessed deltas spanning DATE1 to DATE2"
3. LLM analyzes deltas for repeating patterns:
   - Recurring topics/themes across sessions
   - Repeated decisions (same choice made multiple times)
   - Common mistakes or friction points
   - Workflow patterns that worked well
4. Categorize found patterns by topic (git, testing, architecture, etc.)
5. Present findings to user with proposed learnings
6. User approves → write to `learnings/{topic}.md` (append if exists, create if not)
7. Format: `YAPMA:` / `BEST PRACTICE:` / `KRITIK:` prefixed rules
8. Update relevant domain page if pattern relates to an existing domain
9. Mark processed deltas: add `archived: true` to their frontmatter
10. Append to `log.md`: `| {date} | reflect | {N} deltas processed, {M} learnings written |`

**Rules:**
- NEVER write learnings without user approval
- Group related patterns into existing topic files (don't create one file per pattern)
- Reflect scans both project + global diary/ in `--all` mode

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
