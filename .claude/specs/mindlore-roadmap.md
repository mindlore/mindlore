# Mindlore Roadmap

**Amaç:** Mindlore'un tüm versiyonlar için merkezi planlama dosyası. Her planlama öncesi buraya bak.  
**Kural:** Her madde ya v0.6.1, ya v0.7, ya v1.0'a taksim edilmiş. Yeni ertelemeler bu dosyaya eklenir.  
**Araştırma kaynakları:** Context-Mode kaynak kod analizi (2026-04-26), Agentic Stack, LLM Wikid, Lemma, Hindsight, GBrain, Awesome Autoresearch, Claude Agent SDK

### Araştırma Dizini

| Tarih | Dosya | İçerik |
|---|---|---|
| 2026-04-26 | `.claude/specs/research-2026-04-26-ecosystem-analysis.md` | 8 repo analizi — mevcut maddelere ek referanslar + 8 yeni fikir (A-H) + öncelik matrisi |

**Yeni fikirler (raporda detaylı, henüz roadmap maddesi değil):**
- **A.** Episodic → Lesson Graduation (Agentic Stack) → v0.7
- **B.** Dream Cycle — arka plan zenginleştirme (GBrain) → v0.7 #11 Daemon'a ek
- **C.** Memory Relate — otomatik cross-reference (Lemma) → v0.7 #8 KG'ye ek
- **D.** Reflect genişletme (Hindsight) → mevcut skill güncelleme
- **E.** Confidence Dashboard (LLM Wikid) → v0.6.1 #1 Telemetry'ye ek
- **F.** Source-Type Aware Extraction (LLM Wikid) → v0.7 yeni madde
- **G.** Multi-Strategy Retrieval + RRF (Hindsight + GBrain) → v0.7+
- **H.** Self-Improving Agent Loop (Autoresearch) → v1.0+

---

## v0.6.1 — Core: Init + DB + Arama ✅ RELEASED (2026-04-27)

npm@0.6.1 yayında. 24 commit, 76 suite, 558 test, 0 lint error. Simplify review dahil.

### Release Bölme Tablosu

| Madde | Başlık | v0.6.1 | v0.6.2 | Neden |
|-------|--------|--------|--------|-------|
| #1 | Telemetry + Context Savings | ⚠️ kısmi | savings → v0.6.2 | Telemetry OK, savings hook'lar emit etmiyor |
| #2 | Corrupt DB Recovery | ✅ | | Session start güvenliği |
| #6 | Init Test Template Fix | ✅ | | Her release kırılıyor |
| #8 | Init Tam Kurulum + Upgrade + Auto-Doctor | ⚠️ kısmi | upgrade CLI → v0.6.2 | Init+doctor OK, --upgrade CLI routing bağlı değil |
| #10 | Git Push Timeout | ✅ | | Tek satır fix |
| #11 | FTS5 Arama Kalitesi | ✅ | | Arama temel feature |
| #16 | Recall Shield | ✅ | | Tek satır mantık değişikliği |
| #24 | DB Tutarsızlık Düzeltme | ✅ | | Tüm DB maddelerinin ön koşulu |
| #28 | Doctor CLI | ✅ | | Init + debug temel aracı |
| #29 | Hook Timeout Safety | ✅ | | Bug riski — güvenlik |
| #30 | Plugin Marketplace | ✅ | | CC-native kurulum |
| #3 | Hybrid Search Normalize | | → v0.6.3 S2 | RRF + Trigram olarak genişletildi |
| #4 | Flaky Test Detection | | ✅ | Stabilite |
| #5 | Dependency Audit | | ✅ | Periyodik |
| #7 | Obsidian Sync Recursive | | ✅ | DX iyileştirme |
| #9 | Session Özet Injection | | ✅ | Brainstorm gerekli |
| #12 | Episode Injection Stale | | ~~v0.6.2~~ ÇÖZÜLDÜ | v0.6.1 DB fixleri sonrası bug düzeldi — 2026-04-27 doğrulandı |
| #13 | Non-Blocking Ingest | | → v0.6.4 | Inbox pattern + llms.txt birleşik. Skill bloklama sorunu — CC skill fork da blocking |
| #14/#23 | Session Transcript FTS5 | | → v0.6.3 S5 | Chunking olarak genişletildi |
| #15 | Raw Inbox Triage | | ✅ | Pipeline otomasyonu |
| #17 | Compaction Snapshot + Budget + Resume | | ✅ | Büyük özellik |
| #18 | Ingest llms.txt | | → v0.6.4 | #13 ile birleşik — inbox pattern içinde llms.txt parser |
| #20 | Search Smart Snippet | | → v0.6.3 S11 | Search overhaul'a taşındı |
| #21 | Search TTL Cache | | → v0.6.3 S12 | Search overhaul'a taşındı |
| #22 | Progressive Throttling | | → v0.6.3 S13 | Search overhaul'a taşındı |
| #25 | URL Ingest Cache | | ✅ | DX iyileştirme |
| #26 | Health Dashboard | | ✅ | Düşük öncelik |
| #27 | Daemon Deprecation | ✅ | | Detay bölümü v0.6.1 diyor, deprecated etiketi küçük iş |

| #31 | Session-Focus Performans | | ✅ | p50=3093ms → hedef <500ms |

**v0.6.1 = 12 madde** (çoğu küçük-orta, net scope) ✅ RELEASED (2026-04-27)
**v0.6.2 = 15 madde** (brainstorm gerektiren büyük özellikler + DX + 2 kısmi taşıma + perf + simplify 7 bulgu) ✅ RELEASED (2026-04-28)
**v0.6.4 = #13 Non-Blocking Ingest + #18 llms.txt + #15 toplu promote** (inbox pattern, skill bloklama çözümü, toplu LLM processing)

### v0.6.1 Simplify'dan Ertelenen Bulgular (2026-04-27, v0.6.1'e dahil edildi)

3 paralel review agent (reuse, quality, efficiency) 40 bulgu üretti. 11'i v0.6.1'de fix'lendi, geri kalanı:

| Bulgu | Açıklama | Neden Ertelendi | v0.6.3 Scope |
|-------|----------|-----------------|--------------|
| Search hook 3 DB open | Her UserPromptSubmit'te 3 ayrı `openDatabase` çağrısı. Tek handle reuse edilmeli | → v0.6.3 Search Engine Overhaul'da çözülecek — hook zaten baştan yazılacak | ✅ S1-S13 rewrite'da otomatik çözülecek |
| sqlite-vec per-event load | `loadSqliteVecCjs(db)` her prompt'ta extension yüklüyor. CC hook'ları ayrı process, module cache geçersiz | Mimari kısıt — MCP Server'a geçişte çözülecek (v0.7) | → v0.7 (MCP Server) |
| withTimeoutDb zero callers | Export + test var, production'da kullanılmıyor | v0.6.2'de hook'lara wire edilecek | ✅ → S27 |
| _writeTelemetry object param | 4 positional param → single object refactor | Minor, kırıcı değişiklik değil | ✅ → S28 |
| Perf O(H*N) filter | `calculatePercentiles` her hook için full array filter | Trivial dataset, ölçülebilir fark yok | ❌ Atlandı (ölçülebilir fark yok) |
| Doctor EXPECTED_HOOKS drift | Hand-maintained array, plugin.json'dan derive edilebilir | Style, runtime risk yok | ✅ → S29 |
| Session-focus 4-level nesting | DB section try-in-try-in-if-in-try | Büyük refactor, fonksiyon extract gerekli | ✅ → S19 (zaten planlanmış) |
| Init config merge nesting | 4 seviye iç içe if/for | Generic `mergeDefaults` utility gerekli | ✅ → S30 |
| registerAgents content compare | Her init'te readFileSync ile karşılaştırma | mtime+size guard eklenebilir, init nadir çalışır | ✅ → S31 |

### 1. Hook Telemetry Genişletme
v0.6.0'da sadece `.mindlore/telemetry.jsonl` append-only. v0.6.1'de:
- **`mindlore perf` komutu** — son N gün için hook başına p50/p95/p99 latency raporu
- **Slow query uyarısı** — >500ms hook'ta stderr'e warn (configurable threshold)
- **Telemetry rotation** — jsonl büyüdüğünde gzip + rotate (logrotate stili)
- **`mindlore perf --top N`** — en yavaş N sorgu
- **Aggregation cache** — her sorguda full scan yerine incremental
- **Ek — Context Savings Metric (Context-Mode İlhamlı):**
  - Mindlore "context kirletmeden bilgi inject" ediyor ama **ne kadar tasarruf ettiğini ölçmüyor.**
  - Context-Mode'da `trackResponse()` her tool response'un orijinal vs sıkıştırılmış boyutunu kaydediyor → "Bu session'da 12K token tasarruf" raporu.
  - Çözüm: Her hook inject'inde `injected_tokens` + `full_read_tokens` (eğer agent dosyayı okusaydı) kaydı. `mindlore perf --savings` ile session bazlı tasarruf raporu. Ürünün değerini sayısallaştırma.

### 2. Corrupt DB Auto-Recovery
- **Problem:** FTS5 corruption → manuel `npm run index` zorunlu
- **Çözüm:** Session başında `PRAGMA integrity_check` → corrupt ise auto-rebuild fallback
- **Dosya:** `hooks/mindlore-session-focus.cjs` — integrity check + recovery flow
- **Yedek:** Rebuild öncesi `.mindlore/mindlore.db.corrupt.bak` al
- **Context-Mode referans (`db-base.ts`):**
  - Corruption detection: `isSQLiteCorruptionError(msg)` regex ile hata mesajı parse
  - Recovery: `deleteDBFiles(path)` → WAL + SHM dosyalarını da sil → fresh DB oluştur
  - Orphan cleanup: `cleanOrphanedWALFiles(path)` — kalan `-wal`, `-shm` dosyalarını temizle
  - Pattern: try open → catch corruption → backup → delete all → retry open

### 3. Hybrid Search Scoring Normalize
- **Problem:** FTS5 BM25 + sqlite-vec cosine farklı skalalar → hybrid sıralama tutarsız
- **Çözüm:** RRF (Reciprocal Rank Fusion) veya min-max normalization + weighting config
- **Config:** `.mindlore/config.json` → `search.hybridWeight: { fts: 0.6, vec: 0.4 }`
- **Etkilenen:** `scripts/lib/hybrid-search.ts`
- **Test:** Hybrid test suite'e normalize assertion ekle

### 4. Flaky Test Detection
- **Problem:** `episode-file idempotency`, `session-focus EPERM` gibi testler Windows'ta flaky
- **Çözüm:** Jest retry plugin + `@flaky` tag + CI'da 3 retry
- **Çıktı:** Flaky test dashboard (`.flaky-tests.json`)

### 5. Dependency Audit + Update
- `npm audit` + `npm outdated` periyodik
- Node version ceiling yenileme (v25, v26)
- TypeScript 6 → 7 (çıkarsa)
- Jest 30 → 31

### 6. Init Test Template Hardcoded Version Fix
- **Problem:** `init.test.ts` her release'de kırılıyor (template assertion hardcoded version içeriyor)
- **Çözüm:** Template version'u runtime'da package.json'dan oku, test dinamikleştir

### 7. Obsidian Sync — Recursive Alt Klasör Desteği
- **Problem:** `syncObsidian()` sadece tek seviye alt klasör destekliyor (`raw/*.md` + `raw/subdir/*.md`). `raw/sessions/{proje}/*.md` gibi 2+ seviye derinlikteki dosyalar Obsidian'a aktarılMIYOR.
- **Kanıt:** `~/.mindlore/raw/sessions/` altında 22 proje klasörü, 3515 dosya var. Obsidian vault'ta `raw/sessions/` klasörü var ama **tamamen boş**.
- **Kök neden:** `mindlore-session-end.cjs:430-455` — `readdirSync` + `withFileTypes` döngüsü sadece 1 seviye alt klasöre iniyor.
- **Çözüm:** Recursive `fs.readdirSync` veya `walkDir` helper ile derinlik sınırı kaldırılmalı. Klasör yapısı birebir korunarak Obsidian'a aktarılmalı. 10 alt klasör de olsa yapı bozulmadan eşitlenmeli.
- **Etkilenen dosyalar:** `hooks/mindlore-session-end.cjs` (`syncObsidian` fonksiyonu)
- **Test:** Obsidian export test'e 2+ seviye alt klasör assertion ekle
- **Performans:** İlk çalıştırma = full sync. Sonraki çalıştırmalar = `file_hashes` SHA256 karşılaştırma, sadece değişen dosyaları kopyala. 3515 dosyayı her session sonunda full copy yapmak 30+ saniye ekler — incremental zorunlu.

### 8. Init Tam Kurulum — Agent Registration
- **Problem:** `npx mindlore` hook'ları (`mergeHooks`) ve skill'leri (`registerSkills`) register ediyor ama `plugin.json`'daki 3 agent'ı (`mindlore-assistant`, `mindlore-researcher`, `mindlore-librarian`) hiçbir yere kaydetmiyor.
- **Beklenti:** Kullanıcı `npx mindlore` yazınca hook + skill + agent + DB + config dahil her şey tek komutla kurulmalı. Ayrı `npx skills add` gerekmemelİ.
- **Kök neden:** `scripts/init.ts` — `registerSkills()` (Step 7) var ama `registerAgents()` fonksiyonu yok.
- **Çözüm:** `registerAgents()` fonksiyonu ekle — `plugin.json`'dan agent tanımlarını oku, `~/.claude/agents/` altına kopyala (skill registration pattern'i ile aynı). Init main flow'a Step ekle.
- **Etkilenen dosyalar:** `scripts/init.ts`
- **Test:** Init test'e agent registration assertion ekle
- **Ek — Upgrade Komutu (Context-Mode İlhamlı):**
  - **Problem:** `npx mindlore` init yapıyor ama zaten kurulu sistemi güncellemek için ayrı flow yok. v0.5 → v0.6 geçişinde 4 yeni hook eklendi — kullanıcı bunu nasıl alacak?
  - **Context-Mode'da:** `ctx_upgrade` — pull latest, rebuild, migrate cache, fix hooks. Tek komut.
  - **Çözüm:** `npx mindlore` re-run'ı upgrade olarak da çalışmalı (idempotent). Test edilmesi gereken: (1) yeni hook'lar merge ediliyor mu, (2) kaldırılan hook'lar temizleniyor mu, (3) yeni skill'ler ekleniyor mu, (4) migration'lar auto-run oluyor mu. Çalışmıyorsa `npx mindlore --upgrade` flag'i ekle.
  - **Etkilenen:** `scripts/init.ts` — upgrade detection + diff-based merge
- **Ek — Post-Install Auto-Doctor (Context-Mode İlhamlı):**
  - **Problem:** Init sonunda "her şey çalışıyor mu?" kontrolü yok. Hook kayıt edildi ama settings.json'a yazıldı mı? DB oluşturuldu ama integrity geçiyor mu?
  - **Çözüm:** Init flow'un son adımı olarak `doctor()` çağır. Başarısız adımları raporla. "npx mindlore çalıştırdım ama hook'lar çalışmıyor" sorununu önler.
  - **Bağımlılık:** #28 (Mindlore Doctor CLI)

### 9. Session Özet Injection — Önceki Session Bağlamı
- **Problem:** Yeni session başladığında inject edilen bilgiler: INDEX, son delta (commit/dosya listesi), DB'den kararlar/friction/öğrenmeler. Ancak **önceki session'da ne konuşulduğu, ne planlandığı, ne ertelendiği** inject edilmiyor. Delta sadece git diff — konuşma bağlamı kayıp.
- **Mevcut durum:**
  - `cc-session-sync.js` CC JSONL transcript'lerini `raw/sessions/{proje}/*.md`'ye çeviriyor (full transcript, 770+ satır)
  - `session-payload.ts` → `buildSessionPayload()` DB'deki episodes tablosundan Session/Decisions/Friction/Learnings çıkarıyor
  - Eksik olan: konuşma seviyesinde özet — "ne konuştuk, ne planladık, ne yaptık, ne ertelendi"
- **Çözüm alternatifleri (brainstorm gerekli):**
  1. **SessionEnd'de özet çıkarma:** Session end hook'unda (worker'da) son session'ın JSONL'ini oku, LLM-free heuristic ile özet çıkar: user mesajlarından plan/karar/erteleme keyword'leri tara, `## User` bloklarından intent çıkar, commit mesajlarıyla korelesyon yap. Sonucu `diary/session-summary-{ts}.md` olarak yaz.
  2. **SessionStart'ta lazy özet:** Session start'ta son `raw/sessions/{proje}/` dosyasını oku, ilk 50 satırdan (frontmatter + ilk birkaç user/assistant mesajı) özet extract et. Avantaj: mevcut veriyi kullanır, yeni dosya üretmez. Dezavantaj: 770 satır dosyadan özet çıkarmak session start latency ekler.
  3. **Episode tablosuna summary alanı:** `cc-session-sync.js` transcript'i yazarken aynı zamanda özet çıkarıp `episodes` tablosuna `session_summary` kolonu ekle. `buildSessionPayload` bunu okusun.
- **İstenilen injection formatı:**
  ```
  [Mindlore Session Özeti]
  Önceki session (2026-04-25 15:54, mindlore):
  - Konuşulan: v0.6.0 release hazırlığı, simplify review
  - Yapılan: 5 commit — telemetry rotation, parseFrontmatter dedup, HF test skip
  - Planlanan: merge + push → CI → E2E → release
  - Ertelenen: Hook DX (3 bulgu → v0.6.1 SPEC)
  - Açık sorunlar: skill-path-resolution EPERM (Windows)
  ```
- **Etkilenen dosyalar:** `scripts/cc-session-sync.ts`, `scripts/lib/session-payload.ts`, `hooks/mindlore-session-focus.cjs`
- **Güvenlik (KRİTİK):** Tüm summary üretim path'leri `redactSecrets` filtresinden geçmeli (`scripts/lib/privacy-filter.ts`). Aksi halde API key, token vb. `diary/`'ye yazılır → `mindlore-data` private repo'ya push olur.
- **Karar kriterleri (brainstorm öncesi):**
  - Latency budget: SessionStart'a max 200ms ek
  - Özet kalitesi: en az 3 user intent + 3 yapılan iş içermeli
  - Storage: yeni dosya yaratmama tercih edilir (mevcut tablo/dosya yapısını kullan)
- **Ön koşul:** Brainstorm session — hangi alternatif, özet kalitesi vs latency trade-off

### 10. Git Push Timeout
- **Problem:** `syncGlobalRepo` push timeout'u 15 saniye. Windows'ta yavaş ağda `ETIMEDOUT` hatası (hook log: `2026-04-25T07:59` session).
- **Çözüm:** Timeout 15s → 30s. Tek satır değişiklik.
- **Etkilenen dosya:** `hooks/mindlore-session-end.cjs` (`syncGlobalRepo` fonksiyonu)

### 11. FTS5 Arama Kalitesi — Gürültü, Tokenization, Proje Filtresi
- **Problem (3 katmanlı):**
  1. **Subagent gürültüsü:** `cc-subagent` 3221 kayıtla FTS5'in %80'i. Knowledge (sources, domains, analyses) gürültüde kayboluyor.
  2. **Tokenization bozuk:** Versiyon numaraları (`0.6.1`) `porter unicode61` tokenizer tarafından `0 OR 6 OR 1` olarak parçalanıyor. Her doküman match oluyor — sonuçlar anlamsız. `mindlore-search.cjs` hook'u bu parçalanmış token'ları `OR` ile birleştirip sorguluyor.
  3. **Proje filtresi yok:** `mindlore-search.cjs` L128'de `WHERE mindlore_fts MATCH ?` — proje filtresi yok. Mindlore projesinde çalışırken kastell subagent transcript'leri sonuçlara karışıyor. `project` değişkeni L85'te alınıyor ama WHERE clause'a hiç girmiyor.
- **Kanıt:**
  - "0.6.1" araması → kastell subagent transcript'leri ilk 3'te, gerçek `v0.6.1-roadmap.md` spec dosyası çıkmıyor
  - "kritik karar" araması → son session kararları (TCP localhost, hash dedup) bulunamıyor
  - DB dağılımı: cc-subagent:3221, raw:241, diary:186, cc-session:114, sources:64, domains:5
- **Çözüm (brainstorm gerekli):**
  1. **Proje filtresi:** `WHERE project = ? AND mindlore_fts MATCH ?` — aktif projeyi öncelikle ara, sonuç yoksa global fallback
  2. **Tokenization fix:** Noktalı versiyon numaralarını (`0.6.1`, `v0.5.3`) exact phrase match yap, `OR` parçalamaya düşürme. Regex: `/\d+\.\d+(\.\d+)?/` detect → `"0.6.1"` quoted phrase
  3. **Kategori boost:** Knowledge tipleri (sources, domains, analyses, decisions) > transcript tipleri (cc-subagent, cc-session). BM25 rank'e category-based weight çarpanı ekle
  4. **Subagent filtresi:** Default aramada `cc-subagent` hariç tut, `--all` ile dahil et. Alternatif: ayrı FTS tablosu veya hiç indexlememe
- **Etkilenen dosyalar:** `hooks/mindlore-search.cjs` (hook sorgusu), `scripts/lib/hybrid-search.ts`, `scripts/mindlore-fts5-index.js`
- **Not:** Bu sorun session start injection'ı da etkiliyor — `mindlore-search` hook'u her UserPromptSubmit'te çalışıyor ve bozuk sonuçlar context'e inject ediyor
- **FTS5 Teknik Arka Plan (brainstorm referansı):**
  - FTS5 SQLite built-in full-text search motoru. Döküman eklenirken metin tokenizer'dan geçer, inverted index oluşturur. Arama sırasında sorgu da aynı tokenizer'dan geçer.
  - **Tokenizer:** `porter unicode61` — `unicode61` noktalama işaretlerini (`.`, `-`, `_`) ayırıcı olarak kullanır, `porter` stemming yapar ("running"→"run").
  - **BM25 Scoring:** `term_frequency × inverse_document_frequency`. Nadir kelimeler yüksek skor alır. Subagent transcript'leri %80 olduğu için IDF'i domine ediyor — knowledge dosyalarındaki kelimeler "nadir" çıkmıyor.
  - **Tokenizer fix seçenekleri:** (1) Versiyon pattern detect → FTS5 phrase query `"0 6 1"` (yan yana arama). (2) Tokenizer config: `tokenize='porter unicode61 tokenchars "."'` — `.` ayırıcı değil token karakteri olur. (3) Hook'ta regex pre-process: `/\d+\.\d+(\.\d+)?/` yakalayıp quoted phrase'e çevir.
  - **IDF fix:** Subagent'ları ayrı tabloya taşımak IDF'i düzeltir — knowledge tablosunda "karar" kelimesi 5/800 dokümanda geçer (nadir = yüksek skor), şu an 5/4021'de (nadir değil = düşük skor).
- **Context-Mode referans (`store.ts`):**
  - **Porter stemming:** `tokenize='porter unicode61'` — "running/ran/runs" aynı token olur, recall %30-50 artar
  - **Fuzzy correction + LRU cache:** Levenshtein distance ile typo toleransı ("kuberntes"→"kubernetes"), 256-entry LRU cache ile tekrarlayan sorgular O(1). Vocabulary tablosu insert-only, cache sadece yeni kelime girişinde invalidate olur
  - **Intent-driven filtering:** Output >5KB ise tamamını FTS5'e index'le, BM25 ile sadece relevant chunk'ları döndür. Searchable terms vocabulary ile follow-up search kolaylaşır
  - **Heading-aware chunking:** Markdown'ı `##` heading'lerden böl, code block'ları parçalama. Tüm dosya tek kayıt yerine heading başına chunk → BM25 precision artar

### 12. Episode Injection Stale — Hep Aynı Eski Episode
- **Problem:** `mindlore-session-focus` (SessionStart) ve `mindlore-search` (UserPromptSubmit) her mesajda aynı eski episode'ları inject ediyor. Gözlem: Bugün (2026-04-25) 6+ session olmasına rağmen inject edilen episode'lar hep 2026-04-18 ve 2026-04-19'dan — 1 haftalık stale veri sürekli tekrarlanıyor.
- **Kanıt:** Bu session boyunca her promptta aynı 2 episode geldi:
  - `Session: c5616b5 fix: episode-file idempotency test...` (2026-04-18)
  - `Episode — 2026-04-18-1527`
  - Sonraki promptlarda `Episode — 2026-04-19-2126` geldi — ama bugünkü session'lar hiç çıkmadı
- **Olası kök neden:** Episode sorgusu `created_at DESC` yerine `id` sırasıyla çalışıyor, veya proje + tarih filtresi bozuk, veya bugünkü session'lar henüz episode olarak yazılmamış (session end worker gecikmesi)
- **Etkilenen dosyalar:** `scripts/lib/session-payload.ts` (`buildSessionPayload`), `hooks/mindlore-session-focus.cjs`
- **Çözüm:** Episode sorgusunu `created_at DESC` + `project = ?` + `LIMIT 5` ile düzelt. Bugünkü session'ların episode'a yazılıp yazılmadığını doğrula.

### 13. Non-Blocking Ingest — Inbox Pattern
- **Problem:** `/mindlore-ingest` skill olduğu için ana agent'ı blokluyor. Birden fazla URL verildiğinde session dakikalarca donuyor. Subagent de kendi context'i ile token yakıyor.
- **CC Kısıtı:** Skill = ana agent = bloklu + token. CC içinden tam çözüm mümkün değil.
- **Olası çözümler (brainstorm gerekli):**
  1. **Inbox pattern:** Skill URL'leri anında `raw/inbox/*.md`'ye yazar (1sn) → arka planda deterministik Node script fetch + raw + FTS5 yapar (LLM'siz, kalite düşer) → sonra `/mindlore-maintain ingest` ile LLM quality pass
  2. **Headless CLI:** `node dist/scripts/mindlore-batch-ingest.js <urls>` — Bash `run_in_background` ile çalışır, LLM'siz
  3. **Hybrid:** Skill inbox'a yazar + `Bash run_in_background` ile script tetikler. LLM özet kısmı sonraki session'a kalır
- **Trade-off:** Hız vs kalite. Deterministik script tag/özet çıkaramaz, sadece mekanik (fetch + raw yazım + FTS5)
- **Ön koşul:** Brainstorm — hangi aşamalar LLM gerektirir, hangileri mekanik yapılabilir

### 14. Session FTS5 Index — Transcript Aranabilirliği (Context-Mode İlhamlı)
- **Problem:** 3533 session transcript `raw/sessions/` altında ama FTS5'te aranabilir değil. "Bunu daha önce konuşmuştuk" sorusuna cevap verilemiyor.
- **İlham:** Context-Mode (mksglu/context-mode) + Agentic Stack
- **Proje bazlı arama kuralı:**
  - Session transcript'leri **proje bazlı** aranır: kastell projesindeyken sadece `raw/sessions/kastell/` aranır
  - Raw araştırma dosyaları + sources + domains **tüm projelerden** aranır (global knowledge)
  - Search hook'ta: `project_scope = aktif proje` → sessions filtreli, knowledge global
- **Context-Mode'dan alınacak 6 mekanizma:**
  1. **Heading-based chunking:** Session dosyaları `## User` / `## Assistant` heading'lerine göre chunk'lanır (şu an tüm dosya tek kayıt — context şişiyor)
  2. **Çift strateji arama + RRF:** Porter stemming MATCH + Trigram substring → Reciprocal Rank Fusion ile birleştir. Tek keyword OR yetersiz
  3. **Smart snippets:** Tüm dosya/description değil, eşleşen terimlerin etrafındaki pencereyi döndür (~200 byte). Context kirlenmez
  4. **Heading 5x boost:** Başlıklardaki eşleşmeler body'dekinden 5 kat ağırlıklı
  5. **Proximity reranking:** Çok kelimeli sorgularda kelimeler yakınsa boost ("TCP localhost karar" → üçü yan yana olan chunk üste)
  6. **Fuzzy correction:** Levenshtein distance ile typo toleransı ("kuberntes" → "kubernetes")
- **Mevcut Mindlore vs hedef karşılaştırma:**
  - Chunking: tüm dosya tek kayıt → heading-based chunk **(KRİTİK)**
  - Arama: keyword OR → Porter + Trigram + RRF **(KRİTİK)**
  - Sonuç: description + headings → smart snippet **(KRİTİK)**
  - Session kapsamı: indexsiz → proje bazlı FTS5 **(KRİTİK)**
  - Heading boost: yok → 5x **(ORTA)**
  - Proximity: yok → reranking **(ORTA)**
  - Fuzzy: yok → Levenshtein **(DÜŞÜK)**
- **Performans:** 3533 dosya full index ağır → incremental + proje filtresi + date range (son 30 gün veya aktif proje)
- **Etkilenen:** `scripts/mindlore-fts5-index.ts`, `hooks/mindlore-search.cjs`, `scripts/lib/hybrid-search.ts`
- **Sonuç:** Bu başarılırsa 3533 session + 61 araştırma + 65+ source = tüm bilgi birikimi aranabilir, context kirletmeden erişilebilir — gerçek "ikinci beyin"

### 15. Raw Inbox Triage — Otomatik Promote Pipeline
- **Problem:** Mindlore'un 4 katmanlı bilgi zenginleştirme pipeline'ı var:
  ```
  raw/ (ham capture) → sources/ (özetlenmiş) → domains/ (alan bilgisi) → analyses/ (sentez)
  ```
  Her katmanda bilgi daha yoğun ve bağlamlı hale geliyor:
  - **raw/**: URL'den çekilen ham metin, 1214 satır README — immutable, değiştirilmez
  - **sources/**: 38 satır özet + tags + quality score + related links — LLM üretir
  - **domains/**: Birden fazla source'un birleştiği alan sayfası — cross-reference
  - **analyses/**: Çapraz kaynak sentez, karşılaştırma tablosu, karar
  
  **Sorun:** Bu pipeline'ın HER adımı manuel tetikleniyor. Kullanıcı `/mindlore-ingest` çağırmazsa raw dosya sonsuza kadar raw kalır. Şu an 69 raw araştırma dosyası var, sadece 72'si source'a promote edilmiş. Yeni eklenen raw'lar otomatik olarak bir sonraki katmana ilerlemiyor.
  
  **Spesifik darboğazlar:**
  1. **raw → source:** `/mindlore-ingest` skill gerekiyor (LLM, bloklu, dakikalarca sürer)
  2. **source → domain:** `/mindlore-ingest` sırasında domain güncellemesi yapılıyor ama yeni domain oluşturma yapılmıyor
  3. **source → analysis:** Tamamen manuel — kullanıcı `/mindlore-query` ile sentez istemeli
  4. **Toplu işlem yok:** 10 raw dosya biriktiğinde hepsini tek komutla pipeline'dan geçirme imkanı yok
  
- **İlham:** LLM Wikid — `raw/clippings/` inbox → auto-sort → resolve → classify → compile → cross-link. Tam otomatik pipeline.
- **Çözüm (3 seviyeli):**
  1. **`/mindlore-maintain triage` komutu (v0.6.2):**
     - raw/ altındaki ingest edilmemiş dosyaları listele (source'u olmayan raw'lar)
     - Her biri için öner: "ingest et / arşivle / sil"
     - Toplu onay: "Hepsini ingest et" seçeneği
  2. **Mekanik pre-processing (v0.6.2):**
     - Raw dosyadan deterministik bilgi çıkar (LLM'siz): title, URL, tarih, dosya boyutu, heading listesi
     - Bu bilgiyi `raw_metadata` tablosuna yaz → triage listesi hızlı oluşur
     - LLM gereken kısım (özet, tag, kalite) sonraki adıma kalır
  3. **Birikme uyarısı (v0.6.2):**
     - Session sonunda birikmiş raw dosyaları kontrol et
     - 5+ birikmişse kullanıcıya bildirim: "5 raw dosya promote bekliyor"
  4. **Toplu promote (v0.6.4 — #13 inbox pattern ile birlikte):**
     - `/mindlore-maintain promote-all` ile toplu LLM processing
     - Domain güncellemeleri otomatik (mevcut domain varsa ekle, yoksa öner)
- **Etkilenen:** `skills/mindlore-maintain/SKILL.md`, yeni: `scripts/lib/triage.ts`, `hooks/mindlore-session-end.cjs` (birikme kontrolü)
- **Bağımlılık:** #25 (URL cache) — triage sırasında zaten ingest edilmiş URL'ler atlanmalı
- **Trade-off:** Tam otomasyon (LLM Wikid gibi) = yüksek token maliyeti + kalite riski. Semi-otomasyon = kullanıcı onayı gerekir ama kalite korunur. v0.6.2'de seviye 1+2+uyarı, v0.6.4'te toplu promote.

### 16. Recall Shield — Decay Koruması
- **Problem:** Sık erişilen dokümanlar da decay'e uğruyor. Değerli ama eski kaynaklar kaybolabiliyor.
- **İlham:** Lemma — erişilen öğeler decay'den korunuyor (shield), kullanılmayanlar yavaşça düşüyor
- **Çözüm:** Decay hesaplamada `recall_count > 0` olanların decay katsayısını düşür. `file_hashes.recall_count` + `last_recalled_at` zaten var
- **Etkilenen:** `scripts/lib/decay.ts` — tek satırlık mantık değişikliği
- **Test:** Decay test'e recall shield assertion ekle

### 17. Compaction Snapshot — Session Bağlamını Koruma (Context-Mode İlhamlı)
- **Problem:** PreCompact hook'umuz var ama sadece delta + FTS5 flush yapıyor. Compaction sonrası model "ne yapıyorduk, hangi dosyalara dokunmuştuk, hangi kararlar alınmıştı?" sorularına cevap veremiyor. Context tamamen kayboluyor.
- **İlham:** Context-Mode `session/snapshot.ts` — XML resume snapshot pattern
- **Context-Mode nasıl çözüyor:**
  - PostToolUse hook'u her tool call'dan 13 kategoride event çıkarıyor (file_read, file_write, git_commit, error, task, decision, cwd, rule, env, role, skill, subagent, intent)
  - Her event'e priority atanıyor (1=critical … 5=low)
  - SessionDB'ye yazılıyor (SQLite, WAL mode)
  - Compaction tetiklenince `buildSnapshot()`: DB'den event'leri oku → kategorilere grupla → her kategori için doğal dilde özet + `ctx_search("kategori")` tool call referansı üret
  - **Zero truncation** — tam veri DB'de kalır, snapshot sadece table of contents
  - Output: XML formatında resume snapshot, context'e inject edilir
- **Mindlore adaptasyonu:**
  - Mevcut `episodes` tablosu + `session-payload.ts` zaten session/decision/friction/learning çıkarıyor
  - Eksik: **dosya operasyonları** (hangi dosyalara dokunuldu) ve **tool call özeti** (ne kadar arama/okuma/yazma yapıldı)
  - PreCompact hook'a snapshot builder ekle: `buildSessionPayload()` + dosya listesi + aktif plan/task durumu
  - Snapshot formatı: Mindlore XML veya structured markdown — her section özet + FTS5 search referansı
  - PostCompact hook'ta bu snapshot'ı inject et (mevcut `mindlore-post-compact.cjs` genişletilir)
- **Etkilenen dosyalar:** `hooks/mindlore-pre-compact.cjs`, `hooks/mindlore-post-compact.cjs`, `scripts/lib/session-payload.ts`
- **Bağımlılık:** #9 (Session Özet) ile birleşebilir — ikisi de "session context kaybı" problemini farklı açılardan çözüyor
- **Test:** Compaction simulation test — snapshot içeriği doğrulama
- **Ek — Byte Budget + Priority Tier (Context-Mode İlhamlı):**
  - **Problem:** Snapshot boyutuna dair kısıt yok. Episodes + dosya listesi + plan durumu = kolayca 5-10KB olabilir → context şişer.
  - **Context-Mode'da:** Explicit ≤2KB budget. 15 event kategorisi priority tier'lı (1=critical … 5=low). Budget dolunca düşük öncelikli kategoriler düşürülüyor. "Zero truncation" — tam veri DB'de kalır, snapshot sadece table of contents.
  - **Çözüm:** `MAX_SNAPSHOT_BYTES = 2048` sabiti. Priority sırası: (1) aktif dosyalar, (2) kararlar, (3) commit'ler, (4) hata/friction, (5) arama geçmişi. Budget aşılırsa 5→4→3 sırasıyla kes.
- **Ek — Ayrı `session_resume` Tablosu (Context-Mode İlhamlı):**
  - **Problem:** Episodes tablosuna snapshot eklemek semantik karışıklık yaratır. Episodes = kalıcı knowledge (pattern extraction, reflect). Compaction resume = geçici (sadece o session'da lazım).
  - **Context-Mode'da:** `session_resume` ayrı tablo. Session kapandığında temizleniyor. Events tablosu bağımsız.
  - **Çözüm:** `CREATE TABLE session_resume (id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), restored INTEGER DEFAULT 0)`. Session başında son snapshot'ı oku + inject. Session sonunda temizle.

### 18. Ingest: llms.txt / llms-full.txt Fetch — GitHub Repo İyileştirmesi
- **Problem:** `/mindlore-ingest` GitHub repo URL'si verildiğinde sadece README'yi çekiyor (`gh api repos/.../readme`). Repo'nun kaynak kodu, mimari yapısı, hook/adapter sistemi gibi asıl değerli bilgiler yakalanmıyor.
- **İlham:** Context-Mode kendi repo'sunda `docs/llms.txt` ve `docs/llms-full.txt` sunuyor — LLM'ler için optimize edilmiş proje özeti
- **Çözüm (fetch-raw.ts'e ekleme):**
  1. GitHub repo detect edildiğinde sırayla kontrol et: `docs/llms-full.txt` → `docs/llms.txt` → `llms-full.txt` → `llms.txt`
  2. Varsa README yerine (veya yanında) bu dosyayı da çek → `raw/{slug}-llms.md` olarak kaydet
  3. Yoksa mevcut README-only flow devam etsin
  4. Source summary'de llms.txt'den alınan bilgileri de dahil et
- **Ek: Repo tree capture:** `gh api repos/.../git/trees/main?recursive=1` ile dosya ağacını da `raw/{slug}-tree.md` olarak kaydet. Mimari yapıyı anlamak için kritik.
- **Etkilenen:** `scripts/fetch-raw.ts`, `skills/mindlore-ingest/SKILL.md`
- **Not:** Raw dosya slug fix'i bu session'da yapıldı (commit `6821006`) — artık `context-mode.md` gibi okunabilir isimler kullanılıyor

### 19. Raw Dosya Slug Fix ✅ (Yapıldı — 2026-04-26)
- **Problem:** `fetch-raw.ts` dosya adı olarak SHA256 hash kullanıyordu (`2026-04-26-cfe6b1639c3c.md`). Raw klasörüne baktığında ne olduğunu anlayamıyordun.
- **Çözüm:** URL'den anlamlı slug çıkarma: GitHub repo → repo adı, diğer URL'ler → son 2 path segmenti, yol yoksa hash fallback
- **Commit:** `6821006` — `fix(ingest): use URL-derived slug for raw filenames instead of SHA256 hash`
- **Durum:** ✅ Tamamlandı

### 20. Search Hook Smart Snippet — Context Kirletmeden Sonuç (Context-Mode İlhamlı)
- **Problem:** `mindlore-search.cjs` hook'u FTS5 sonuçlarında tüm `description` alanını inject ediyor. 3 sonuç × 200+ kelime = context'e 600+ kelime gürültü. Uzun description'lı sources (raw session, analyses) context'i gereksiz şişiriyor.
- **İlham:** Context-Mode `smart snippets` — eşleşen terimlerin etrafındaki ~200 byte pencereyi döndürüyor, tüm doküman yerine. Output >5KB ise `intent-driven filtering` ile sadece relevant chunk'ları döndürüyor.
- **Çözüm:**
  1. FTS5 `snippet()` fonksiyonunu kullan: `snippet(mindlore_fts, 1, '<b>', '</b>', '...', 30)` — eşleşen terimin etrafından 30 token pencere
  2. Alternatif: manuel snippet — match pozisyonunu bul, ±100 karakter kes, `...` ile wrap et
  3. Description 300 karakteri aşarsa snippet'e düşür, kısaysa olduğu gibi döndür
- **Etkilenen:** `hooks/mindlore-search.cjs` (sonuç formatlama kısmı)
- **Bağımlılık:** #11 (FTS5 Arama Kalitesi) ile birlikte yapılabilir
- **Test:** Search hook test'e uzun description ile snippet assertion ekle

### 21. Search Hook TTL Cache — İki Katmanlı Cache (Context-Mode İlhamlı)
- **Problem:** `mindlore-search.cjs` her `UserPromptSubmit`'te fresh FTS5 sorgusu atıyor. Aynı session'da benzer/aynı kelimeler tekrar geçtiğinde gereksiz DB hit + aynı sonuçlar tekrar inject ediliyor.
- **İlham — Context-Mode 2 katmanlı TTL:**
  - **24h fetch cache:** `ctx_fetch_and_index` URL fetch'ini 24 saat cache'liyor — aynı URL tekrar istendiğinde network'e gitmeden index'ten döner
  - **14 gün cleanup:** Content DB'leri ve source'lar 14 günden eskiyse startup'ta silinir — stale veri birikmez
  - **Per-project DB:** `~/.context-mode/content/` altında proje bazlı ayrı SQLite DB
- **Mindlore Adaptasyonu — 2 katmanlı cache:**
  1. **Sorgu cache (kısa ömürlü, 5 dk TTL):**
     - SQLite tablosu: `search_cache(query_hash TEXT, result_json TEXT, created_at INTEGER)`
     - Cache key: normalize edilmiş sorgu (lowercase, trim, stop-word kaldır) → SHA256
     - Aynı sorgu 5 dk içinde tekrar gelirse DB'ye gitmeden cached sonuç dön
     - Cache invalidation: `FileChanged` hook FTS5 güncellediğinde tüm cache temizle
  2. **Stale cleanup (uzun ömürlü, 14 gün):**
     - Session transcript chunk'ları 14 günden eskiyse FTS5'ten silinir (context-mode pattern)
     - Knowledge dosyaları (sources, domains, analyses) **asla silinmez** — sadece decay mekanizması (#16) ile yönetilir
     - Cleanup tetikleme: session start'ta veya `mindlore-maintain` komutuyla
- **Dikkat:** Hook'lar CC'de ayrı process olarak çalışıyor — in-memory cache çalışmaz. SQLite tablo zorunlu.
- **Etkilenen:** `hooks/mindlore-search.cjs`, potansiyel migration
- **Test:** Cache hit/miss assertion, TTL expiry testi, 14-gün cleanup testi

### 22. Progressive Throttling — Tekrarlı Hook Çağrısı Sınırlaması (Context-Mode İlhamlı)
- **Problem:** `mindlore-search` hook'u her promptta çalışıyor. Aynı session'da 50+ prompt = 50+ FTS5 sorgusu. Çoğu benzer sonuç döndürüyor, context'e tekrar tekrar aynı bilgi inject ediliyor.
- **İlham:** Context-Mode progressive throttling:
  - Çağrı 1-3: Normal sonuç (query başına 2 sonuç)
  - Çağrı 4-8: Azaltılmış sonuç (query başına 1) + uyarı
  - Çağrı 9+: Bloklanır — toplu araca yönlendirir
- **Mevcut Mindlore:** `read-guard` hook'u tekrarlı dosya okuma için benzer mekanizma uyguluyor. Search hook'ta yok.
- **Çözüm:**
  1. Session başına hook çağrı sayacı (SQLite veya dosya tabanlı)
  2. İlk 10 prompt: normal (3 sonuç inject)
  3. 11-20: azaltılmış (1 sonuç, sadece en yüksek BM25)
  4. 20+: sadece yeni/farklı sorgu kelimesi varsa çalış, aksi halde skip
  5. Sayaç her session başında sıfırlanır
- **Etkilenen:** `hooks/mindlore-search.cjs`
- **Bağımlılık:** #21 (TTL Cache) ile birlikte yapılırsa daha etkili — cache + throttle birlikte context kirliliğini minimize eder

### 23. Session Transcript FTS5 — Context Kirletmeden Geçmiş Arama (Context-Mode İlhamlı)
- **Problem:** 3543 session transcript `raw/sessions/{proje}/` altında MD dosyası olarak duruyor ama FTS5'te aranabilir değil. "Bu konuyu daha önce konuşmuştuk", "kastell'de şu hatayı nasıl çözmüştük?" gibi sorulara cevap verilemiyor. Tüm dosyayı okumak context'i patlatır (ortalama dosya 770+ satır).
- **İlham:** Context-Mode'un tüm mimarisi bu problemi çözüyor:
  - `ctx_index`: Markdown'ı heading'lerden chunk'la, code block'ları koru, FTS5'e yaz
  - `ctx_search`: BM25 ile sadece relevant chunk'ları döndür, tüm dosya yerine
  - `intent-driven filtering`: Output >5KB ise index'le, sadece eşleşen bölümleri döndür
  - `ctx_execute_file`: Dosyayı sandbox'ta işle, sadece özet context'e girsin
- **Mindlore Adaptasyonu — 3 Katmanlı Mimari:**
  1. **Index katmanı (batch, arka plan):**
     - Session transcript'leri `## User` / `## Assistant` heading'lerine göre chunk'la
     - Her chunk ayrı FTS5 kaydı: `(chunk_id, session_file, project, date, role, content)`
     - Heading text'i 5x boost ile indexle (context-mode pattern)
     - İlk run: tüm 3543 dosya (ağır, bir kerelik). Sonraki: sadece yeni session'lar (incremental)
     - Tetikleme: `mindlore-session-end.cjs` — session kapanınca o session'ın transcript'ini chunk'la ve indexle
     - **Raw ingest dosyaları da aynı tabloya:** `raw/*.md` (URL'lerden çekilen ham araştırma dosyaları) da heading-based chunk'lanıp indexlenir. `project` alanı `_global` olarak işaretlenir.
  2. **Arama katmanı (on-demand, hook veya skill) — İKİ KAPSAMLI:**
     - **Kapsam 1 — Session transcript'leri (PROJE BAZLI):**
       - Aktif projedeyken sadece o projenin session'ları aranır (`WHERE project = ?`)
       - `raw/sessions/kastell/` → kastell projesinde, `raw/sessions/mindlore/` → mindlore projesinde
       - Başka projenin session'ı sonuçlara karışmaz
       - Date range: varsayılan son 30 gün, `--all` ile tüm geçmiş
     - **Kapsam 2 — Raw araştırma + sources + domains (GLOBAL):**
       - `raw/*.md` (ingest edilmiş URL'lerin ham dosyaları), `sources/*.md`, `domains/*.md`, `analyses/*.md` → **tüm projelerde** aranabilir
       - Bunlar proje bağımsız knowledge — hangi projede olursan ol erişilebilir
       - `WHERE project = '_global' OR project = ?` ile her iki kapsamı birleştirir
     - **Birleşik sonuç sıralaması:** BM25 + Porter stemming + heading 5x boost. Session ve global sonuçlar RRF ile birleştirilir.
     - Sonuç: smart snippet (±200 byte pencere), tüm chunk değil
     - Context'e max 3 snippet inject (toplam <500 token)
  3. **Recall katmanı (context koruma):**
     - Kullanıcı "bunu daha önce konuşmuştuk" dediğinde → FTS5 ile **proje session chunk'larını** ara
     - Kullanıcı "şu araştırmada ne vardı?" dediğinde → FTS5 ile **global raw/source chunk'larını** ara
     - Sonuç bulunursa snippet inject et, bulunmazsa "bulunamadı" de
     - Tüm transcript'i ASLA context'e okuma — her zaman chunk-level erişim
     - İsteğe bağlı: `ctx_execute_file` ile transcript'i sandbox'ta işle, sadece özet döndür
- **Performans bütçesi:**
  - Index: 3543 dosya × ~16 chunk/dosya = ~57K chunk. FTS5 bu hacmi rahat kaldırır (context-mode daha büyük hacimlerle çalışıyor)
  - Arama: proje filtresi + date range ile scope dar → <100ms
  - Session end hook'a eklenen indexleme: tek dosya chunk'lama ~50ms
- **Tablo şeması:**
  ```sql
  CREATE VIRTUAL TABLE session_fts USING fts5(
    content,
    session_file UNINDEXED,
    project UNINDEXED,
    date UNINDEXED,
    role UNINDEXED,
    heading,
    tokenize='porter unicode61'
  );
  ```
- **Etkilenen dosyalar:** `scripts/mindlore-fts5-index.ts` (batch indexer), `hooks/mindlore-session-end.cjs` (incremental), `hooks/mindlore-search.cjs` (arama), yeni: `scripts/lib/session-chunker.ts`
- **Bağımlılık:** #11 (FTS5 Kalitesi — tokenization fix), #14 (Session FTS5 Index — bu maddenin genişletilmiş hali)
- **İlişki #14 ile:** #14 genel session FTS5 vizyonunu anlatıyor. #23 bunu **context-mode pattern'leriyle somutlaştırıyor** — chunk mimarisi, snippet döndürme, recall katmanı. #14 üst seviye spec, #23 implementasyon detayı. İkisi birleştirilecek.
- **Sonuç:** Bu başarılırsa 3543 session = tüm konuşma geçmişi, context kirletmeden, proje bazlı, snippet seviyesinde aranabilir. Gerçek "geçmişe dönük hafıza."

### 24. DB Tutarsızlık Düzeltme — Proje Kolonu, Kategori, Senkronizasyon
- **Problem:** DB araştırması (2026-04-26) ciddi tutarsızlıklar ortaya çıkardı:
  1. **file_hashes.project_scope %87 NULL:** 4006 kayıttan 3506'sı proje atanmamış. cc-subagent (3235) ve cc-session (124) kayıtlarının tamamı NULL. Decay, recall, importance hesaplamaları proje bazlı çalışamıyor.
  2. **FTS5 project kolonu VAR ve DOLU ama search hook KULLANMIYOR:** `mindlore_fts` tablosunda `project UNINDEXED` kolonu mevcut, 4102 kaydın tamamında proje bilgisi var (kastell:2067, mindlore:630, quicklify:309...). Ama `mindlore-search.cjs` hook'u `WHERE` clause'unda proje filtresi yok — tüm projeler karışık aranıyor.
  3. **Kategori/tip karmaşası:** cc-subagent, cc-session ve raw dosyaların hepsi `type=raw` olarak indexli. FTS5'te tip ayrımı yetersiz — transcript mi, araştırma mı, knowledge mı ayırt edilemiyor.
  4. **İki tablo arası kayıt farkı:** file_hashes: 4006, FTS5: 4102 (96 fark — muhtemelen episodes tablosundan gelen kayıtlar file_hashes'te yok)
  5. **file_hashes.source_type vs FTS5.category uyumsuzluğu:** file_hashes'te `cc-subagent/cc-session/mindlore/cc-memory`, FTS5'te `cc-subagent/raw/diary/cc-session/episodes/sources...` — farklı taxonomy
- **DB İstatistikleri (2026-04-26 snapshot):**
  ```
  mindlore_fts:  4102 kayıt (cc-subagent:3235, raw:252, diary:212, cc-session:125, sources:72...)
  file_hashes:   4006 kayıt (NULL project: 3506, kastell: 282, mindlore: 201)
  episodes:       120 kayıt (mindlore:55, kastell:50, diğer:15)
  schema:           5 migration (v1→v5)
  ```
- **Çözüm (3 aşamalı):**
  1. **file_hashes project_scope backfill:** Mevcut NULL kayıtları düzelt — `path` alanından proje çıkar (`raw/sessions/kastell/` → `kastell`), cc-subagent'lar için FTS5'teki project değerini kopyala. Tek seferlik migration script.
  2. **Search hook'a proje filtresi ekle:** `mindlore-search.cjs` L128 civarı → `WHERE project = ? AND mindlore_fts MATCH ?` + global fallback. Bu #11'in en kritik parçası.
  3. **Kategori normalizasyonu:** FTS5'te `type` alanını düzelt — `cc-subagent` → `transcript`, `cc-session` → `session-transcript`, `raw` (sessions altında) → `session-transcript`, `raw` (sessions dışında) → `research`. Böylece `WHERE type IN ('source','domain','analysis','research')` ile knowledge, `WHERE type IN ('transcript','session-transcript')` ile konuşma geçmişi aranır.
- **Etkilenen dosyalar:** `scripts/mindlore-fts5-index.ts`, `hooks/mindlore-search.cjs`, yeni migration: `scripts/lib/migrations-v061.ts`
- **Bağımlılık:** #11 (FTS5 Kalitesi), #23 (Session FTS5). Bu madde her ikisinin **ön koşulu** — DB düzelmeden chunking veya proje filtresi sağlıklı çalışmaz.
- **Risk:** 4102 FTS5 kaydının re-index'i gerekebilir. Backup zorunlu.

### 25. URL Ingest Cache — Tekrarlı Fetch Önleme (Context-Mode İlhamlı)
- **Problem:** `/mindlore-ingest` aynı URL 2. kez verildiğinde deterministik kontrol yok. `fetch-raw.ts`'de duplicate check yok — aynı URL tekrar fetch edilir, yeni raw dosya yazılır, eski de kalır. Skill dosyasında (SKILL.md L64) "If URL already in the list, warn user" yazıyor ama bu LLM talimatı, kod seviyesinde enforce edilmiyor.
- **İlham — Context-Mode 2 katmanlı URL cache:**
  - **24h fetch TTL:** `ctx_fetch_and_index` URL'yi 24 saat cache'liyor. Aynı URL tekrar istendiğinde network'e gitmeden mevcut index'ten dönüyor.
  - **14 gün cleanup:** 14 günden eski content DB'leri startup'ta siliniyor — stale birikmez.
  - **`force: true`:** Cache bypass — zorla tekrar fetch et.
- **Mindlore Adaptasyonu:**
  1. **Yeni tablo veya file_hashes genişletme:**
     ```sql
     -- Seçenek A: file_hashes'e kolon ekle
     ALTER TABLE file_hashes ADD COLUMN source_url TEXT;
     ALTER TABLE file_hashes ADD COLUMN last_fetched_at TEXT;
     
     -- Seçenek B: ayrı tablo
     CREATE TABLE url_cache (
       url TEXT PRIMARY KEY,
       raw_path TEXT NOT NULL,
       source_path TEXT,
       last_fetched_at TEXT NOT NULL,
       content_hash TEXT
     );
     ```
  2. **fetch-raw.ts başında kontrol:**
     - `SELECT * FROM url_cache WHERE url = ?`
     - **Hiç yoksa:** Normal fetch flow
     - **24h içinde fetch edilmişse:** "Bu URL 6 saat önce ingest edildi. Güncellemek ister misin?" → kullanıcıya sor
     - **24h geçmişse:** Sessizce tekrar fetch et, raw dosyayı güncelle (üzerine yaz)
     - **`--force` flag:** Cache'i yoksay, her durumda fetch et
  3. **Content hash karşılaştırma:** Tekrar fetch edildiğinde içerik değişmediyse (`content_hash` aynı) → "İçerik değişmemiş, güncelleme gerekmiyor" mesajı. Değiştiyse → raw güncelle + source güncelle + FTS5 re-index
- **Etkilenen dosyalar:** `scripts/fetch-raw.ts`, potansiyel migration (tablo/kolon ekleme)
- **Bağımlılık:** #18 (llms.txt fetch) ile birlikte yapılabilir — her ikisi de fetch-raw.ts'i değiştiriyor
- **Test:** Aynı URL 2x ingest → 2. seferde cache hit assertion, force flag ile bypass testi

### 26. Health Dashboard — Confidence + Stale + Orphan View (LLM Wikid İlhamlı)
- **Problem:** `npm run health` 16-point yapısal kontrol yapıyor ama knowledge kalitesine dair görünürlük yok. Hangi source'lar düşük kaliteli? Hangi raw dosyalar source'a promote edilmemiş? Hangi domain'ler stale?
- **İlham — LLM Wikid:** 4 view dashboard: Recent, Low confidence, Unexplored, Stale (>90 gün). Obsidian Bases ile görsel.
- **Mindlore Adaptasyonu — `/mindlore-health` çıktısına 4 yeni view:**
  1. **Stale Sources:** `quality` alanı `low` olan veya `date_captured` >90 gün olan source'lar
  2. **Orphan Raw:** `raw/` altında olup `sources/` karşılığı olmayan dosyalar (promote bekleyen)
  3. **Low Quality:** FTS5'te `quality = 'low'` veya `quality IS NULL` olan kayıtlar
  4. **Recently Active:** Son 7 günde eklenen/güncellenen kayıtlar (recall_count, last_recalled_at)
- **Çıktı formatı:** Tablo + sayısal özet: `Stale: 12 | Orphan: 23 | Low Quality: 8 | Recent: 15`
- **Etkilenen:** `scripts/mindlore-health-check.ts` — mevcut 16 kontrol + 4 yeni view
- **Efor:** Düşük — mevcut DB sorgularına 4 ek SELECT
- **Test:** Health check test'e dashboard view assertion'ları ekle

### 28. Mindlore Doctor CLI — Runtime Doğrulama (Context-Mode İlhamlı)
- **Problem:** `npm run health` 16 yapısal kontrol yapıyor (orphan frontmatter, missing slug, broken link) ama **runtime** kontrolleri yok: hook registration, skill registration, DB integrity, config validity, Node version uyumu.
- **İlham:** Context-Mode `ctx_doctor` — tek komutla runtime'ları, hook'ları, FTS5 durumunu, plugin registration'ı, npm ve marketplace versiyonlarını doğruluyor.
- **Çözüm:** `npx mindlore doctor` komutu:
  1. Hook'lar settings.json'da kayıtlı mı? (her hook dosyası için `grep`)
  2. Skill'ler `.claude/commands/` altında mı?
  3. Agent'lar `.claude/agents/` altında mı? (#8 ile birlikte)
  4. DB açılıyor mu? `PRAGMA integrity_check` (#2 ile birlikte)
  5. Config version uyumlu mu? (package.json vs config.json)
  6. Node version destekleniyor mu? (>=18)
  7. FTS5 tablo sayısı beklenen mi? (mindlore_fts + file_hashes + episodes + schema)
- **Çıktı formatı:** Checklist — `[✓] Hooks: 14/14 registered` / `[✗] Agent: mindlore-researcher missing`
- **Etkilenen dosyalar:** Yeni: `scripts/mindlore-doctor.ts`, `package.json` (bin + script)
- **Bağımlılık:** #8 (Init Tam Kurulum — auto-doctor son adım olarak çağırır)
- **Test:** Doctor test suite — eksik hook/skill/agent/corrupt DB senaryoları

### 29. Hook Timeout / Async Safety
- **Problem:** Hook'larda timeout mekanizması var mı? `mindlore-search.cjs` FTS5 sorgusu DB lock'a takılırsa, `mindlore-session-focus.cjs` integrity check uzarsa → session start/prompt donar. CC hook runner timeout uygulayabilir ama hook kendi içinde savunmasız.
- **Risk:** Windows'ta file lock, corrupt DB, büyük FTS5 tablosu (4000+ kayıt) → sorgu >5 saniye
- **Çözüm:**
  1. Tüm DB sorguları `AbortController` veya `setTimeout` wrapper ile sardır (max 3 saniye)
  2. Timeout aşılırsa graceful fallback: boş sonuç dön, hata logla, session'ı bloklamaz
  3. Telemetry'ye timeout event kaydı: hangi hook, ne kadar sürdü, neden timeout
- **Kontrol:** `grep -i timeout hooks/` ile mevcut durumu doğrula — varsa document et, yoksa ekle
- **Etkilenen:** Tüm hook dosyaları (`hooks/mindlore-*.cjs`)
- **Efor:** Düşük — wrapper fonksiyonu + her hook'ta 2-3 satır

### 30. Plugin Marketplace Publishing — CC Native Kurulum
- **Problem:** Şu an kurulum `npx mindlore` ile yapılıyor. CC'nin native plugin marketplace'i `/plugin marketplace add` komutuyla daha frictionless kurulum sunuyor. Context-mode bunu kullanıyor ve HN #1 oldu.
- **Çözüm:** `mindlore` paketini CC plugin marketplace'e publish et — organizasyon: `mindlore/mindlore`
  - Kurulum: `/plugin marketplace add mindlore/mindlore` — tek komut, hook+skill+agent+DB+config
  - `plugin.json` manifest zaten var, marketplace requirements'a uygunluk kontrol et
  - README'ye marketplace badge ekle
- **Gereksinimler:**
  - Marketplace publish workflow (CI/CD)
  - `plugin.json` v2 uyumluluğu (#10 ile ilişkili)
  - marketplace organizasyon kaydı: `mindlore`
- **Etkilenen:** `plugin.json`, CI/CD, README
- **Efor:** Orta — publish flow + marketplace hesap kurulumu

### 27. Daemon Deprecation — MCP Server'a Geçiş Planı
- **Mevcut durum:** TCP daemon (`scripts/mindlore-daemon.ts`) sadece embedding cold start fix için çalışıyor. Model (multilingual-e5-small, 134MB) bir kez yüklenip bellekte tutuluyor → sonraki çağrılar <100ms.
- **Ekosistem karşılaştırması (2026-04-26):** 8 rakip projeden hiçbiri daemon kullanmıyor:
  - Context-Mode, Lemma: MCP server (CC process yönetiyor)
  - GBrain: Embedded PGLite (server yok)
  - Hindsight: Cloud hosted
  - Agentic Stack, LLM Wikid: Script/CLI bazlı
- **Sorunlar:** Windows zombie process riski, kullanıcı `daemon start` hatırlamalı, session-end otomatik stop etmiyor, tek görev için overkill
- **Geçiş planı:**
  1. **v0.6.1:** Daemon'ı "deprecated" olarak işaretle. Mevcut haliyle çalışmaya devam etsin ama yeni özellik eklenmemeli.
  2. **v0.7 MCP Server (#7):** Embedding model MCP process'inin içinde yüklenir. CC MCP process'ini yönetir — daemon'ın yaptığı işi CC otomatik yapar. Periyodik görevler (consolidation, decay, triage) MCP tool olarak sunulur veya CC scheduled tasks ile yönetilir.
  3. **v0.7 sonrası:** Daemon kodu kaldırılır. `mindlore-daemon.ts`, `daemon.ts`, `daemon.test.ts`, `daemon-integration.test.ts` silinir.
- **Alternatif (daemon yerine session-end batch):** Periyodik görevleri daemon yerine `mindlore-session-end.cjs` hook'unda çalıştır. Session kapanırken birikmiş işleri yap (consolidation, decay). Daha basit, Windows uyumlu, zombie riski yok.
- **Etkilenen:** `scripts/mindlore-daemon.ts`, `scripts/lib/daemon.ts`, `tests/daemon*.test.ts`

### #31 — Session-Focus Performans Optimizasyonu

- **Problem:** `mindlore-session-focus` hook'u p50=3093ms, p95=4341ms. 134MB DB üzerinde her session başında integrity_check + cold require + 5+ SQL sorgusu çalıştırıyor. DB büyüdükçe daha da yavaşlayacak.
- **Hedef:** p50 < 500ms
- **Çözüm (3 adım):**
  1. `integrity_check` kaldır — sadece `doctor` CLI'da çalışsın, session start'ta gereksiz (~2s kazanç)
  2. `require('../dist/scripts/lib/session-payload.js')` → hook başında top-level require (cold start eliminasyonu, ~500ms kazanç)
  3. Diary readdirSync optimizasyonu — 116 delta dosyası sort yerine son mtime'a bak veya son delta path'i config'e cache'le
- **Ek:** `/mindlore-maintain consolidate` çalıştırılarak diary dosya sayısı azaltılmalı (116 → ~20)
- **Etkilenen:** `hooks/mindlore-session-focus.cjs`

---

## v0.6.3 — Search Engine Overhaul

FTS5 arama motorunu context-mode seviyesine çıkarma. Tüm maddeler arama kalitesi odaklı.

**v0.6.2'den taşınan maddeler:** #3 (RRF), #14/#23 (Session FTS5 + Chunking), #20 (Smart Snippet), #21 (TTL Cache), #22 (Throttling)

**v0.6.2 simplify/review'dan ertelenen maddeler:**
- S14: URL cache ETag/If-Modified-Since header check (advisor correction, bandwidth optimizasyonu)
- S15: Session summary integration test (syncSessions → DB episode E2E path)
- S16: Compaction test hook exercise (contract test → hook integration)
- S17: Session-end unpromoted DRY (CJS/TS boundary — common.cjs'e extract veya triage.ts dist import)
- S18: Snapshot readdir helper (listSnapshots/getLatestSnapshot → mindlore-common.cjs)
- S19: Pre-compact nesting extraction (collectRecentEpisodes + collectGitDiff + getActivePlan helpers)
- S20: isCorruptionError/recoverCorruptDb → mindlore-common.cjs (pre-compact ile tutarlılık)
- S21: DECISION_KEYWORDS test import (test'te hardcoded → kaynak modülden import)
- S22: Dead lastHash cache kaldır (process-per-invocation, her zaman null)
- S23: Session-payload 4 DB query → 1 birleştir (tek SQL + JS partition)
- S24: Raw accumulation check → worker process'e taşı (session-end hot path'ten çıkar)
- S25: Fetch-raw slug collision guard (aynı slug, farklı URL → false cache hit riski, URL-keyed lookup)
- S26: Session-focus + session-payload double diary scan eliminasyonu (tek readdirSync, sonucu paylaş)

**v0.6.1 simplify'dan eklenen maddeler (scope kararı: 2026-04-28):**
- S27: withTimeoutDb wire — export+test var ama production'da kullanılmıyor, hook'lara wire et
- S28: _writeTelemetry object param — 4 positional param → single object refactor
- S29: Doctor EXPECTED_HOOKS derive — hand-maintained array → plugin.json'dan oku
- S30: Init config merge nesting — 4 seviye iç içe if/for → generic `mergeDefaults` utility
- S31: registerAgents mtime+size guard — her init'te readFileSync yerine mtime+size check

**v0.7'ye taşınanlar:**
- sqlite-vec per-event load → v0.7 MCP Server'a bırakıldı (mimari kısıt, hook process isolation)
- Perf O(H*N) filter → v0.7'de MCP Server'a geçişte çözülecek (dataset büyüdüğünde anlamlı olur)

**Zaten planlanmış:**
- Session-focus 4-level nesting → S19'da (Pre-Compact Nesting Extraction)

### Release Bölme Tablosu (v0.6.3)

| Madde | Başlık | Efor | Bağımlılık |
|-------|--------|------|------------|
| S1 | Title Boost (BM25 weight) | 5 dk | — |
| S2 | Trigram FTS5 Tablo + RRF Fusion | Orta | S1 |
| S3 | Vocabulary Tablo + Fuzzy Fallback | Orta | S2 |
| S4 | Proximity Reranking (minimum-span) | Orta | S2 |
| S5 | Heading-Based Chunking | Büyük | S2 |
| S6 | Oversized Chunk Handling | Küçük | S5 |
| S7 | Heading Breadcrumb Title | Küçük | S5 |
| S8 | Atomik Source Re-Index | Küçük | — |
| S9 | FTS5 Segment Optimize | Küçük | — |
| S10 | Intent-Driven Filtering (>5KB) | Orta | S5 |
| S11 | Smart Snippet (#20'den taşındı) | Küçük | S2 |
| S12 | TTL Cache (#21'den taşındı) | Küçük | — |
| S13 | Progressive Throttling (#22'den taşındı) | Küçük | S12 |
| S14 | URL Cache ETag/If-Modified-Since | Küçük | — |
| S15 | Session Summary Integration Test | Küçük | — |
| S16 | Compaction Test Hook Exercise | Küçük | — |
| S17 | Session-End Unpromoted DRY | Küçük | — |
| S18 | Snapshot Readdir Helper | Küçük | — |
| S19 | Pre-Compact Nesting Extraction | Orta | — |
| S20 | Corruption Recovery to Common | Küçük | — |
| S21 | DECISION_KEYWORDS Test Import | Küçük | — |
| S22 | Dead lastHash Cache Kaldır | Küçük | — |
| S23 | Session-Payload Query Birleştir | Küçük | — |
| S24 | Raw Accumulation → Worker | Küçük | — |
| S25 | Fetch-Raw Slug Collision Guard | Küçük | — |
| S26 | Session-Focus Double Diary Scan | Küçük | — |
| S27 | withTimeoutDb Wire | Küçük | — |
| S28 | _writeTelemetry Object Param | Küçük | ✅ DONE (v0.6.2) |
| S29 | Doctor EXPECTED_HOOKS Derive | Küçük | ✅ DONE (v0.6.2) |
| S30 | Init Config Merge Nesting | Küçük | — |
| S31 | registerAgents mtime Guard | Küçük | — |

### S1. Title Boost — BM25 Weight Parametreleri
- **Problem:** Tüm FTS5 kolonları eşit ağırlıkta. Başlık eşleşmesi body eşleşmesinden ayırt edilemiyor.
- **Context-Mode referans:** `bm25(chunks, 5.0, 1.0)` — title 5x, content 1x.
- **Çözüm:** Search sorgularında `bm25(mindlore_fts, 1, 1, 1, 1, 5.0, 1, 1)` kullan. Kolon sırası: path(skip), slug(1), description(1), type(skip), category(1), **title(5.0)**, content(1), tags(1).
- **Etkilenen:** `hooks/mindlore-search.cjs`, `scripts/mindlore-fts5-search.ts`
- **Test:** Title match'in body-only match'ten yüksek sıralandığını doğrula.
- **Efor:** 5 dakika — tek satır SQL değişikliği.

### S2. Trigram FTS5 Tablo + RRF Fusion
- **Problem:** Porter tokenizer sadece exact stem match yapıyor. Typo, partial match, substring arama çalışmıyor. Tek FTS5 sorgusu = tek strateji.
- **Context-Mode referans:** İki paralel FTS5 tablo — `chunks` (porter+unicode61) ve `chunks_trigram` (trigram tokenizer). Her sorgu ikisine de atılır, sonuçlar RRF ile birleştirilir.
- **Çözüm:**
  1. **Yeni tablo:** `CREATE VIRTUAL TABLE mindlore_fts_trigram USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='trigram')` — mevcut `mindlore_fts` ile aynı kolon yapısı.
  2. **Index pipeline:** `insertFtsRow()` hem `mindlore_fts` hem `mindlore_fts_trigram`'a yazacak. Migration ile mevcut veriler trigram tablosuna kopyalanacak.
  3. **RRF Fusion:** Her sorgu iki tabloya ayrı ayrı atılır. Sonuçlar `score = 1/(K + rank_porter) + 1/(K + rank_trigram)` ile birleştirilir (K=60, Cormack et al. 2009). Aynı doküman iki tabloda da çıkarsa skorlar toplanır.
  4. **Search hook:** `mindlore-search.cjs`'de `searchDb()` fonksiyonu iki sorgu atar, RRF ile merge eder, top 3 döner.
- **Etkilenen:** `hooks/lib/mindlore-common.cjs` (tablo oluşturma + insert), `hooks/mindlore-search.cjs` (RRF merge), `scripts/mindlore-fts5-index.ts` (dual insert), migration dosyası
- **Test:** "contxt" araması → "context" sonucu bulması (trigram), "context" araması → porter+trigram RRF skoru > tek porter skoru.
- **Efor:** Orta — migration + search rewrite + test.

### S3. Vocabulary Tablo + Fuzzy Fallback
- **Problem:** Sorgu 0 sonuç döndürdüğünde kullanıcıya yardım yok. Typo mu yaptı, yanlış kelime mi kullandı bilinmiyor.
- **Context-Mode referans:** `vocabulary(word UNIQUE)` tablosu — her indexlenen kelime kaydedilir. 0 sonuçta Levenshtein distance ile en yakın kelimeler bulunur, sorgu düzeltilip tekrar çalıştırılır. Edit distance: kelime ≤4 char → max 1, ≤7 char → max 2, >7 char → max 3. 256-entry LRU cache ile tekrarlayan fuzzy sorguları O(1).
- **Çözüm:**
  1. **Vocabulary tablo:** `CREATE TABLE vocabulary (word TEXT UNIQUE)` — her FTS5 insert'inde content'teki unique kelimeler bu tabloya eklenir (INSERT OR IGNORE).
  2. **Fuzzy correction:** 0 sonuç döndüğünde → sorgu kelimelerini vocabulary tablosuna karşı Levenshtein distance ile kontrol et. En yakın eşleşmeleri bul, düzeltilmiş sorguyu tekrar RRF pipeline'dan geçir.
  3. **Levenshtein implementasyonu:** SQLite'ta native Levenshtein yok. İki seçenek: (a) JS tarafında hesapla — vocabulary tablosundan tüm kelimeleri çek, JS'te distance hesapla. (b) SQLite extension — `spellfix1` veya custom function. Seçenek (a) daha taşınabilir (Windows uyumlu, native extension gerektirmez). Vocabulary <50K kelime için JS tarafı <50ms.
  4. **LRU Cache:** Son 256 fuzzy sorgu sonucunu SQLite tablosunda veya in-memory (hook process başına) cache'le. Aynı typo tekrar geldiğinde DB'ye gitmeden düzeltilmiş sorguyu döndür. Hook'lar ayrı process olduğu için SQLite tablo cache daha güvenilir: `CREATE TABLE fuzzy_cache (query_hash TEXT PRIMARY KEY, corrected TEXT, created_at INTEGER)`.
- **Etkilenen:** `hooks/lib/mindlore-common.cjs` (vocabulary insert), `hooks/mindlore-search.cjs` (fuzzy fallback), yeni: `scripts/lib/levenshtein.ts`
- **Test:** "kuberntes" araması → "kubernetes" düzeltmesi, "mindlroe" → "mindlore".
- **Efor:** Orta — vocabulary population + levenshtein + cache.

### S4. Proximity Reranking (Minimum-Span Sweep)
- **Problem:** Çok kelimeli sorgularda kelimeler aynı dokümanda ama uzak yerlerde geçebilir. "TCP localhost karar" sorgusunda üç kelimenin yan yana olduğu doküman, ayrı paragraflarda geçen dokümandan daha relevant ama BM25 bunu ayırt edemiyor.
- **Context-Mode referans:** RRF sonrası proximity reranking — her sonuç chunk'ında sorgu terimlerinin pozisyonları taranır, minimum-span sweep ile en kısa pencere bulunur. Kısa pencere = yüksek boost. Title-match bonus: code chunk'ta 0.6, prose chunk'ta 0.3.
- **Çözüm:**
  1. **Term position extraction:** RRF sonrası top-N sonuçlar için, her sonucun content'inde sorgu terimlerinin karakter pozisyonlarını bul (basit `indexOf` loop).
  2. **Minimum-span sweep:** Tüm terimleri kapsayan en kısa metin penceresi hesapla (sliding window algorithm). Span ne kadar kısaysa proximity skoru o kadar yüksek.
  3. **Score adjustment:** `final_score = rrf_score + proximity_boost`. Proximity boost = `1 / (1 + min_span / 100)`. Tüm terimler 50 karakter içindeyse boost ~0.67, 500 karakter içindeyse ~0.17.
  4. **Title-match bonus:** Sorgu terimi title/heading alanında geçiyorsa ek boost (0.3 prose, 0.6 code — content_type'a göre).
- **Etkilenen:** `hooks/mindlore-search.cjs` (RRF sonrası reranking adımı)
- **Test:** "TCP localhost" araması → kelimelerin yan yana geçtiği doküman üste çıkmalı.
- **Efor:** Orta — algoritma basit ama mevcut pipeline'a entegrasyonu dikkat istiyor.

### S5. Heading-Based Chunking
- **Problem:** Her .md dosya FTS5'te tek row olarak indexleniyor. 770 satırlık session transcript'te arama yapınca tüm dosya match oluyor — hangi bölümün relevant olduğu belli değil. BM25 precision düşük çünkü IDF büyük dokümanlar arasında yayılıyor.
- **Context-Mode referans:** Markdown `##`-`####` heading'lerinden böl, code block'ları parçalama (backtick fence içindeyse heading olarak sayma). Her chunk ayrı FTS5 kaydı. Chunk title = heading breadcrumb stack ("H1 > H2 > H3").
- **Çözüm:**
  1. **Chunker modülü:** `scripts/lib/chunker.ts` — markdown input alır, heading seviyelerine göre chunk array döndürür.
  2. **Kurallar:**
     - H1-H4 heading'ler chunk sınırı (`# `, `## `, `### `, `#### `)
     - Code fence (`` ``` ``) içindeki heading'ler yok sayılır
     - Her chunk: `{ title: string, content: string, level: number }`
     - Heading olmayan dosyalar → tek chunk (mevcut davranış korunur)
  3. **FTS5 entegrasyonu:** `insertFtsRow()` yerine `insertFtsChunks()` — tek dosya birden fazla FTS5 kaydı üretir. Her kayıtta `chunk_id` (dosya_path + chunk_index), `heading` (chunk title).
  4. **Mevcut tablo uyumu:** `mindlore_fts` tablosuna `chunk_id TEXT` ve `heading TEXT` kolonu ekle (migration). Veya yeni tablo: `mindlore_fts_chunks`. Karar: mevcut tabloyu genişletmek daha basit — geriye uyumlu, chunk'sız kayıtlar `chunk_id = path` olarak kalır.
  5. **Session transcript chunking:** `## User` / `## Assistant` heading'leri doğal chunk sınırı.
  6. **Knowledge dosyaları:** `sources/*.md`, `domains/*.md`, `analyses/*.md` heading'lerden chunk'lanır.
  7. **Raw dosyalar:** `raw/*.md` heading varsa chunk'la, yoksa tek chunk.
- **Migration:** Mevcut tüm FTS5 kayıtları re-chunk edilmeli (tek seferlik batch). `npm run index -- --rechunk` flag.
- **Performans bütçesi:** 4000+ dosya × ortalama 8 chunk = ~32K FTS5 kaydı. SQLite FTS5 bu hacmi rahat kaldırır.
- **Etkilenen:** Yeni: `scripts/lib/chunker.ts`. Değişen: `hooks/lib/mindlore-common.cjs`, `scripts/mindlore-fts5-index.ts`, migration dosyası.
- **Test:** 3 heading'li dosya → 3 chunk, code fence içinde heading → chunk sınırı değil, heading'siz dosya → tek chunk.
- **Efor:** Büyük — yeni modül + migration + tüm insert pipeline değişir.

### S6. Oversized Chunk Handling
- **Problem:** Heading-based chunking sonrası bazı chunk'lar çok büyük olabilir — 100+ satırlık heading'siz metin bloğu, tek heading altında uzun içerik.
- **Context-Mode referans:** >4096 byte chunk'lar paragraph boundary'den (çift newline `\n\n`) bölünür. Bölünen chunk'lar aynı heading title'ı paylaşır + " (cont.)" suffix.
- **Çözüm:**
  1. `chunker.ts`'de chunk üretildikten sonra boyut kontrolü: `if (chunk.content.length > 4096)`
  2. Büyük chunk'ları `\n\n` (paragraph) sınırlarından böl.
  3. Bölünen parçalar: aynı title + ` (part 2)`, `(part 3)` suffix.
  4. Paragraph sınırı yoksa (tek uzun paragraf) → 4096 byte'ta kelime sınırından kes.
  5. Minimum chunk boyutu: 256 byte — bundan küçük parçalar bir öncekiyle birleştirilir.
- **Etkilenen:** `scripts/lib/chunker.ts`
- **Test:** 10000 byte chunk → 3 parçaya bölünmeli, her biri ≤4096 byte.
- **Efor:** Küçük — chunker'a 20-30 satır ek.
- **Bağımlılık:** S5 (chunking altyapısı)

### S7. Heading Breadcrumb Title
- **Problem:** Chunk title olarak sadece en yakın heading kullanılırsa bağlam kayboluyor. `### Çözüm` başlığı 50 farklı dosyada olabilir — hangi bölümün altında olduğu belli değil.
- **Context-Mode referans:** Chunk title = heading breadcrumb stack: `"Source: auto-harness > Özet > Döngü"`. Üst heading'ler korunur, arama sonucunda chunk'ın bağlamı anlaşılır. Title alanı 5x boost aldığı için breadcrumb'daki üst heading kelimeleri de arama skoruna katkı yapar.
- **Çözüm:**
  1. Chunker heading stack tutar: H1 gördüğünde stack reset, H2 gördüğünde H1'in altına ekle, H3 gördüğünde H1>H2'nin altına ekle.
  2. Chunk title = stack join " > ": `"v0.6.3 Search Engine > S2 Trigram Tablo > Çözüm"`.
  3. FTS5 `heading` kolonuna bu breadcrumb yazılır.
  4. Arama sonuçlarında breadcrumb gösterilir → kullanıcı chunk'ın bağlamını anlar.
- **Etkilenen:** `scripts/lib/chunker.ts`
- **Test:** H1>H2>H3 dosyada H3 chunk'ının title'ı "H1 > H2 > H3" olmalı.
- **Efor:** Küçük — chunker'a heading stack logic.
- **Bağımlılık:** S5

### S8. Atomik Source Re-Index + mtime Gate
- **Problem:** Bir dosya güncellendiğinde mevcut FTS5 kaydı silinip yenisi ekleniyor — ama bu iki ayrı SQL statement. Arada crash olursa orphan kayıt kalır veya kayıp oluşur. Chunking ile bu risk çarpanlanır — tek dosya 8 chunk demek, 8 DELETE + 8 INSERT. Ayrıca full re-index sırasında 4000+ dosyanın hepsi SHA256 hesaplanıyor — mtime kontrolü yok.
- **Context-Mode referans:** (1) Aynı `label` ile re-index edildiğinde → tek transaction içinde DELETE + INSERT. Atomik — ya hepsi ya hiçbiri. (2) Stale detection: önce `mtime` kontrol (hızlı, I/O yok) → mtime yeniyse SHA256 confirm (yavaş, dosya okuma) → hash farklıysa re-index. İki aşamalı gate gereksiz hash hesaplamayı elimine ediyor.
- **Çözüm:**
  1. **mtime gate:** Re-index öncesi dosyanın `stat.mtimeMs` değerini `file_hashes.last_indexed_at` ile karşılaştır. mtime eskiyse → skip (dosya okuma + hash hesaplama yapılmaz). mtime yeniyse → SHA256 hesapla → hash aynıysa skip, farklıysa re-index. `file_hashes` tablosuna `last_indexed_at INTEGER` kolonu ekle (migration).
     ```typescript
     const stat = fs.statSync(filePath);
     const row = db.prepare('SELECT content_hash, last_indexed_at FROM file_hashes WHERE path = ?').get(filePath);
     if (row && stat.mtimeMs <= row.last_indexed_at) return; // mtime gate — skip
     const hash = sha256(fs.readFileSync(filePath, 'utf8'));
     if (row && hash === row.content_hash) return; // SHA256 confirm — skip
     // proceed to re-index
     ```
  2. **Atomik transaction:** `insertFtsRow()` / `insertFtsChunks()` fonksiyonlarını transaction wrapper ile sar:
     ```typescript
     db.transaction(() => {
       db.prepare(`DELETE FROM mindlore_fts WHERE path = ?`).run(filePath);
       db.prepare(`DELETE FROM mindlore_fts_trigram WHERE path = ?`).run(filePath);
       for (const chunk of chunks) {
         insertChunk(db, 'mindlore_fts', chunk);
         insertChunk(db, 'mindlore_fts_trigram', chunk);
       }
       db.prepare('UPDATE file_hashes SET content_hash = ?, last_indexed_at = ? WHERE path = ?')
         .run(hash, Date.now(), filePath);
     })();
     ```
  3. `FileChanged` hook'taki incremental update de aynı transaction pattern kullanmalı.
- **Etkilenen:** `hooks/lib/mindlore-common.cjs`, `hooks/mindlore-fts5-sync.cjs`, migration (last_indexed_at kolonu)
- **Test:** Re-index sırasında simüle edilmiş crash → orphan kayıt olmamalı. Değişmemiş dosya → mtime gate ile skip edilmeli.
- **Efor:** Küçük — transaction wrapper + mtime gate (toplam ~15 satır).

### S9. FTS5 Segment Optimize
- **Problem:** FTS5 her INSERT'te yeni b-tree segment oluşturur. Çok sayıda küçük segment = yavaş sorgu. Full re-index sonrası binlerce segment birikir.
- **Context-Mode referans:** Her 50 INSERT'te `INSERT INTO chunks(chunks) VALUES('optimize')` çağırarak segment'ları merge eder. Bu SQLite FTS5'in dahili optimize komutu — küçük segment'ları birleştirir, sorgu performansını artırır.
- **Çözüm:**
  1. Index pipeline'a sayaç ekle: her 50 `insertFtsRow`/`insertFtsChunks` çağrısında bir kez optimize çalıştır.
  2. Full re-index sonunda son bir optimize çağrısı.
  3. Her iki tablo için: `mindlore_fts` ve `mindlore_fts_trigram`.
  ```typescript
  let insertCount = 0;
  function insertAndOptimize(db, table, data) {
    insertRow(db, table, data);
    insertCount++;
    if (insertCount % 50 === 0) {
      db.prepare(`INSERT INTO ${table}(${table}) VALUES('optimize')`).run();
    }
  }
  ```
- **Etkilenen:** `scripts/mindlore-fts5-index.ts`, `hooks/lib/mindlore-common.cjs`
- **Test:** 100 insert sonrası optimize çağrıldığını doğrula (spy/mock).
- **Efor:** Küçük — 10-15 satır.

### S10. Intent-Driven Filtering (>5KB Sonuç)
- **Problem:** Arama sonucu çok büyük olduğunda (uzun chunk, çok sayıda match) tamamını context'e inject etmek token israfı. Kullanıcının intent'ine göre sadece relevant kısımlar döndürülmeli.
- **Context-Mode referans:** Output >5KB ise tamamını FTS5'e index'le, BM25 ile sadece intent'e uyan chunk'ları döndür. "Searchable terms" vocabulary ile follow-up search kolaylaşır. İki katmanlı: (1) ilk sorgu → chunk'lar, (2) intent filtresi → en relevant chunk'lar.
- **Çözüm:**
  1. Search hook sonuçlarının toplam boyutunu hesapla.
  2. **≤5KB:** Mevcut davranış — tüm snippet'ları inject et.
  3. **>5KB:** Sonuçları intent ile filtrele:
     - Kullanıcı mesajından intent keyword'leri çıkar (mevcut `extractKeywords` fonksiyonu)
     - Her chunk'ı intent keyword'lerine karşı BM25 ile skora — en yüksek skorlu chunk'ları seç
     - Max inject bütçesi: 3KB (mevcut 6KB limitinden düşür)
  4. **Searchable terms hint:** Sonuç >5KB olduğunda inject edilen metnin sonuna `[Daha fazla: "keyword1", "keyword2", "keyword3"]` ekle — kullanıcı/agent follow-up arama yapabilsin.
  5. **Mevcut >10KB offload ile uyum:** Halihazırda >10KB sonuçlar `tmp/` dosyasına offload ediliyor. S10 bu threshold'u düşürür (5KB) ve offload yerine akıllı filtreleme yapar.
- **Etkilenen:** `hooks/mindlore-search.cjs`
- **Test:** 8KB toplam sonuç → 3KB'ye filtrelenmeli, searchable terms hint eklenmeli.
- **Efor:** Orta — intent extraction + budget filtering.
- **Bağımlılık:** S5 (chunking olursa daha hassas filtreleme mümkün)

### S11. Smart Snippet (v0.6.2 #20'den taşındı)
- **Problem:** Search hook tüm description alanını inject ediyor. Uzun description'lı kayıtlarda context kirleniyor.
- **Çözüm:** FTS5 `snippet()` fonksiyonu ile eşleşen terimlerin etrafından ±30 token pencere döndür. Description 300 karakteri aşarsa snippet'e düşür.
- **Detay:** v0.6.2 #20'deki spec aynen geçerli.
- **Etkilenen:** `hooks/mindlore-search.cjs`
- **Efor:** Küçük.

### S12. TTL Cache (v0.6.2 #21'den taşındı)
- **Problem:** Her promptta fresh FTS5 sorgusu. Aynı session'da aynı/benzer kelimeler tekrar geldiğinde gereksiz DB hit.
- **Çözüm:** SQLite sorgu cache tablosu (5 dk TTL) + FileChanged invalidation. 14 gün stale cleanup.
- **Detay:** v0.6.2 #21'deki spec aynen geçerli.
- **Etkilenen:** `hooks/mindlore-search.cjs`, migration
- **Efor:** Küçük.

### S13. Progressive Throttling (v0.6.2 #22'den taşındı)
- **Problem:** 50+ prompt = 50+ FTS5 sorgusu, çoğu aynı sonuçları tekrar inject ediyor.
- **Çözüm:** Session başına çağrı sayacı. 1-10: normal (3 sonuç), 11-20: azaltılmış (1 sonuç), 20+: sadece yeni kelime varsa çalış.
- **Detay:** v0.6.2 #22'deki spec aynen geçerli.
- **Etkilenen:** `hooks/mindlore-search.cjs`
- **Bağımlılık:** S12 (TTL Cache)
- **Efor:** Küçük.

### S27. withTimeoutDb Wire (v0.6.1 simplify'dan)
- **Problem:** `withTimeoutDb` export + test var ama production hook'larda kullanılmıyor.
- **Çözüm:** Uzun sürebilecek DB operasyonlarında (search, session-payload) `withTimeoutDb` wrapper'ı ile sarmalama.
- **Etkilenen:** `hooks/mindlore-search.cjs`, `hooks/mindlore-session-focus.cjs`
- **Efor:** Küçük.

### S28. _writeTelemetry Object Param (v0.6.1 simplify'dan)
- **Problem:** `_writeTelemetry(hookName, event, durationMs, extra)` — 4 positional param, sıra karışabilir.
- **Çözüm:** Single object param: `_writeTelemetry({ hook, event, durationMs, extra })`.
- **Etkilenen:** `hooks/lib/mindlore-common.cjs` + tüm çağrı noktaları
- **Efor:** Küçük.

### S29. Doctor EXPECTED_HOOKS Derive (v0.6.1 simplify'dan)
- **Problem:** `mindlore-doctor.ts`'de EXPECTED_HOOKS array'i elle tutulmuş. Yeni hook ekleyince güncellemeyi unutma riski.
- **Çözüm:** `plugin.json`'daki hook tanımlarından runtime'da derive et.
- **Etkilenen:** `scripts/mindlore-doctor.ts`
- **Efor:** Küçük.

### S30. Init Config Merge Nesting (v0.6.1 simplify'dan)
- **Problem:** `init.ts`'de config merge 4 seviye iç içe if/for.
- **Çözüm:** Generic `mergeDefaults(target, source)` utility fonksiyonu — `scripts/lib/` altına.
- **Etkilenen:** `scripts/init.ts`
- **Efor:** Küçük.

### S31. registerAgents mtime Guard (v0.6.1 simplify'dan)
- **Problem:** Her `init` çalışmasında agent dosyalarını readFileSync ile okuyup content compare yapıyor. Init nadir çalışır ama gereksiz IO.
- **Çözüm:** mtime + size guard — dosya değişmemişse content compare atla.
- **Etkilenen:** `scripts/init.ts`
- **Efor:** Küçük.

---

## v0.7 — Capability Expansion

Kapsamı geniş, spec/brainstorm gerektiren özellikler.

**v0.6.3'ten taşınan simplify bulguları (MCP Server geçişinde çözülecek):**
- sqlite-vec per-event load — `loadSqliteVecCjs(db)` her prompt'ta extension yüklüyor. MCP Server'da tek process = module cache çalışır
- Perf O(H*N) filter — `calculatePercentiles` her hook için full array filter. MCP Server'da dataset büyüyünce anlamlı olacak

### 7. MCP Server — Cross-Host Memory Layer
- **Ne:** Mindlore'u MCP protocol üzerinden Claude Code + Cursor + Codex + Cline + Windsurf + Claude Desktop'a açmak
- **Neden kritik:** Bugün Mindlore tek kullanıcının CC session'larına kilitli. MCP ile herhangi bir MCP-compatible host kullanan herkes aynı memory layer'ı kullanır. Context-mode 14 platform destekliyor ve HN #1 oldu — cross-platform demand kanıtlanmış.
- **Tool'lar (mevcut script'lere 1:1 mapping):**
  - `mindlore_search` → `mindlore-fts5-search.js` (FTS5 + hybrid arama)
  - `mindlore_ingest` → `fetch-raw.js` + source pipeline (URL/text/file)
  - `mindlore_recall` → `session-payload.ts` (karar/episode/learning çekme)
  - `mindlore_brief` → compounding pipeline (proje brifing)
  - `mindlore_decide` → decision flow (karar kaydet/listele)
  - `mindlore_stats` → health-check + DB istatistikleri
- **Context-Mode referans (`server.ts`):**
  - `@modelcontextprotocol/sdk` kullanıyor (`McpServer` + `StdioServerTransport`)
  - Her tool `server.registerTool(name, schema, handler)` ile kayıtlı
  - Zod schema validation → type-safe input
  - `trackResponse()` ile context savings metrikleri
  - Security: `evaluateCommand()` → deny > ask > allow chain, chained command splitting
  - Lifecycle guard: parent process death detection, orphan prevention
- **Zorluk:** Auth (local-only bind), rate limit, protocol versioning
- **Moat:** Context-mode window'u optimize eder, Mindlore knowledge'ı persist eder — farklı katman, overlap yok, side-by-side install
- **Ön koşul:** Brainstorm session (tool signature tasarımı, adapter pattern)
- **Ek — Hook Routing Enforcement (Context-Mode İlhamlı):**
  - **Problem:** 14 hook var, SessionStart'ta INDEX + delta inject ediliyor. Ama hangi tool'un hangi Mindlore aracına yönlendirilmesi gerektiğine dair routing talimatı yok. Agent bazen FTS5 yerine dosya okuma, search hook yerine manuel grep yapıyor.
  - **Context-Mode'da:** SessionStart hook'u routing instructions inject ediyor ("Read yerine ctx_execute_file kullan", "Bash yerine ctx_batch_execute kullan"). PreToolUse hook'ları yanlış tool seçimini yakalayıp yönlendiriyor.
  - **Çözüm:** v0.7 MCP Server'da tool routing doğal olarak çözülür (MCP tool = doğru endpoint). v0.6.x'te geçici çözüm: SessionStart hook'una routing talimatları ekle ("Knowledge araması için search hook var, dosya okuma yerine FTS5 kullan"). PreToolUse hook'a "yanlış yol" uyarısı.

### 8. Knowledge Graph — Entity Traversal
- **Ne:** Sources arası ilişkileri graph olarak sunma (entity → entity)
- **Gerekli:** Entity/concept ayrımı şu an var, ama edge tablosu yok
- **Yeni tablo:** `relations (from_slug, to_slug, type, strength, source)`
- **Ek referans — Lemma `memory_relate`:** Topic overlap detect edildiğinde otomatik `memory_relate` çağrılıyor → fragment'lar arası bidirectional association. Kullanıldıkça güçleniyor. Mindlore adaptasyonu: ingest sırasında yeni source ile mevcut source'lar arasında topic overlap kontrolü → `relations` tablosuna otomatik edge ekleme.
- **Ek referans — GBrain graph search:** Typed-link extraction + graph traversal ile P@5 49.1% (graph'sız hybrid'den +31.4 puan). Entity → entity edge'leri search precision'ı dramatik artırıyor.
- **Session Entity Extraction (v1.0 ön çalışması):** KG kurulduktan sonra session transcript'lerinden entity çıkarma düşünülebilir — isimler, kararlar, tool adları. Ham transcript embedding yerine extract edilen structured bilgi embed edilir. Detay: v1.0 #18.
- **Ön koşul:** Veri modeli brainstorm

### 9. Model Upgrade Değerlendirmesi
- **Ne:** `multilingual-e5-small` (384d, ~134MB) → benchmark-driven upgrade
- **Adaylar:**
  - `multilingual-e5-base` (768d, ~1.1GB) — daha yüksek boyut, retrieval optimized
  - `paraphrase-multilingual-MiniLM-L12-v2` (384d, ~470MB, 50+ dil) — Lemma repo'su bu modeli kullanıyor (opsiyonel bağımlılık, ilk kullanımda lazy download). Sentence similarity/paraphrase detection'da güçlü. Aynı 384d ama 3.5x büyük dosya.
- **Mevcut seçim (e5-small) neden doğru:** Mindlore use case = retrieval (query→document), e5-small bunun için optimize. MiniLM paraphrase detection'da iyi ama retrieval'da fark belirsiz.
- **Context-Mode notu:** Embedding modeli kullanmıyor — pure FTS5 + BM25 (keyword-based). Semantic search yok.
- **Gerekli:** Corpus üzerinde A/B test, recall@k ölçümü
- **Karar:** v0.7'de measurement, v0.8'de implement (eğer kazanç varsa)
- **Dependency Stratejisi — Lazy Download (Lemma Pattern):**
  - **Problem:** `@huggingface/transformers` şu an devDependencies'de, 946 MB. v0.7'de embedding aktif olunca dependencies'e taşınırsa her kullanıcı 946 MB indirecek.
  - **Çözüm:** Model dosyası npm paketine dahil edilmez. `@huggingface/transformers` optionalDependencies'e taşınır. İlk embedding çağrısında model (~134 MB) otomatik indirilir ve `~/.mindlore/models/` altına cache'lenir. Sonraki çağrılar cache'den okur (<100ms).
  - **Graceful degradation:** HuggingFace kurulu değilse veya model indirilemezse sistem FTS5-only modda çalışır. Semantic search devre dışı kalır, keyword search çalışmaya devam eder.
  - **Kullanıcı deneyimi:** `npx mindlore` hafif kalır (~16 MB). Embedding isteyen kullanıcı ilk seferde tek seferlik ~134 MB model indirir. İstemeyenler hiç indirmez.
  - **Referans:** Lemma repo'su aynı pattern'i kullanıyor (opsiyonel bağımlılık, ilk kullanımda lazy download).

### 10. Plugin Manifest v2
- **Ne:** Kullanıcıların kendi skill/hook'larını eklemesi için manifest schema
- **Mevcut:** `plugin.json` v1
- **Gerekli:** Versioning, validation, conflict resolution

### 11. Daemon → MCP Geçişi (Deprecated)
- **Mevcut:** v0.5.5 TCP daemon — sadece embedding cold start fix (16s → <100ms)
- **Ekosistem bulgusu (2026-04-26):** 8 rakip projeden hiçbiri daemon kullanmıyor. Hepsi MCP server veya embedded DB.
- **Karar:** Daemon v0.6.1'de deprecated, v0.7 MCP Server (#7) ile replace edilecek. Detay: v0.6.1 #27.
- **Ek — Dream Cycle kapsamı (GBrain İlhamlı):** MCP server'a taşındığında periyodik görevler de eklenebilir: consolidation, decay hesaplama, stale triage, entity zenginleştirme. GBrain'de "dream cycle" — agent gece çalışıp entity'leri zenginleştiriyor, citation'ları düzeltiyor, memory consolidate ediyor. MCP tool olarak: `mindlore_maintain({ task: "dream" })`.
- **Risk:** Process management karmaşası (özellikle Windows)

### 14. Episodic → Lesson Graduation Pipeline (Agentic Stack + GBrain İlhamlı)
- **Problem:** `/mindlore-reflect` skill episodic → pattern çıkarıyor ama tamamen manuel. Otomatik clustering yok. Graduate/reject mekanizması nominal — nomination status tracking var ama otomatik tetikleme yok.
- **İlham — Agentic Stack:** 7 adımlı pipeline:
  1. Skill'ler her aksiyonu episodic memory'ye logluyor
  2. `auto_dream.py` tekrarlayan pattern'leri cluster'lıyor
  3. Host agent `graduate.py` / `reject.py` ile review ediyor
  4. Graduate edilen lesson'lar `lessons.jsonl`'e ekleniyor → `LESSONS.md` re-render
  5. Gelecek session'lar query-relevant accepted lesson'ları otomatik yüklüyor
  6. `on_failure` 14 günde 3+ kez başarısız olan skill'leri rewrite'a işaretliyor
  7. `git log .agent/memory/` agent'ın otobiyografisi oluyor
- **İlham — GBrain:** Dream cycle — gece boyunca tüm konuşmaları tarayıp entity zenginleştirme, kırık citation düzeltme, memory consolidation. "I wake up and the brain is smarter."
- **Mindlore mevcut durum:** Episodes tablosu (120 kayıt) + `/mindlore-reflect` (manuel) + nomination pipeline (yarı otomatik)
- **Çözüm:**
  1. **Otomatik reflect tetikleme:** N episode (ör. 20) biriktikten sonra session-end hook'unda otomatik pattern extraction. Manuel reflect'e ek, otomatik.
  2. **Graduate/reject tracking:** Nomination'lara `graduated_at` / `rejected_at` + `rejection_reason` ekle. Rejected nomination'lar tekrar önerilmez.
  3. **Lesson auto-load:** Session start'ta aktif projeye ait graduated lesson'ları inject et (mevcut episode injection'a benzer).
  4. **Skill failure tracking:** Hook/skill başarısızlık sayacı → 3+ failure → "bu skill review gerekiyor" uyarısı
- **Etkilenen:** `hooks/mindlore-session-end.cjs`, `scripts/lib/session-payload.ts`, `skills/mindlore-reflect/SKILL.md`, episodes tablosu migration

### 15. Source-Type Aware Extraction (LLM Wikid İlhamlı)
- **Problem:** `/mindlore-ingest` tüm source'lara aynı extraction uyguluyor — genel özet + tags. GitHub repo README'si ile akademik paper aynı template ile özetleniyor. Bilgi kaybı oluyor.
- **İlham — LLM Wikid 4-phase pipeline:**
  - Transcript → speaker attribution + action items
  - Paper → method + findings + limitations
  - Article → core thesis + supporting arguments
  - Tweet → claim + evidence + thread context
  - Report → key metrics + conclusions + recommendations
- **Mindlore mevcut durum:** `source_type` otomatik detect ediliyor (github-repo, article, docs) ama extraction farkı yok.
- **Çözüm:**
  1. Source type'a göre extraction template: `templates/extraction/{source_type}.md`
  2. Ingest skill type detect ettikten sonra ilgili template'i yükler
  3. Minimum 4 template: `github-repo` (mimari + kurulum + API), `article` (tez + argümanlar), `docs` (API referans + örnekler), `default` (mevcut genel template)
- **Etkilenen:** `skills/mindlore-ingest/SKILL.md`, yeni: `templates/extraction/` dizini

### 17. Output Compression / Terse Mode (Context-Mode İlhamlı)
- **Problem:** Hook inject'leri (search sonuçları, episode injection, delta) toplamda 500-1000+ token harcıyor. Her promptta tekrarlanan bilgi context'i gereksiz dolduruyor.
- **İlham:** Context-Mode ~65-75% output token reduction — article, filler, pleasantry düşürülüyor. Teknik doğruluk korunuyor.
- **Çözüm (3 katmanlı):**
  1. **Search hook terse:** #20 (Smart Snippet) description yerine snippet döndürüyor — zaten kısmi çözüm. Ek olarak: max inject token bütçesi (ör. 300 token/prompt), aşılırsa en düşük BM25 skorlu sonuç düşürülür.
  2. **Episode injection terse:** Tekrarlanan episode'ları (stale, aynı session'da zaten inject edilmiş) filtrele. Mevcut: her promptta aynı episode tekrar ediliyor (#12 ile ilişkili).
  3. **Delta injection terse:** Session focus hook'unda delta zaten kısa, ama 10+ commit olan session'larda commit listesi uzuyor → son 5 commit + `...ve N daha` formatı.
- **MCP Server'da (v0.7):** Tool response'larda terse mode doğal — sadece istenen veriyi döndür, context kirletme.
- **Etkilenen:** `hooks/mindlore-search.cjs`, `hooks/mindlore-session-focus.cjs`, `scripts/lib/session-payload.ts`
- **Efor:** Düşük-Orta

---

## v1.0 — Multi-User & Stable Release

### 12. Team Memory — Namespaced Sharing
- **Ne:** Birden fazla kullanıcı arası knowledge paylaşımı
- **Gerekli:** Namespace tablo, git-sync protokolü, conflict resolution
- **Ön koşul:** Multi-user mimari brainstorm, sync strategy kararı

### 13. Stable API Kontratı
- v1.0 = public API donmuş, semver disiplini
- Deprecation policy
- Migration tooling

### 17. Multi-Runtime SQLite Backend (Context-Mode İlhamlı)
- **Problem:** `better-sqlite3` native C++ addon — her Node major version'da rebuild gerekiyor. Node 24+'da onnxruntime realm mismatch sorunu yaşandı (commit d3fb27f). Windows'ta prebuild bulunmayınca `node-gyp` compile hatası veriyor.
- **Context-Mode'da:** `bun:sqlite` → `node:sqlite` → `better-sqlite3` auto-detect chain. Bun varsa native (sıfır dependency), yoksa Node 22+ built-in `node:sqlite`, yoksa npm dependency.
- **Çözüm:** SQLite adapter abstraction:
  ```typescript
  interface SQLiteAdapter {
    open(path: string): Database;
    exec(db: Database, sql: string): void;
    prepare(db: Database, sql: string): Statement;
  }
  ```
  Runtime detect: `typeof Bun !== 'undefined'` → bun:sqlite, `process.versions.node >= 22` → node:sqlite, fallback → better-sqlite3.
- **Kazanç:** Native dependency kaldırılır → install hızlanır, binary build sorunları biter, Bun kullanıcıları sıfır ek dependency ile çalışır.
- **Risk:** API farklılıkları — `better-sqlite3` `.run()` vs `node:sqlite` `.execute()`. Adapter layer'da normalize edilmeli.
- **Etkilenen:** `scripts/lib/` altındaki tüm DB erişim kodları, yeni: `scripts/lib/sqlite-adapter.ts`
- **Ön koşul:** Node 22+ `node:sqlite` stable olmalı (şu an experimental)

### 16. Self-Improving Agent Loop (Awesome Autoresearch İlhamlı)
- **Ne:** Mindlore'un kendi hook/skill/config'ini hypothesis → experiment → measure → keep-or-revert döngüsüyle iyileştirmesi
- **İlham:** Autoresearch ekosistemi — Claude Code + autoresearch pattern ile self-improving agent loop'ları
- **Örnek:** Search hook precision düşükse → farklı BM25 weight dene → A/B test → kazanan config'i keep
- **Karar:** İleri vadeli not. v1.0'da evaluate et.

### 18. Session Entity Extraction + Structured Embedding
- **Ne:** Session transcript'lerinden entity çıkarma (isimler, kararlar, tool adları, hata mesajları) ve extract edilen structured bilgiyi embedding
- **Neden ham transcript embedding yanlış:** Session transcript'leri dağınık (aynı session'da 10 konu), embedding her sorguya "biraz benzer" çıkar → precision düşer. Knowledge dosyaları yoğunlaştırılmış bilgi, embedding bunları iyi yakalar. GBrain/Hindsight de session'lara keyword search uyguluyor, embedding değil.
- **Çözüm:** v0.7 KG (#8) entity extraction altyapısını kurar → v1.0'da session transcript'lere de uygulanır. Extract edilen entity'ler `documents_vec`'e embed edilir, ham transcript değil.
- **Ön koşul:** v0.7 #8 Knowledge Graph + entity extraction pipeline
- **Etkilenen:** `scripts/lib/episodes.ts`, `scripts/mindlore-fts5-index.ts`, yeni: entity extraction modülü

---

## Sürekli / Her Release

- **CHANGELOG.md** — her release'de güncelle
- **Docs sync** — README + CLAUDE.md + SCHEMA.md
- **E2E test plan** — 33 kontrol tekrar koştur
- **npm health** `≥25/27`
- **Karpathy rules** — simplicity, surgical changes, goal-driven execution

---

## Ertelenen Detay Notlar

### Migration Framework Docs (v0.6.1 opsiyonel)
Framework tam var (`schema-version.ts` + 4 migration dosyası). v0.6.1'de **sadece docs** yazılacak:
- `CONTRIBUTING.md` — nasıl migration yazılır
- Naming convention: `migrations-v0XY.ts`, `version: N+1`
- Rollback stratejisi (şu an yok — eklenmeli mi karar gerek)

### Plugin System Olgunlaşması (v0.7)
v0.5'te eklenen `plugin.json` manifesti olgunlaşması — user extensibility.

### Secret Scanning / Dependency CVE (ongoing)
Dependabot veya Renovate bot kurulumu (CI/CD matrix kurulduktan sonra).

---

## Gelecek Notları (Şu An Scope Dışı)

### JSON Key-Path Chunking (Context-Mode Pattern)
- **Ne:** JSON verilerini nested key-path'e göre chunk'lama. `root > dependencies > better-sqlite3` → ayrı chunk. Array'ler byte-size'a göre batch'lenir, identity-field-aware title ile.
- **Context-Mode'da neden var:** Context-mode her türlü veriyi indexliyor — komut çıktıları, API response'ları, web sayfaları. Bunların çoğu JSON.
- **Mindlore'da neden şu an gerekli değil:** Sadece Markdown indexliyoruz. `.mindlore/` altındaki her şey `.md`. JSON verimiz yok.
- **Ne zaman gerekir:** (1) config.json, package.json gibi proje dosyalarını indexlemeye karar verirsek, (2) MCP Server (v0.7) ile external tool çıktılarını indexlersek, (3) API response cache'leme eklenirse.
- **Referans:** Context-Mode `store.ts` — `chunkJson()` fonksiyonu, recursive key-path walk.

### CC v2.1.121 Fırsatları (2026-04-28 — Ertelendi, CC adoption oturması bekleniyor)

- **`updatedToolOutput` tüm tool'lara genişledi:** PostToolUse hook'ları artık Read dahil her tool'un output'unu değiştirebilir. `mindlore-post-read` hook'u token bilgisini `additionalContext` yerine doğrudan dosya output'una append edebilir → wrapper tag overhead'i kalkar. **Risk:** Eski CC uyumluluğu (ignore vs raw geçiş), Edit sırasında satır numarası karışıklığı (separator şart). **Hedef:** v0.6.4+, CC adoption oturunca.
- **`alwaysLoad` MCP server config:** `tool-search` deferral'ı atlayan MCP server'lar tanımlanabiliyor. Mindlore MCP Server (v0.7) için doğrudan relevant.
- **MCP auto-retry 3x:** Transient startup hatalarında otomatik recovery — v0.7 MCP Server'da faydalı.
- **Hook'lar MCP tool çağırabilir (v2.1.118):** `type: "mcp_tool"` ile hook'tan MCP tool invoke. Mindlore hook'larının context-mode veya başka MCP tool'larıyla entegrasyonu mümkün.
- **PostToolUse input'larında `duration_ms` (v2.1.119):** CC'den gelen tool execution süresi — Mindlore telemetry'de zaten var ama CC-native veri daha doğru.
- **`CLAUDE_CODE_FORK_SUBAGENT=1` external build (v2.1.117):** Forked subagent'lar non-interactive session'larda çalışıyor.

---

## Kayıt Disiplini

- Yeni ertelenen işler bu dosyaya eklenir (versiyon etiketiyle)
- v0.6.1 kapandığında madde buradan silinir, release notes'a taşınır
- v0.7 büyük release → spec/brainstorm session açılır
