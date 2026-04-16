---
name: mindlore-ingest
description: Add new knowledge sources to .mindlore/ (URL, text, file, PDF, GitHub repo)
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, WebFetch]
---

# /mindlore-ingest

Add a new knowledge source to the `.mindlore/` knowledge base.

## Scope

Determine target directory using `getActiveMindloreDir()` logic:
- If CWD has `.mindlore/` → write to project scope
- Otherwise → write to global `~/.mindlore/`
- `--global` flag: force write to `~/.mindlore/` even if project scope exists
- Never hardcode `.mindlore/` path — always resolve dynamically

## Trigger

User shares a URL, text, file, or says "kaynak ekle", "source ingest", "bu linki kaydet", "knowledge ingest".

## Modes

### URL Mode

**Agent Delegation:** URL fetch + raw/sources yazımını subagent'a delege et (maliyet optimizasyonu).

1. Spawn an Agent with the following pattern:
   ```
   Agent({
     description: "mindlore ingest: <slug>",
     subagent_type: "researcher",
     prompt: "[mindlore:ingest] <aşağıdaki talimatları buraya koy>"
   })
   ```

   Agent talimatları:
   - Extract content from URL:
     - If `markitdown` is available: `markitdown <url>` (best quality, zero tokens)
     - Else: use `WebFetch` or `ctx_fetch_and_index`
     - **YouTube URL** detected (`youtube.com` or `youtu.be`):
       1. markitdown installed → `markitdown <url>` (includes transcript)
       2. Else youtube-transcript npm → `hasYoutubeTranscript()` check
       3. Else → return error, ask user to paste transcript
   - Save raw capture to `.mindlore/raw/` with frontmatter:
     ```yaml
     ---
     slug: source-name-kebab
     type: raw
     source_url: https://...
     date_captured: YYYY-MM-DD
     tags: [tag1, tag2]
     ---
     ```
   - Summarize into `.mindlore/sources/` with full frontmatter:
     ```yaml
     ---
     slug: source-name-kebab
     type: source
     title: Human Readable Title
     source_url: https://...
     source_type: github-repo|blog|docs|video|x-thread
     date_captured: YYYY-MM-DD
     tags: [tag1, tag2]
     quality: high|medium|low
     ingested: true
     ---
     ```
   - Agent must report: created file paths, slug, quality assigned

2. After agent returns — verify raw/ and sources/ files exist and have valid frontmatter
3. Update relevant domain page(s) in `.mindlore/domains/` (max 2)
4. Update `.mindlore/INDEX.md` stats line
5. Append entry to `.mindlore/log.md`
6. Run FTS5 re-index: `npm run index`

**IMPORTANT:** The `[mindlore:ingest]` marker in the Agent prompt is required — it triggers the model-router hook to use the cost-optimized model (haiku by default).

### Text Mode
1. User pastes text directly
2. Save to `.mindlore/raw/` with `source_type: text-paste`
3. Follow steps 3-7 from URL mode

### PDF Mode
1. Read PDF with CC Read tool: `Read(file_path, pages: "1-5")` (max 20 pages/request)
2. **Do NOT use markitdown for PDF** — quality is poor
3. Save extracted text to `.mindlore/raw/`
4. Follow steps 3-7 from URL mode
5. For v0.3+: Marker CLI or Chandra as optional alternatives

### File Mode
1. Read the file with `Read` tool
2. Save to `.mindlore/raw/`
3. Follow steps 3-7 from URL mode

## Source Summary Format

The sources/ file should contain:
- **1-paragraph summary** of what the source is about
- **Key takeaways** (3-7 bullet points)
- **Relevance to project** (why this matters)
- **Related** links to other sources/domains in .mindlore/

## Quality Assessment

Assign quality automatically during ingest using this heuristic:
- `high`: Official docs (anthropic, github docs, MDN), primary research, authoritative references
- `medium`: Blog posts, tutorials, conference talks, X threads with substance
- `low`: Raw notes, text pastes, quick captures, low signal-to-noise

LLM may override the heuristic based on content analysis. Always set quality — never leave it null.

## Domain Update Rules

- Read the relevant domain page first
- Add new information under the appropriate section
- Add backlink to the source in the domain's references
- Update max 2 domain pages per ingest (prevent scope creep)
- If no relevant domain exists, note it — don't create one during ingest

## INDEX.md Update

Only update the stats line: increment source count and total count.
```
N source, N analysis, N total
```

## Post-Ingest Quality Gate

After every ingest, verify all 7 checkpoints before reporting success:

0. **Duplicate check** — Ingest öncesi mevcut DB'de benzer içerik ara:
   ```bash
   node dist/scripts/lib/similarity.js "<title or first 100 chars>"
   ```
   Eğer score > 0.7 olan sonuç varsa KULLANICIYA SOR: "Bu içerik '${slug}' ile benzer görünüyor. Yine de eklensin mi?"
   Kullanıcı onaylarsa devam et, yoksa atla.
1. **raw/ file exists** — immutable capture written with frontmatter (slug, type, source_url)
2. **sources/ summary exists** — processed summary with full frontmatter (slug, type, title, tags, quality, description)
3. **INDEX.md updated** — stats line incremented, Recent section has new entry
4. **Domain updated** — if relevant domain exists, new finding added (max 1 domain per ingest)
5. **log.md entry** — append `| {date} | ingest | {slug}.md |`
6. **FTS5 indexed** — FileChanged hook auto-triggers, but verify: `node scripts/mindlore-fts5-search.cjs "{keyword}"` returns the new file

If any checkpoint fails, fix it before reporting "ingest complete". Do NOT skip steps.

Optional: run full health check for structural integrity:
```bash
node scripts/mindlore-health-check.cjs
```
