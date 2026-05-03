# v0.6.9 — Plugin Polish + Internal Quality

> Spec Date: 2026-05-03
> Status: Draft
> Previous: v0.6.8 Infrastructure Prep

## Versiyon Teması

Plugin Manifest v2 ile dağıtım kanalını güçlendirme + v0.6.8 simplify'dan ertelenen teknik borç temizliği. v0.7 MCP Server için temiz zemin hazırlığı.

## Scope

11 madde: 2 roadmap + 9 deferred (v0.6.8 simplify bulguları).

---

## Q1. Plugin Manifest v2

### Problem
`plugin.json` v1 flat bir skill/hook listesi. Versiyon bilgisi, minimum CC versiyonu, çakışma kontrolü ve bağımlılık tanımı yok. Kullanıcıların kendi skill/hook eklemesi için altyapı eksik.

### Tasarım

**Schema genişletme (geriye uyumlu):**

```jsonc
{
  "manifestVersion": 2,
  "name": "mindlore",
  "version": "0.6.9",          // yeni — SemVer
  "minCCVersion": "2.1.100",   // yeni — opsiyonel
  "conflicts": [],              // yeni — çakışan plugin isimleri
  "dependencies": {},           // yeni — opsiyonel bağımlılıklar
  "skills": [ ... ],
  "hooks": [ ... ]
}
```

- v1 manifest'ler geçerli kalır — `manifestVersion` yoksa 1 varsayılır
- Yeni alanların hepsi opsiyonel (sane defaults)
- `version` alanı SemVer formatında, `package.json` ile senkron tutulmalı

**Validation:**

- `scripts/lib/validate-manifest.ts` — manifest schema doğrulama
- `npm run validate-manifest` komutu eklenir
- Init sırasında ve `npm run health` içinde validation çalışır
- Hata mesajları: alan adı + beklenen format + gerçek değer

**Kapsam dışı:** User plugin registry, remote plugin install, plugin marketplace. Bunlar v0.7+ scope.

---

## Q2. Stabilizasyon

v0.7 MCP Server ön koşullarının taranması ve eksiklerin tamamlanması.

### Kontrol Listesi

1. FTS5'te decisions/episodes/learnings doğru indexed mi doğrula
2. Agent routing instruction mekanizması çalışıyor mu kontrol et
3. `npm run health` çıktısında warning/error kalmadığından emin ol
4. Mevcut hook'ların telemetry coverage'ı tam mı doğrula

**Not:** Bu madde implementation sırasında netleşecek — keşif bazlı. Bulunan sorunlar bu spec'e eklenir veya v0.7'ye ertelenir.

---

## D1. fts5-sync `.md` Guard (MEDIUM)

### Problem
`hooks/mindlore-fts5-sync.cjs` — her FileChanged tetiklemesinde `getAllMdFiles()` ile tüm `.md` dosyalarını tarayıp SHA256 hesaplıyor. Tek dosya değişikliklerinde gereksiz iş.

### Tasarım

Satır 27'deki mevcut `.md` guard'ı yeterli değil — guard sonrasında (satır 38) yine full scan çalışıyor.

**Çözüm:** Hook'un amacı bulk change'leri yakalamak. Trigger dosyası tek bir `.md` ise (mindlore-index.cjs hallediyor) veya `.mindlore/` dışındaysa early-return. `getAllMdFiles` çağrısı sadece gerçek bulk event'lerde (non-`.md` trigger) çalışır.

**Beklenen etki:** Tek dosya değişikliklerinde 0ms (early return). Bulk event'lerde değişiklik yok.

---

## D2. fts5-sync Bulk Hash Fetch (LOW)

### Problem
Satır 65: `getHash.get(file)` döngü içinde per-file sorgu — N dosya = N sorgu.

### Tasarım

```sql
SELECT path, content_hash FROM file_hashes
```

Tüm hash'leri tek sorguda `Map<string, string>` olarak çek. Döngüde `map.get(file)` kullan. N sorgu → 1 sorgu.

**Trade-off:** Büyük KB'lerde Map bellek kullanımı artar ama `.mindlore/` tipik boyutu <1000 dosya — ihmal edilebilir.

---

## D3. Search Hook Profiling (NEEDS PROFILING)

### Problem
`hooks/mindlore-search.cjs` — ~500ms ortalama latency. Hipotez: CPU-bound (FTS5 + RRF + proximity scoring + snippet extraction).

### Tasarım

**Adım 1:** `npm run perf` ile mevcut telemetry'den latency dağılımını çıkar (p50/p95/p99).

**Adım 2:** Profiling sonuçlarına göre karar ağacı:

| Hotspot | Aksiyon |
|---------|---------|
| FTS5 query | Query simplification veya index hint |
| RRF scoring | Score hesaplama optimizasyonu |
| Snippet extraction | Lazy snippet (sadece top-N için) |
| Tümü eşit | Kabul et, v0.7 MCP Server'da cache layer ile çözülür |

**Adım 3:** Profiling bulgularını bu spec'e geri yaz, optimizasyon kararını orada belgele.

**Kapsam:** Sadece profiling + bulgulara göre düşük riskli optimizasyon. Mimari değişiklik (cache layer vb.) v0.7 scope.

---

## D4. Secure I/O Helper (MEDIUM)

### Problem
7 dosyada 20 yerde `mode: 0o700` mkdir / `mode: 0o600` writeFile tekrarı. Güvenlik açısından tek noktadan kontrol gerekli.

### Tasarım

**Yeni dosya:** `scripts/lib/secure-io.ts`

```typescript
export function safeMkdir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

export function safeWriteFile(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data, { mode: 0o600 });
}

export function safeWriteJson(filePath: string, obj: unknown): void {
  safeWriteFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}
```

**Hook erişimi:** `require('../../dist/scripts/lib/secure-io.js')` — mevcut pattern (8 yerde zaten `dist/` import var).

**Refactor:** 20 call site'ı `safeMkdir`/`safeWriteFile` ile değiştir.

**Test:** `tests/secure-io.test.ts` — permission doğrulama (Unix'te `fs.statSync().mode`, Windows'ta smoke test).

---

## D5. Transaction Strategy Tutarlılığı (LOW)

### Problem
- `cc-session-sync.ts` satır 375: per-item transaction (`syncOne = db.transaction(...)`, döngüde tek tek)
- `cc-memory-bulk-sync.ts` satır 168: batch transaction (tek `db.transaction()` içinde tüm ops)

### Tasarım

**Karar: Batch canonical.**

Per-item pattern partial failure tolerance sağlıyor ama:
- Mindlore'da partial failure anlamlı değil — ya hepsi sync olur ya hiçbiri
- Batch daha hızlı (tek WAL flush vs N flush)
- fts5-sync.cjs zaten batch kullanıyor

**Aksiyon:** `cc-session-sync.ts`'deki per-item transaction'ı batch'e çevir. `syncOne` fonksiyonunu kaldırma — logic'i batch loop içine taşı.

**Risk:** Büyük session listelerinde tek transaction lock süresi artabilir. Mitigasyon: pre-read pattern zaten mevcut (R4), DB lock sadece write'larda tutulur.

---

## D6. R4 Pattern Comment Konsolidasyonu (LOW)

### Problem
3 dosyada "no file I/O inside DB transaction" yorumu tekrarlanıyor.

### Tasarım

`secure-io.ts`'in modül JSDoc'una tek referans yaz:

```typescript
/**
 * R4 Convention: File I/O must happen BEFORE the DB transaction.
 * Pre-read data into memory, then run DB writes in a single transaction.
 * This prevents holding SQLite write locks during slow disk I/O.
 */
```

Diğer 3 dosyadaki tekrarlanan yorumları kaldır. Pattern zaten kodda yerleşik — yorum gereksiz.

---

## D7. `mkdtempSync` Test Geçişi (LOW)

### Problem
`tests/migrations-v068.test.ts` ve `tests/nomination-counts.test.ts` — `Date.now()` ile temp dir oluşturuyor. Parallel Jest worker'larda race condition riski.

### Tasarım

`Date.now()` pattern'ini `fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-test-'))` ile değiştir.

Referans pattern: `tests/helpers/db.ts:129` — `createEpisodesTestEnv` zaten doğru kullanıyor.

**Etki alanı:** Sadece `Date.now()` kullanan test dosyaları. Grep ile tespit, tek tek geçiş.

---

## D8. Duplicate Test Helper Temizliği (LOW)

### Problem
`tests/helpers/db.ts`:
- `createTestDbWithFullSchema` (satır 61) — base + episodes + schema + migrations
- `createTestDbWithMigrations` (satır 78) — base + episodes + schema + migrations
- **Aynı implementasyon.**

### Tasarım

**Karar:** `createTestDbWithFullSchema` canonical isim olarak kalır. `createTestDbWithMigrations` deprecate edilir:

```typescript
/** @deprecated Use createTestDbWithFullSchema */
export const createTestDbWithMigrations = createTestDbWithFullSchema;
```

Tüm kullanım yerlerini `createTestDbWithFullSchema`'ya taşı, ardından deprecated alias'ı kaldır.

---

## D9. busy_timeout Regresyon Takibi (LOW)

### Problem
v0.6.8'de `busy_timeout` 5000ms → 2000ms düşürüldü. SQLITE_BUSY regresyonu olabilir.

### Tasarım

**Passive monitoring — yeni kod gerekmez.**

1. `telemetry.jsonl`'de SQLITE_BUSY hata sayısını analiz et
2. v0.6.8 release sonrası (2026-05-03) ile öncesi karşılaştır
3. Regresyon varsa → `busy_timeout`'ı 3000ms'ye yükselt (orta nokta)
4. Regresyon yoksa → madde kapatılır, 2000ms kalır

**Aksiyon:** Release sonrası 1 hafta telemetry topla, ardından karar ver. Implementation sırasında bir kez `npm run perf` çıktısına bak.

---

## Test Stratejisi

| Madde | Test |
|-------|------|
| Q1 Manifest v2 | `tests/manifest-v2.test.ts` — schema validation, backward compat, conflict detection |
| D4 Secure I/O | `tests/secure-io.test.ts` — permission check, JSON write, idempotent mkdir |
| D2 Bulk hash | Mevcut `tests/fts5-sync.test.ts` — performance assertion eklenmez, correctness korunur |
| D5 Transaction | Mevcut `tests/cc-session-sync.test.ts` — batch geçiş sonrası tüm testler geçmeli |
| D7-D8 | Mevcut test'ler — refactor sonrası tüm suite'ler geçmeli |

**Yeni test dosyaları:** 2 (`manifest-v2`, `secure-io`)
**Güncellenen test dosyaları:** ~4

---

## Dosya Etki Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `plugin.json` | manifestVersion: 2, version, minCCVersion alanları |
| `scripts/lib/secure-io.ts` | **YENİ** — safeMkdir, safeWriteFile, safeWriteJson |
| `scripts/lib/validate-manifest.ts` | **YENİ** — manifest schema validation |
| `hooks/mindlore-fts5-sync.cjs` | Early-return guard + bulk hash fetch |
| `hooks/mindlore-index.cjs` | secure-io import refactor |
| `hooks/mindlore-session-end.cjs` | secure-io import refactor |
| `hooks/lib/mindlore-common.cjs` | secure-io import refactor |
| `scripts/cc-session-sync.ts` | Batch transaction geçişi |
| `scripts/cc-memory-bulk-sync.ts` | secure-io import refactor |
| `scripts/fetch-raw.ts` | secure-io import refactor |
| `scripts/init.ts` | secure-io import refactor |
| `tests/helpers/db.ts` | Duplicate helper temizliği |
| `tests/manifest-v2.test.ts` | **YENİ** |
| `tests/secure-io.test.ts` | **YENİ** |
| ~2-3 test dosyası | mkdtempSync geçişi |

**Toplam:** ~3 yeni dosya, ~12 değişen dosya

---

## Kapsam Dışı

- User plugin registry / marketplace
- Remote plugin install
- Search hook mimari değişikliği (cache layer → v0.7)
- MCP Server altyapısı
- Yeni hook veya skill eklenmesi
- Breaking change (tüm değişiklikler geriye uyumlu)

---

## Başarı Kriterleri

- [ ] `plugin.json` manifestVersion 2, validation geçiyor
- [ ] `npm run validate-manifest` komutu çalışıyor
- [ ] Secure I/O helper 20 call site'da kullanılıyor
- [ ] fts5-sync tek dosya değişikliğinde early-return
- [ ] fts5-sync bulk hash tek sorgu
- [ ] cc-session-sync batch transaction
- [ ] Duplicate test helper birleştirilmiş
- [ ] mkdtempSync geçişi tamamlanmış
- [ ] R4 yorumları konsolide
- [ ] Search profiling yapılmış, bulgular belgelenmiş
- [ ] busy_timeout telemetry analizi yapılmış
- [ ] Tüm mevcut test suite'leri geçiyor
- [ ] `npm run health` clean
- [ ] `npm run build` clean
