---
allowed-tools: Bash
effort: high
disable-model-invocation: true
---

## Live Codebase Context

**Current version:** !`node -e "console.log('v'+require('./package.json').version)" 2>/dev/null || echo "unknown"`

# Skill: Mindlore Release

Kullanici `/mindlore-release patch|minor|major` veya `/mindlore-release 0.1.0` dediginde calistir.
**HIC BIR ADIMI ATLAMA.** Her adimi sirasi ile uygula.

## Parametre
- `patch` | `minor` | `major` | `X.Y.Z` (acik versiyon)
- Parametre yoksa kullaniciya sor

## Adimlar

---

### 1. On Kontrol (Build Gate)

```bash
npm run lint    # temiz olmali
npm test        # hepsi yesil olmali
```

Herhangi biri basarisizsa → **DURUR**, kullaniciya bildirir.

---

### 2. CHANGELOG.md Guncelle

- Son tag'den bu yana `git log --oneline` ile commit'leri al
- Commit'leri kategorize et: Added, Fixed, Changed
- CHANGELOG.md'nin basina yeni versiyon girdisi ekle (Keep a Changelog formati)
- Tarih: bugunun tarihi (YYYY-MM-DD)

---

### 3. README Kontrol

Asagidaki degerleri README.md ile karsilastir:

```bash
# Test sayisi
npm test 2>&1 | grep "Tests:" | grep -oP '\d+ passed'
# Hook sayisi
ls hooks/*.cjs | wc -l
# Skill sayisi
ls skills/ | wc -l
# Script sayisi
ls scripts/*.cjs | wc -l
```

README'deki rakamlar gercekle uyusmuyorsa guncelle:
- Test sayisi (Features tablosunda veya baska yerde varsa)
- Hook/skill/script sayilari

---

### 4. SCHEMA.md Senkron Kontrolu

`.mindlore/SCHEMA.md` (proje icindeki kopya) ile repo kokundeki `SCHEMA.md` ayni mi kontrol et:

```bash
diff SCHEMA.md templates/SCHEMA.md 2>/dev/null || echo "templates/SCHEMA.md yok — SCHEMA.md root'ta zaten"
```

- Fark varsa → templates'i guncelle (veya templates yoksa skip)
- NOT: `npx mindlore init` SCHEMA.md'yi repo'dan `.mindlore/`'ye kopyalar

---

### 5. Version Bump + Commit + Push

```bash
# Onceki commit kontrolu
git status --porcelain
# Degisiklik varsa commit
git add CHANGELOG.md README.md SCHEMA.md
git commit -m "docs: update changelog and readme for vX.Y.Z"

# Version bump (package.json + package-lock + git tag)
npm version X.Y.Z
# Push
git push && git push --tags
```

NOT: `npm version` otomatik git tag olusturur. `package-lock.json` da guncellenir.

---

### 6. CI Bekle + Dogrula

Tag push sonrasi:
1. `ci.yml` → lint + test (3 OS x 2 Node)
2. `publish.yml` → npm publish --provenance + GitHub Release

```bash
# CI basladigini dogrula
gh run list --limit 5
# npm'de yeni versiyon dogrula (CI bittikten sonra)
npm view mindlore version
```

---

### 7. GitHub Release Notlarini Dogrula

publish.yml otomatik GitHub Release olusturur. Kontrol et:

```bash
gh release view vX.Y.Z
```

Eksik veya hatali ise:
```bash
gh release edit vX.Y.Z --notes "Release notes burada"
```

---

### 8. Hafiza Guncelle

Kastell projesindeki MEMORY.md'de Mindlore bolumunu guncelle:
- Versiyon → yeni versiyon
- npm → mindlore@X.Y.Z
- Durum → "release yapildi" notu
- GitHub commit sayisi

---

## Versiyon Kurallari
- `patch` (0.x.X): bug fix, kucuk duzeltme
- `minor` (0.X.0): yeni feature (FTS5 upgrade gibi)
- `major` (X.0.0): breaking change (migration gerektiren)

## Hata Durumunda
- lint/test basarisizsa → DURUR
- npm publish basarisizsa → CI loglarini kontrol et, `NPM_TOKEN` secret gecerli mi bak
- Tag zaten varsa → `git tag -d vX.Y.Z` ile sil, tekrar dene

## Rollback Proseduru
1. `npm unpublish mindlore@X.Y.Z` (72 saat icinde)
2. `git tag -d vX.Y.Z && git push origin --delete vX.Y.Z`
3. `gh release delete vX.Y.Z --yes`

## Ornek Kullanim
```
/mindlore-release minor    → 0.0.1 → 0.1.0
/mindlore-release patch    → 0.1.0 → 0.1.1
/mindlore-release 1.0.0    → direkt 1.0.0
```
