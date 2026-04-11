---
name: mindlore-explore
description: Discover unexpected connections between sources — undirected knowledge exploration
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

# /mindlore-explore

Discover unexpected connections between knowledge sources. Undirected exploration — unlike query (directed search).

## Scope

Determine target using `getActiveMindloreDir()` logic:
- Default (no flag): explore project `.mindlore/`
- `--global`: explore `~/.mindlore/` + project cross-reference (most valuable mode)
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

User says `/mindlore-explore`, "knowledge explore", "baglanti kesfet", "cross-reference bul".

## Flow

1. Read all source and domain files from active scope
2. Cross-match by tag + content:
   - Files sharing tags but not referencing each other
   - Sources covering similar topics from different angles
   - Sources that could bridge between domains
3. Rank connections by strength:
   - **high**: 3+ shared tags + content overlap
   - **medium**: 2 shared tags or significant content similarity
   - **low**: 1 shared tag + weak content match
4. Show findings to user
5. On approval, write to `connections/` directory

## Connection File Format

Written to `connections/` with frontmatter:

```markdown
---
type: connection
slug: connection-source-a-source-b
date_created: 2026-04-12
sources: [source-a.md, source-b.md]
domains: [domain-x.md]
strength: high
tags: [shared-tag-1, shared-tag-2]
---

## Connection

[Why these sources are related — LLM explanation]

## Action Suggestion

[What could be done — domain update, new analysis, etc.]
```

## Rules

- Check for duplicate connections before writing (same source pair)
- Show findings before writing — user approval required
- Update INDEX.md with new connections entry
- Append EXPLORE entry to log.md
- Strength is LLM-assessed based on tag overlap + content similarity

## Output Format

```
Mindlore Explore — Discovered Connections

Scope: project (.mindlore/)
Sources scanned: 12
Connections found: 3 (2 new, 1 existing)

| # | Sources | Strength | Why |
|---|---------|----------|-----|
| 1 | react-hooks.md + agent-orchestration.md | medium | Both discuss state management patterns |
| 2 | karpathy-kb.md + search-retrieval.md | high | FTS5 + knowledge architecture overlap |

Write connections? (y/n)
```
