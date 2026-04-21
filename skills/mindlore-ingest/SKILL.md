---
name: mindlore-ingest
description: Add new knowledge sources to .mindlore/ (URL, text, file, PDF, GitHub repo)
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, WebFetch]
context: fork
agent: coder
---

## Script Resolution

Resolve `MINDLORE_PKG` (package root) using one of these methods, in order:
1. If CC injected "Base directory for this skill: /path/to/skills/mindlore-ingest" → `MINDLORE_PKG = {base_directory}/../..`
2. Fallback: run `node -e "console.log(require('path').join(require('child_process').execSync('npm root -g',{encoding:'utf8'}).trim(),'mindlore')))"`

Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

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

### URL Mode (v0.5.2 — Zero-Token Pipeline)

**Trigger:** Input starts with `http://` or `https://`

**Pre-check (before fetch):**
```bash
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" get mindlore-ingest last_ingest_urls
```
If URL already in the list, warn user: "This URL was ingested recently. Re-ingest?"

**Flow:**

1. **Fetch raw content (zero token):**
   ```bash
   node "$MINDLORE_PKG/dist/scripts/fetch-raw.js" "$URL" --out-dir "$MINDLORE_DIR/raw"
   ```
   Script output: `{ "saved": "/path/to/raw/2026-04-18-abc123.md", "chars": 14823, "method": "curl" }`

2. **Read first 3000 chars (heading-aware truncation):**
   - Read the saved raw file
   - Find the last `##` heading before char 3000
   - Truncate at that heading boundary (not mid-paragraph)
   - If no heading found before 3000, truncate at last paragraph break

3. **Write sources/ summary from truncated content:**
   - Extract: title, description (first paragraph), key topics
   - Generate frontmatter: slug, type: source, source_url, date_captured, tags, quality
   - `source_type` is auto-detected from URL pattern (see Source Summary Format)
   - Write to `$MINDLORE_DIR/sources/{slug}.md`

4. **Update INDEX.md** with new source entry

5. **Update skill_memory:**
   ```bash
   node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" set mindlore-ingest last_ingest_urls "$URL"
   ```

6. **Return to caller (this is all the ana session sees):**
   ```json
   { "source_id": "abc123", "title": "Extracted Title" }
   ```

**Token budget:** ~2-3k tokens in fork context (vs ~40-50k before). Ana session: ~50 tokens.

**Fallback:** If fetch-raw.js fails (network error, unsupported format), fall back to existing WebFetch-based flow with warning: "Zero-token fetch failed, using legacy flow (higher token cost)."

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

Required frontmatter fields include `source_type` — auto-detected:
- `github-repo` if URL contains `github.com/{owner}/{repo}` (not a file/blob URL)
- `docs` if URL contains `/docs/`, `/documentation/`, or `/api/`
- `blog` if URL contains `/blog/`, `/post/`, or `/article/`
- `video` if URL contains `youtube.com`, `youtu.be`, or `vimeo.com`
- `url-fetch` as default fallback for all other URLs
- `text-paste` for Text Mode
- `pdf` for PDF Mode
- `file` for File Mode

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
   node "$MINDLORE_PKG/dist/scripts/lib/similarity.js" "<title or first 100 chars>"
   ```
   Eğer score > 0.7 olan sonuç varsa KULLANICIYA SOR: "Bu içerik '${slug}' ile benzer görünüyor. Yine de eklensin mi?"
   Kullanıcı onaylarsa devam et, yoksa atla.
1. **raw/ file exists** — immutable capture written with frontmatter (slug, type, source_url)
2. **sources/ summary exists** — processed summary with full frontmatter (slug, type, title, tags, quality, description)
3. **INDEX.md updated** — stats line incremented, Recent section has new entry
4. **Domain updated** — if relevant domain exists, new finding added (max 1 domain per ingest)
5. **log.md entry** — append `| {date} | ingest | {slug}.md |`
6. **FTS5 indexed** — FileChanged hook auto-triggers, but verify: `node "$MINDLORE_PKG/dist/scripts/mindlore-fts5-search.js" "{keyword}"` returns the new file

If any checkpoint fails, fix it before reporting "ingest complete". Do NOT skip steps.

Optional: run full health check for structural integrity:
```bash
node "$MINDLORE_PKG/dist/scripts/mindlore-health-check.js"
```
