# Skill: Mindlore Decide

Record and list decisions in the `.mindlore/decisions/` directory.

## Script Resolution

Resolve `MINDLORE_PKG` (package root) using one of these methods, in order:
1. If CC injected "Base directory for this skill: /path/to/skills/mindlore-decide" → `MINDLORE_PKG = {base_directory}/../..`
2. Fallback: run `node -e "console.log(require('path').join(require('child_process').execSync('npm root -g',{encoding:'utf8'}).trim(),'mindlore')))"`

Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

## Scope

Determine target using `getActiveMindloreDir()` logic:
- If CWD has `.mindlore/` → write to project scope
- Otherwise → write to global `~/.mindlore/`
- List mode: shows decisions from active scope (use `--all` for both)
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

User says `/mindlore-decide record` or `/mindlore-decide list`.

## Modes

### record

Record a new decision.

**Flow:**
1. Ask user (or extract from context): What was decided? What alternatives were considered? Why this choice?
2. Generate slug from decision title (kebab-case, max 5 words)
3. Check if a previous decision on same topic exists → set `supersedes` field
4. Write to `.mindlore/decisions/{slug}.md` with frontmatter:

```yaml
---
slug: use-fts5-over-vector
type: decision
title: Use FTS5 over vector search for v0.1
tags: [search, fts5, architecture]
date: 2026-04-11
supersedes: null
status: active
description: Chose FTS5 keyword search as primary engine, vector deferred to v0.4
---
```

5. Body structure:
```markdown
# {title}

## Context
Why this decision was needed.

## Alternatives Considered
1. **Option A** — pros/cons
2. **Option B** — pros/cons

## Decision
What was chosen and why.

## Consequences
What this means going forward.
```

6. Append to `log.md`: `| {date} | decide | {slug}.md |`
7. FTS5 auto-indexes via FileChanged hook

### list

List active decisions.

**Flow:**
1. Read all `.md` files in `.mindlore/decisions/`
2. Parse frontmatter, filter `status: active`
3. Display as table: slug, title, date, tags
4. Show supersedes chain if any (A → B → C)

## Rules

- Slug must be unique in decisions/
- `supersedes` field points to the slug of the replaced decision
- When a decision is superseded, update old one: `status: superseded`
- Tags should match domain topics for FTS5 discoverability
- Keep decision body concise — context + alternatives + choice + consequences
