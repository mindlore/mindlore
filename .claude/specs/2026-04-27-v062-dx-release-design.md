# v0.6.2 — DX Release Design

**Tarih:** 2026-04-27  
**Scope:** 14 roadmap maddesi + 7 simplify bulgusu = ~21 iş kalemi  
**Strateji:** Tek release, 3 faz (quick wins → DX+refactor → büyük feature)  
**Ön koşul:** v0.6.1 released (npm@0.6.1, 76 suite, 558 test)

---

## Scope Özeti

### Roadmap Maddeleri (14)

| # | Madde | Faz | Efor | Bağımlılık |
|---|-------|-----|------|------------|
| #31 | Session-Focus Performans (p50=3093ms → <500ms) | 1 | Orta | — |
| #8 | Upgrade CLI routing (`npx mindlore --upgrade`) | 1 | Küçük | — |
| #4 | Flaky Test Detection (Jest retry + detectOpenHandles) | 1 | Küçük | — |
| #5 | Dependency Audit (npm audit script) | 1 | Küçük | — |
| #1 | Context Savings metric (hook'lara injected_tokens emit) | 2 | Orta | — |
| #7 | Obsidian Sync Recursive (alt klasör desteği) | 2 | Orta | — |
| #25 | URL Ingest Cache (fetch-raw'a mtime/etag) | 2 | Küçük | — |
| #26 | Health Dashboard (4 SQL view: stale/orphan/low-q/recent) | 2 | Küçük | — |
| #9 | Session Özet Injection (cc-session-sync'e mekanik summary) | 3 | Orta | — |
| #15 | Raw Inbox Triage (seviye 1+2+birikme uyarısı) | 3 | Orta | #25 |
| #17 | Compaction Snapshot (PreCompact payload + PostCompact inject) | 3 | Orta-Büyük | — |

### Simplify Bulguları (7)

| Bulgu | Faz | Efor |
|-------|-----|------|
| withTimeoutDb wire (hook'lara çağrı ekle) | 2 | Küçük |
| _writeTelemetry object param (4 positional → object) | 2 | Küçük |
| Session-focus 4-level nesting (fonksiyon extract) | 3 | Orta |
| Init config merge nesting (mergeDefaults utility) | 2 | Küçük-Orta |
| Doctor EXPECTED_HOOKS drift (plugin.json'dan derive) | 2 | Küçük |
| Perf O(H*N) filter (trivial dataset) | 2 | Trivial |
| registerAgents content compare (mtime+size guard) | 2 | Küçük |

### Scope Dışı

| Madde | Neden |
|-------|-------|
| #12 Episode Stale | v0.6.1 DB fixleri sonrası düzeldi (2026-04-27 doğrulandı) |
| #13 Non-Blocking Ingest | → v0.6.4 (inbox pattern, skill bloklama çözümü) |
| #18 Ingest llms.txt | → v0.6.4 (#13 ile birleşik) |
| #15 toplu promote | → v0.6.4 (#13 inbox pattern ile birlikte) |
| Search hook 3 DB open | → v0.6.3 Search Engine Overhaul (hook baştan yazılacak) |
| sqlite-vec per-event load | → v0.7 MCP Server geçişi |

---

## Faz 1: Quick Wins + Bugfix (~1 session)

### #31 — Session-Focus Performans

**Problem:** p50=3093ms, her session başlangıcını yavaşlatıyor.  
**Not:** better-sqlite3 senkron API — Promise.all DB sorgularında işe yaramaz.  
**Yaklaşım: Profile-then-fix (2 adım):**

**Adım A — Ölçüm:**
- Hook'un her bölümüne `Date.now()` marker koy (INDEX read, diary walk, DB open, integrity check, her DB query, version check)
- `npx mindlore perf --hook mindlore-session-focus` çıktısı ile bottleneck'i tespit et
- Sonuçları belgeleyip Adım B'ye geç

**Adım B — Ölçüme göre fix (olası optimizasyonlar):**
- Diary FS walk: `readdirSync` zaten tek çağrı ama `sort()` + `filter()` optimize edilebilir
- DB integrity check: her session'da gerekli mi? Sadece hata sonrası çalıştır (flag-based)
- Sıralı DB query'leri: tek prepared statement'a birleştir (JOIN veya UNION)
- INDEX.md: mtime check ile cache (değişmemişse re-read yapma)

**Etkilenen:** `hooks/mindlore-session-focus.cjs`  
**Test:** Mevcut session-focus test suite + perf ölçümü (before/after p50)  
**Başarı kriteri:** p50 < 500ms (ölçüm sonrası hedef revize edilebilir)

### #8 — Upgrade CLI Routing

**Problem:** `npx mindlore --upgrade` komutu yok — init.ts'de routing bağlı değil.  
**Çözüm:** `init.ts`'e `--upgrade` flag'i ekle → `mindlore-health-check.ts` upgrade logic'ini çağır.  
**Etkilenen:** `scripts/init.ts`  
**Test:** init test suite'e upgrade routing assertion ekle  
**Başarı kriteri:** `npx mindlore --upgrade` çalışıp versiyon kontrolü yapıyor

### #4 — Flaky Test Detection

**Problem:** Bazı testler sporadik fail ediyor (Windows file lock, timing).  
**Çözüm:**
- `jest.config.cjs`'e `--detectOpenHandles` + `--verbose` ekle
- Flaky testleri custom reporter ile logla (retry yok — maskleme riski)
- Open handle'ları tespit edip kök nedeni düzelt

**Etkilenen:** `jest.config.cjs`, flaky test dosyaları  
**Test:** Mevcut test suite (0 fail olmalı)  
**Başarı kriteri:** `npm test` kararlı geçiyor, flaky'ler loglanıyor

### #5 — Dependency Audit

**Problem:** Periyodik güvenlik kontrolü yok.  
**Çözüm:** `npm run audit` script ekle (`npm audit --audit-level=moderate`).  
**Etkilenen:** `package.json` scripts bölümü  
**Test:** Script çalışıp çıktı veriyor  
**Başarı kriteri:** 0 moderate+ vulnerability

---

## Faz 2: DX + Refactor (~2 session)

> **Dengeleme notu:** Trivial simplify item'ları (Perf O(H*N) filter, registerAgents content compare) Faz 1'e taşınabilir — plan yazımında kesinleştirilecek.

### #1 — Context Savings Metric

**Problem:** Hook'lar `injected_tokens` / `full_read_tokens` emit etmiyor. `perf --savings` "No savings data" diyor.  
**Metrik tanımı:**
- `inject_tokens`: Hook'un stdout'a yazdığı metnin yaklaşık token sayısı (`output.length / 4`)
- `source_tokens`: Hook'un okuduğu kaynak dosyaların toplam boyutu (`chars / 4`). Bu "agent bu dosyaları tam okusaydı" counterfactual'ı — yargısız ham veri.
- `savings_ratio`: `1 - (inject_tokens / source_tokens)` — ne kadar sıkıştırma yapıldığı

**Çözüm:**
- Her inject hook'una (session-focus, search, post-compact) iki sayaç ekle
- `_writeTelemetry`'ye `inject_tokens` ve `source_tokens` alanlarını yaz
- `mindlore-perf.ts --savings` bu verileri oku ve rapor et
- **Not:** `full_read_tokens` → `source_tokens` olarak yeniden adlandırıldı (daha net semantik)

**Etkilenen:** `hooks/mindlore-session-focus.cjs`, `hooks/mindlore-search.cjs`, `hooks/mindlore-post-compact.cjs`, `scripts/mindlore-perf.ts`  
**Test:** Telemetry perf test'e savings assertion ekle  
**Başarı kriteri:** `npx mindlore perf --savings` gerçek veri gösteriyor

### #7 — Obsidian Sync Recursive

**Problem:** `mindlore-obsidian.ts` sadece root dizini sync ediyor, alt klasörler (domains/, analyses/) atlanıyor.  
**Çözüm:** Sync fonksiyonuna recursive walk ekle — `.mindlore/` altındaki tüm `.md` dosyalarını Obsidian vault'a kopyala, dizin yapısını koru.  
**Not:** One-way sync (mindlore → obsidian). Mindlore'da silinen dosya Obsidian'da kalır — bilinçli karar, Obsidian'da ek notlar kaybolmasın.  
**Etkilenen:** `scripts/mindlore-obsidian.ts`  
**Test:** Obsidian test suite'e alt klasör assertion ekle  
**Başarı kriteri:** `domains/`, `analyses/`, `sources/` Obsidian vault'ta görünüyor

### #25 — URL Ingest Cache

**Problem:** Aynı URL tekrar ingest edildiğinde tekrar fetch yapılıyor.  
**Çözüm:**
- Filesystem mtime-based 24h TTL (fetch tamamen skip)
- Post-fetch content hash karşılaştırma (değişmemişse dosya yazma)
- `--force` flag'i ile override
- **Deferred (v0.6.3):** `If-Modified-Since` / `ETag` HTTP header check — mevcut TTL+hash yeterli, bandwidth optimizasyonu sonraki sürüme ertelendi

**Etkilenen:** `scripts/fetch-raw.ts`  
**Test:** fetch-raw test'e cache hit/miss assertion ekle  
**Başarı kriteri:** Aynı URL 2. kez ingest edildiğinde "already cached, skipping" mesajı

### #26 — Health Dashboard

**Problem:** `npm run health` 16-point yapısal kontrol yapıyor ama knowledge kalitesine dair görünürlük yok.  
**Çözüm:** 4 yeni SQL view ekle:
1. **Stale Sources:** `quality = 'low'` veya `date_captured` >90 gün
2. **Orphan Raw:** `raw/` altında olup `sources/` karşılığı olmayan dosyalar
3. **Low Quality:** FTS5'te `quality = 'low'` veya `quality IS NULL`
4. **Recently Active:** Son 7 günde eklenen/güncellenen (recall_count, last_recalled_at)

**Çıktı:** `Stale: 12 | Orphan: 23 | Low Quality: 8 | Recent: 15`  
**Not:** Ad-hoc SELECT sorguları yeterli — CREATE VIEW gerektirmez (schema migration önlenir).  
**Etkilenen:** `scripts/mindlore-health-check.ts`  
**Test:** Health check test'e dashboard assertion ekle  
**Başarı kriteri:** `npx mindlore health` dashboard bölümü gösteriyor

### Simplify Refactor (Faz 2 kısmı)

| Bulgu | Çözüm | Dosya |
|-------|-------|-------|
| withTimeoutDb wire | DB sorgularına `withTimeoutDb` wrapper ekle | hook'lar (search, session-focus) |
| _writeTelemetry object param | `{hookName, duration_ms, ok, extra}` object | `hooks/lib/mindlore-common.cjs` + tüm callerlar |
| Doctor EXPECTED_HOOKS drift | `plugin.json`'dan hook listesi derive et | `scripts/mindlore-doctor.ts` |
| Perf O(H*N) filter | Pre-group by hook name | `scripts/mindlore-perf.ts` |
| registerAgents content compare | `mtime+size` guard ekle | `scripts/init.ts` |
| Init config merge nesting | `mergeDefaults(target, source)` utility extract | `scripts/init.ts` |

---

## Faz 3: Büyük Feature (~2 session)

### #9 — Session Özet Injection (Seçenek C)

**Problem:** Yeni session'da önceki session'da ne konuşulduğu inject edilmiyor.  
**Çözüm:**
- `cc-session-sync` transcript yazarken mekanik özet çıkar (LLM'siz):
  - JSONL'den `## User` bloklarını parse et
  - İlk ve son user mesajından intent extract (ilk 100 char)
  - Commit mesajlarını topla
  - Karar keyword'leri tara (iki dilli): TR: "karar", "ertele", "plan", "seçtik", "yapma" / EN: "decision", "defer", "blocker", "chose", "skip"
- Sonucu `episodes` tablosuna `kind = 'session-summary'` olarak yaz
- `buildSessionPayload()` session-summary'leri de include etsin

**Ön adım — False positive testi:** Implementasyondan önce mevcut bir JSONL transcript'inde keyword listesini çalıştır. >20% false positive ise keyword listesi daraltılmalı (örn. "plan" tek başına değil, "karar: plan" gibi context'li match).  
**Token maliyeti:** Sıfır (tamamen regex + string parse)  
**Etkilenen:** `scripts/cc-session-sync.ts`, `scripts/lib/session-payload.ts`  
**Test:** cc-session-sync test'e summary extraction assertion, session-payload test'e summary inclusion  
**Başarı kriteri:** SessionStart'ta "Önceki session: v0.6.1 release + simplify review" gibi özet görünüyor

### #15 — Raw Inbox Triage (Seviye 1+2+Uyarı)

**Problem:** Raw dosyalar birikip promote edilmiyor. 115+ raw, 11 source.  
**Çözüm (3 parça):**

**Seviye 1 — `/mindlore-maintain triage` komutu:**
- raw/ altındaki source'u olmayan dosyaları listele
- Her biri için öner: "ingest et / arşivle / sil"
- Toplu onay seçeneği

**Seviye 2 — Mekanik pre-processing (DB-backed cache):**
- Raw dosyadan LLM'siz metadata çıkar: title (ilk heading), URL (frontmatter), tarih, heading listesi, boyut
- `raw_metadata` tablosuna yaz — bir kez parse, sonraki triage'larda DB'den oku
- Migration: `scripts/lib/migrations-v062.ts` (mevcut pattern: migrations-v052, migrations-v061)
- Init.ts'de version check + otomatik migration (migrations/ dizini yok, inline TS pattern)
- Triage listesi zengin ve hızlı: "Bu dosya 3 heading, 1214 satır, URL: github.com/..."

**Birikme uyarısı:**
- Session-end hook'ta source'u olmayan raw sayısını kontrol et (raw_metadata tablosundan COUNT)
- 5+ ise: `"[Mindlore] 23 raw dosya promote bekliyor — /mindlore-maintain triage ile listele"`

**Bağımlılık:** #25 (URL cache) — triage'da zaten ingest edilmiş URL'ler atlanmalı  
**Etkilenen:** `skills/mindlore-maintain/SKILL.md`, yeni: `scripts/lib/triage.ts`, `hooks/mindlore-session-end.cjs`, `migrations/v062-001-raw-metadata.sql`  
**Test:** Triage script test, migration upgrade test (downgrade desteklenmiyor — mevcut pattern), session-end birikme uyarısı test  
**Başarı kriteri:** `/mindlore-maintain triage` liste gösteriyor, session-end birikme uyarıyor, migration sorunsuz çalışıyor

### #17 — Compaction Snapshot (Full)

**Problem:** Compaction sonrası model "ne yapıyorduk" sorusuna cevap veremiyor.  
**Çözüm:**
- PreCompact hook'u genişlet:
  - `buildSessionPayload()` çağır (decisions/frictions/learnings)
  - `git diff --stat` ile değişen dosya listesi
  - Aktif plan/task durumu (varsa plan dosyasını oku)
  - FTS5'e son aramaları flush et
  - Tümünü structured markdown olarak `diary/compaction-snapshot-{ts}.md`'ye yaz
- PostCompact hook'u genişlet:
  - Son compaction snapshot'ı oku
  - Context'e inject et: `[Mindlore Compaction Resume] ...`

**Edge case'ler:**
- Compact mid-task: aktif task varsa snapshot'a dahil et
- Boş session: snapshot minimal olmalı (sadece INDEX pointer)
- Birden fazla compact: her biri yeni snapshot, PostCompact en sonuncuyu inject eder
- Snapshot retention: son 5 snapshot tut, eskileri sil (diary/ şişmesini önle)

**Etkilenen:** `hooks/mindlore-pre-compact.cjs`, `hooks/mindlore-post-compact.cjs`, `scripts/lib/session-payload.ts`  
**Test:** pre-compact ve post-compact test suite'lere snapshot assertion ekle  
**Başarı kriteri:** Compaction sonrası "ne yapıyorduk" bilgisi korunuyor

### Simplify Refactor (Faz 3 kısmı)

| Bulgu | Çözüm | Dosya |
|-------|-------|-------|
| Session-focus 4-level nesting | DB section'ı `tryRecoverDb()` ve `loadDbContent()` fonksiyonlarına extract | `hooks/mindlore-session-focus.cjs` |

---

## Must-Ship vs Nice-to-Have

**Must-ship (v0.6.2 minimum viable):**
- #31 Session-Focus Performans — her session'ı etkiliyor
- #8 Upgrade CLI — kullanıcı-facing eksik feature
- #1 Context Savings — ürünün değerini ölçme
- #17 Compaction Snapshot — context kaybı en büyük sorun
- #9 Session Özet — compaction ile birlikte anlam kazanıyor

**Nice-to-have (kesilebilir):**
- #4 Flaky Test, #5 Dep Audit — CI kalitesi, acil değil
- #7 Obsidian Sync — DX iyileştirme
- #25 URL Cache, #26 Health Dashboard — küçük DX
- #15 Raw Triage — güzel ama opsiyonel
- 7 simplify bulgusu — teknik borç, kesilebilir

---

## Plugin Compat Notu

`_writeTelemetry` internal function, export edilmiyor — signature değişikliği dış kullanıcıları etkilemez. `withTimeoutDb` zaten export ama 0 production caller — wire etmek breaking change değil. v0.6.2 semver minor olarak güvenli.

---

## Test Stratejisi

- Her faz sonrası: `npm run build && npm test && npm run lint`
- Faz 1 sonrası: perf benchmark (session-focus p50)
- Faz 2 sonrası: `npx mindlore perf --savings` + `npx mindlore health`
- Faz 3 sonrası: compaction dry-run + triage dry-run
- Release öncesi: `/simplify` review (isteğe bağlı)

## Tahmini Timeline

- **Faz 1:** 1 session
- **Faz 2:** 2 session
- **Faz 3:** 2 session
- **Toplam:** ~5 session
