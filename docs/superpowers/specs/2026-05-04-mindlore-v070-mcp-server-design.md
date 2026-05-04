# Mindlore v0.7.0 — MCP Server Design Spec

## Summary

Mindlore'u MCP protocol üzerinden Claude Code dışındaki host'lara (Cursor, Codex, Cline, Windsurf, Claude Desktop) açan cross-host memory layer. Stdio transport, 6 tool, mevcut script altyapısına 1:1 mapping.

## v0.7 Serisi Bölünmesi

| Versiyon | Scope |
|----------|-------|
| **v0.7.0** | MCP Server (stdio, 6 tool) + `errMsg` helper + redundant test fix |
| **v0.7.1** | Knowledge Graph (#8) + Memory Relate + Source-Type Extraction |
| **v0.7.2** | Dream Cycle (periyodik maintain) + teknik borç (sqlite-vec, Perf O(H*N), SearchCache SRP, cache review) + Multi-Strategy Retrieval+RRF |

## Kararlar

| # | Karar | Seçim | Gerekçe |
|---|-------|-------|---------|
| K1 | Transport | Stdio-only | Context-mode kanıtlanmış model, 14 platform. HTTP gerekirse v0.7.2 |
| K2 | Tool sayısı | 6 tool birden | Script'ler var, handler thin wrapper. Efor transport'ta, tool eklemek ucuz |
| K3 | Hook ilişkisi | Hybrid (yan yana) | Hook'lar CC event-driven güç, MCP on-demand cross-platform. Birbirini tamamlar |
| K4 | errMsg + test fix | v0.7.0 içinde | İlk commit olarak, ayrı versiyon gereksiz |
| K5 | Test stratejisi | Unit + integration | Tool handler unit test + stdio round-trip integration |
| K6 | SQLite concurrency | WAL mode + busy_timeout(5000ms) | Write frekansı düşük, WAL yeterli |
| K7 | Namespace | MINDLORE_HOME env var | Fallback: cwd/.mindlore/ → ~/.mindlore/. Explicit, host config'inde proje başına set |
| K8 | Response boyutu | Hard limit (default 5, max 20, snippet 500 char) | Öngörülebilir, her host'ta çalışır. Adaptive sizing gerekirse v0.7.1 |
| K9 | Scope koruması | Explicit IN/OUT listesi | Scope creep geçmişi var, 1 paragraf yatırım |
| K10 | Entry point | `npx mindlore mcp` | Subcommand, mevcut `npx mindlore` (init) bozulmaz |
| K11 | Init on boot | Auto-init | init.ts idempotent, .mindlore/ yoksa yaratır |
| K12 | Process lifecycle | Parent death detection | stdin EOF + parent PID check, zombie prevention |
| K13 | Error model | MCP SDK standard | Tool-level: isError + mesaj, protocol-level: MCP error code |
| K14 | SDK version | Pin (context-mode referansı) | Latest stable, package.json'da exact version |
| K15 | Tool naming | snake_case underscore | `mindlore_search`, MCP ekosistem standardı |
| K16 | Daemon | v0.7.2'de silinir (Dream Cycle ile birlikte) | Arada otomatik bakım gap'i olmasın, MCP ile yan yana çalışır |
| K17 | Telemetry | withTelemetry wrapper | MCP tool handler'ları da telemetry.jsonl'a yazar |
| K18 | Plugin manifest | plugin.json güncellenir | MCP server entry eklenir |
| K19 | DB migrations | Yok | v0.7.0'da schema değişmiyor, KG v0.7.1'de |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   MCP Hosts                      │
│  Claude Code │ Cursor │ Codex │ Cline │ Windsurf │
└──────┬───────┴───┬────┴───┬───┴───┬───┴────┬─────┘
       │           │        │       │        │
       └───────────┴────┬───┴───────┴────────┘
                        │ stdio (JSON-RPC)
                        ▼
              ┌─────────────────┐
              │  MCP Server     │
              │  (Node.js)      │
              │                 │
              │  ┌───────────┐  │
              │  │ Tool      │  │
              │  │ Registry  │  │
              │  └─────┬─────┘  │
              │        │        │
              │  ┌─────▼─────┐  │
              │  │ Script    │  │
              │  │ Adapters  │  │
              │  └─────┬─────┘  │
              │        │        │
              │  ┌─────▼─────┐  │
              │  │ SQLite DB │  │
              │  │ (WAL)     │  │
              │  └───────────┘  │
              └─────────────────┘

CC Hook'ları aynı DB'ye bağımsız erişir (hybrid model)
```

### Namespace Resolution

```
1. MINDLORE_HOME env var set → kullan
2. cwd/.mindlore/ var → kullan
3. ~/.mindlore/ fallback
```

### Process Lifecycle

```
Server boot:
  1. MINDLORE_HOME / cwd / home resolve
  2. .mindlore/ yoksa → auto-init (init.ts)
  3. DB aç (WAL mode, busy_timeout: 5000)
  4. Migrations check (v0.7.0'da yok)
  5. Tool'ları register et
  6. stdin/stdout transport başlat
  7. Parent death detection aktif (stdin EOF + PPID check)

Shutdown:
  - stdin EOF → graceful close (DB flush, telemetry write)
  - SIGTERM/SIGINT → graceful close
  - Parent PID gone → self-terminate
```

## Tool Specifications

### mindlore_search

FTS5 + hybrid arama. Mevcut `search-engine.ts`'e mapping.

```typescript
// Input
{
  query: string,          // Arama sorgusu (zorunlu)
  limit?: number,         // Default: 5, max: 20
  scope?: string,         // "sources" | "episodes" | "decisions" | "all" (default: "all")
  contentType?: string    // "code" | "prose" | undefined
}

// Output
{
  results: Array<{
    title: string,
    slug: string,
    snippet: string,      // Heading-aware smart snippet: match'in bulunduğu chunk'tan, max 500 char
    heading?: string,     // Snippet'in geldiği heading (chunks tablosundan)
    score: number,
    path: string
  }>,
  total: number,
  truncated: boolean
}
```

### mindlore_ingest

Kaynak ekleme. Mevcut `fetch-raw.ts` + source pipeline.

```typescript
// Input
{
  type: "text" | "file",           // Kaynak tipi (zorunlu). URL deferred to vNext (async gerekli)
  content: string,                 // Metin veya dosya yolu (zorunlu)
  title?: string,                  // Başlık (opsiyonel)
  tags?: string[]                  // Etiketler
}

// Output
{
  slug: string,
  path: string,
  wordCount: number,
  indexed: boolean
}
```

**Güvenlik:** `type: "file"` durumunda okuma her path'ten serbest, yazma `.mindlore/` içine kısıtlı (`validatePath` ile). URL fetch mevcut `fetch-raw.ts` security filter'larını kullanır (SSRF + traversal koruması).

### mindlore_recall

Karar, episode, learning çekme. Mevcut `session-payload.ts`'e mapping.

```typescript
// Input
{
  type: "decisions" | "episodes" | "learnings" | "all",  // Zorunlu
  limit?: number,    // Default: 10, max: 50
  since?: string     // ISO date filter, UTC (opsiyonel). Frontmatter `date` alanına karşı filtreler.
}

// Output
{
  items: Array<{
    type: string,
    title: string,
    content: string,    // Max 500 char snippet
    date: string,
    tags?: string[]
  }>,
  total: number
}
```

### mindlore_brief

Proje brifing — compounding pipeline.

```typescript
// Input
{
  scope?: string    // "full" | "recent" (default: "recent")
}

// Output
{
  projectName: string,
  summary: string,          // Max 2000 char
  recentDecisions: number,
  recentEpisodes: number,
  activeFrictions: number,
  topSources: string[]
}
```

### mindlore_decide

Karar kaydet veya listele.

```typescript
// Input (kaydet)
{
  action: "save",
  title: string,
  rationale: string,
  alternatives?: string[],
  supersedes?: string       // Önceki karar slug'ı
}

// Input (listele)
{
  action: "list",
  limit?: number,           // Default: 10
  since?: string            // ISO date filter
}

// Output (kaydet)
{
  slug: string,
  path: string
}

// Output (listele)
{
  decisions: Array<{
    slug: string,
    title: string,
    date: string,
    supersededBy?: string
  }>,
  total: number
}
```

### mindlore_stats

Health check + DB istatistikleri.

```typescript
// Input
{}  // No params. detail deferred to vNext (extended fields TBD)

// Output
{
  version: string,
  sources: number,
  episodes: number,
  decisions: number,
  learnings: number,
  dbSize: string,           // "2.4 MB"
  lastIndexed: string,      // ISO date
  health: "ok" | "warning" | "error",
  warnings?: string[]
}
```

## Scope — IN/OUT

### IN (v0.7.0)

- MCP Server (stdio transport, `@modelcontextprotocol/sdk`)
- 6 tool (search, ingest, recall, brief, decide, stats)
- `npx mindlore mcp` entry point
- `errMsg` utility extraction (10+ dosya)
- `manifest-v2.test.ts` redundant test fix
- Daemon kodu kalır (v0.7.2'de Dream Cycle ile birlikte silinecek — bakım gap'i önleme)
- Plugin manifest (`plugin.json`) MCP server entry
- Telemetry: withTelemetry wrapper MCP tool handler'larına
- Auto-init on boot
- Parent death detection
- WAL mode + busy_timeout
- MINDLORE_HOME env var support
- Host config snippet dokümantasyonu (CC, Cursor, Codex, Windsurf, Claude Desktop)
- Smart snippet: FTS5 match'in bulunduğu heading chunk'ından snippet extraction (sabit 500 char cutoff yerine)
- Unit test per tool + stdio integration test + smart snippet unit test (multi-chunk match, no-match fallback, chunk truncation)

### OUT (v0.7.0'a girmez)

- Knowledge Graph / relations tablosu → v0.7.1
- Entity extraction → v0.7.1
- Memory Relate (auto cross-ref) → v0.7.1
- Source-Type Aware Extraction → v0.7.1
- Dream Cycle (periyodik maintain) → v0.7.2
- Multi-Strategy Retrieval + RRF → v0.7.2
- sqlite-vec optimization → v0.7.2 (MCP persistent process'te doğal çözülür)
- Perf O(H*N) filter → v0.7.2
- SearchCache SRP → v0.7.2
- Prompt-level cache review → v0.7.2
- HTTP/SSE transport → v0.7.2+
- `mindlore_get` (tam içerik + section-level retrieval: `slug` + opsiyonel `section` param) → v0.7.1
- Setup wizard (`npx mindlore setup <host>`) → v0.7.1+
- Adaptive response sizing (trackResponse) → v0.7.1+
- Multi-runtime SQLite backend → v1.0
- Team Memory (namespace sharing) → v1.0
- Obsidian sync tool → mevcut script kalır, MCP tool değil
- Decay, consolidation, triage tool'ları → v0.7.2 Dream Cycle scope'unda
- Quality populate, backup, perf → mevcut script'ler kalır, MCP tool değil

## File Structure (yeni/değişen)

```
scripts/
  mcp-server.ts              # MCP server entry point (YENİ)
  lib/
    mcp-tools.ts             # Tool handler registry (YENİ)
    err-msg.ts               # errMsg utility extraction (YENİ)
    tool-adapters/
      search-adapter.ts      # search-engine.ts → MCP tool adapter (YENİ)
      ingest-adapter.ts      # fetch-raw.ts → MCP tool adapter (YENİ)
      recall-adapter.ts      # session-payload.ts → MCP tool adapter (YENİ)
      brief-adapter.ts       # compounding pipeline → MCP tool adapter (YENİ)
      decide-adapter.ts      # decision flow → MCP tool adapter (YENİ)
      stats-adapter.ts       # health-check → MCP tool adapter (YENİ)

tests/
  mcp-server.test.ts         # Stdio integration test (YENİ)
  mcp-tools.test.ts          # Tool handler unit tests (YENİ)
  err-msg.test.ts            # errMsg utility tests (YENİ)

package.json                 # bin.mindlore mcp subcommand dispatch ekle, deps: @modelcontextprotocol/sdk
plugin.json                  # MCP server entry ekle
```

## Dependencies (yeni)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",  // context-mode'da kanıtlanmış (latest: 1.29.0)
    "better-sqlite3": "...",
    "zod": "..."
  }
}
```

## Known Limitations (v0.7.0)

- **Native rebuild:** `better-sqlite3` Node version uyumsuzluğu olabilir. v1.0 #17 (Multi-Runtime SQLite) ile çözülecek.
- **Concurrent hosts:** WAL + busy_timeout ile çalışır ama ağır write contention test edilmedi. Gerçek kullanımda ölçülecek.
- **Embedding yok:** FTS5 keyword search only. Semantic search v0.7.1 KG scope'unda değerlendirilecek.
- **Daemon:** v0.7.0'da daemon silinmeyecek, MCP server ile yan yana çalışacak. v0.7.2'de Dream Cycle daemon'un yerini alacak.
- **Windows PPID:** `process.ppid` Windows'ta farklı davranır. stdin EOF primary detection, PPID check secondary — Windows'ta PPID check devre dışı bırakılır (stdin EOF yeterli).
- **MINDLORE_HOME vs CC hooks:** MCP server MINDLORE_HOME kullanır, CC hook'lar cwd-based çalışır. Farklı set edilirse divergence riski var. v0.7.0'da hook'lar değişmez — kullanıcı aynı path'i set etmekle sorumlu. v0.7.1'de hook'lar da MINDLORE_HOME honor edecek.
- **Telemetry concurrent write:** MCP + hook aynı anda telemetry.jsonl'a yazabilir. Append-only + satır bazlı olduğu için genelde sorunsuz, ama race condition test edilmedi.
- **Tam içerik fetch yok:** 6 tool snippet döner (max 500 char). Tam dosya okuma host'un native Read tool'uyla yapılır. `mindlore_get` (tam içerik) v0.7.1'de değerlendirilecek.

## Host Config Snippets (dokümantasyon deliverable)

### Claude Code (.claude/settings.json)
```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

### Cursor (.cursor/mcp.json)
```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

### Claude Desktop (claude_desktop_config.json)
```json
{
  "mcpServers": {
    "mindlore": {
      "command": "npx",
      "args": ["mindlore", "mcp"],
      "env": { "MINDLORE_HOME": "/path/to/.mindlore" }
    }
  }
}
```

Diğer host'lar (Codex, Cline, Windsurf) benzer format — release notes'ta detaylandırılacak.
