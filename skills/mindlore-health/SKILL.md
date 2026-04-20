---
name: mindlore-health
description: Run 16-point structural health check on .mindlore/ knowledge base
effort: low
context: fork
allowed-tools: [Bash, Read]
---

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-health".
Compute: `MINDLORE_PKG = {base_directory}/../..`
Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

# /mindlore-health

Run the 16-point structural health check on the `.mindlore/` knowledge base.

## Scope

Determine target using `getActiveMindloreDir()` logic:
- Default (no flag): check project `.mindlore/`, fall back to global
- `--global`: check only `~/.mindlore/`
- `--all`: check both project + global scopes, report each separately
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

User says "health check", "mindlore health", "bilgi sistemi kontrol", "saglik kontrolu".

## Execution

1. Run the health check script:
   ```bash
   node "$MINDLORE_PKG/dist/scripts/mindlore-health-check.js"
   ```

2. Read the output and provide LLM interpretation:
   - Explain any failures or warnings
   - Suggest specific fixes for each issue
   - Prioritize: FAIL > WARN > PASS

## 16 Checks

| # | Check | What It Validates |
|---|-------|-------------------|
| 1-9 | Directory existence | All 9 directories under .mindlore/ exist |
| 10 | SCHEMA.md | File exists and is parseable |
| 11 | INDEX.md format | File exists, ~15-20 lines (not bloated) |
| 12 | mindlore.db FTS5 | Database exists, FTS5 table queryable |
| 13 | Orphan files | All .md files are indexed in FTS5 |
| 14-16 | Frontmatter | slug + type present, type matches directory |

## Common Fixes

| Issue | Fix |
|-------|-----|
| Missing directory | `npx mindlore init` (idempotent) |
| Database missing | `npx mindlore init` |
| Orphan files | `npm run index` (full re-index) |
| INDEX.md too long | Trim to ~15-20 lines, move details to domains/ |
| Type-dir mismatch | Move file to correct directory or fix frontmatter type |
| Missing frontmatter | Add YAML frontmatter with slug and type |

## Output Format

Report results clearly:
- Total score: X/16 passed
- List any FAIL or WARN items with specific fix commands
- If all pass: "Knowledge base is healthy"
