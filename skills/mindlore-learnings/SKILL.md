---
name: mindlore-learnings
description: Show full content of a learning by slug, or list all learnings. Use when the session-focus hook truncates a learning and you need the full text.
---

# mindlore-learnings

## Commands

### show <slug>
Returns full content of `~/.mindlore/learnings/<slug>.md`.

Example:
```
/mindlore-learnings show dev-patterns-2026-04
```

If slug not found, suggests closest match.

### list
Lists all learnings with the first line of each.

```
/mindlore-learnings list
```

## Implementation

Source: `scripts/mindlore-learnings.ts`
Use: `node "$MINDLORE_PKG/dist/scripts/lib/skill-runner.js" mindlore-learnings mindlore-learnings.js <command> [args]`
