---
name: mindlore-evolve
description: Knowledge schema co-evolution — scan domains+sources, detect inconsistencies, suggest updates
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

# /mindlore-evolve

Knowledge schema co-evolution. Karpathy's 4th operation (ingest/query/health/**evolve**).

## Scope

Determine target using `getActiveMindloreDir()` logic:
- Default (no flag): scan project `.mindlore/`
- `--global`: scan `~/.mindlore/`
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

User says `/mindlore-evolve`, "knowledge evolve", "bilgi sistemi evrimle", "sema guncelle".

## Modes

### scan (default)

Scan all domains and sources for inconsistencies.

**Flow:**
1. Read INDEX.md to get domain and source file lists
2. Read all domain files (from `domains/`)
3. Read all source files (from `sources/`)
4. Detect issues:
   - **Orphan files:** .md files in content directories not listed in INDEX.md
   - **Missing references:** Source exists but no domain mentions it
   - **Stale domains:** Source updated more recently than referencing domain
   - **Tag inconsistencies:** Tags in frontmatter don't match content
   - **Missing cross-references:** Related sources not linked
5. Report findings as a table:

```
| # | Type | File | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 1 | orphan | sources/old.md | Not in INDEX.md | Add to INDEX or delete |
| 2 | missing-ref | sources/react-hooks.md | No domain reference | Add to domains/frontend.md |
```

6. If `--dry-run`: stop here, no change suggestions

### apply

Apply suggested changes with user approval.

**Flow:**
1. Run scan first (reuse findings)
2. For each finding, show proposed change (diff format)
3. Wait for user approval before each change
4. Apply approved changes
5. Update INDEX.md with new entries
6. Append EVOLVE entry to log.md
7. Max 2 domain updates per run (prevent scope creep)

**Rules:**
- NEVER make automatic changes — always require user approval
- Show diff preview before applying
- After changes, run `node dist/scripts/mindlore-fts5-index.js` for FTS5 sync
- Log every change to log.md with timestamp

## Output Format

```
Mindlore Evolve — Scan Results

Scope: project (.mindlore/)
Files scanned: 12 sources, 5 domains
Issues found: 3

[table of findings]

Run `/mindlore-evolve apply` to fix with approval.
```
