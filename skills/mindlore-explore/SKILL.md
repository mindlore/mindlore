---
name: mindlore-explore
description: Discover unexpected connections between sources — undirected knowledge exploration
effort: medium
context: fork
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent]
---

# /mindlore-explore

Discover unexpected connections between knowledge sources. Undirected exploration — unlike query (directed search).

## Scope

Default: `--scope all` (project + global birlikte taranır — en değerli mod).
Options: `--scope project` | `--scope global` | `--scope all`

1. Determine scope from argument (default: all)
2. If `all`: explore both project `.mindlore/` and global `~/.mindlore/` + cross-reference
3. If `project`: explore only project-scoped content (current CWD's `.mindlore/`)
4. If `global`: explore only global `~/.mindlore/` content
- Never hardcode `.mindlore/` path — always resolve dynamically via `getActiveMindloreDir()`

## Trigger

User says `/mindlore-explore`, "knowledge explore", "baglanti kesfet", "cross-reference bul".

## Flow

**Agent Delegation:** Cross-reference analizini subagent'a delege et (context koruma).

1. Spawn an Agent for analysis:
   ```
   Agent({
     description: "mindlore explore: connections",
     subagent_type: "Explore",
     prompt: "[mindlore:explore] Analyze .mindlore/ for unexpected connections. <aşağıdaki talimatları buraya koy>"
   })
   ```

   Agent talimatları:
   a. Read all source and domain files from active scope
   b. Cross-match by tag + content (see criteria below)
   c. Rank connections by strength
   d. Return findings as structured table

2. After agent returns — review and show findings to user
3. On approval, write connection files (main session handles writes)

**Cross-match criteria:**
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
- The `[mindlore:explore]` marker in the Agent prompt is required — it triggers the model-router hook to use the cost-optimized model (sonnet by default)

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
