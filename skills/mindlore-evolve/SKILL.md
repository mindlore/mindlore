---
name: mindlore-evolve
description: Knowledge schema co-evolution — scan domains+sources, detect inconsistencies, suggest updates
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent]
---

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-evolve".
Compute: `MINDLORE_PKG = {base_directory}/../..`
Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

# /mindlore-evolve

Knowledge schema co-evolution. Karpathy's 4th operation (ingest/query/health/**evolve**).

## Scope

Default: `--scope all` (project + global birlikte taranır).
Options: `--scope project` | `--scope global` | `--scope all`

1. Determine scope from argument (default: all)
2. If `all`: scan both project `.mindlore/` and global `~/.mindlore/`
3. If `project`: scan only project-scoped content (current CWD's `.mindlore/`)
4. If `global`: scan only global `~/.mindlore/` content
- Never hardcode `.mindlore/` path — always resolve dynamically via `getActiveMindloreDir()`

## Trigger

User says `/mindlore-evolve`, "knowledge evolve", "bilgi sistemi evrimle", "sema guncelle".

## Modes

### scan (default)

Scan all domains and sources for inconsistencies.

**Agent Delegation:** Tarama işini subagent'a delege et (context koruma).

**Flow:**
1. Spawn an Agent for scanning:
   ```
   Agent({
     description: "mindlore evolve: scan",
     subagent_type: "Explore",
     prompt: "[mindlore:evolve] Scan .mindlore/ for inconsistencies. <aşağıdaki talimatları buraya koy>"
   })
   ```

   Agent talimatları:
   a. Read INDEX.md to get domain and source file lists
   b. Read all domain files (from `domains/`)
   c. Read all source files (from `sources/`)
   d. Detect issues (see list below)
   e. Return findings as structured table

2. After agent returns — review findings
3. Show findings table to user
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
- After changes, run `node "$MINDLORE_PKG/dist/scripts/mindlore-fts5-index.js"` for FTS5 sync
- Log every change to log.md with timestamp
- The `[mindlore:evolve]` marker in the Agent prompt is required — it triggers the model-router hook to use the cost-optimized model (sonnet by default)

## Output Format

```
Mindlore Evolve — Scan Results

Scope: project (.mindlore/)
Files scanned: 12 sources, 5 domains
Issues found: 3

[table of findings]

Run `/mindlore-evolve apply` to fix with approval.
```
