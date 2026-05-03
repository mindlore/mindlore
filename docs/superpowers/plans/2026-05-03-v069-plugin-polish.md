# v0.6.9 Plugin Polish + Internal Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plugin Manifest v2 ile dağıtım güçlendirme + v0.6.8 teknik borç temizliği

**Architecture:** Mevcut hook/script/test yapısı korunuyor. Yeni dosyalar: `scripts/lib/secure-io.ts`, `scripts/lib/validate-manifest.ts`, 2 test dosyası. 20 call site refactor (secure I/O), fts5-sync perf iyileştirmeleri, test helper konsolidasyonu.

**Tech Stack:** TypeScript (CJS output), better-sqlite3, Jest, ESLint

**Spec:** `docs/superpowers/specs/2026-05-03-v069-plugin-polish-design.md`

---

## Phase 1: Foundation (Secure I/O Helper)

Bu faz diğer tüm fazların önkoşulu — refactor edilen dosyalar bu helper'ı kullanacak.

### Task 1: Secure I/O Helper — Test + Implementation

**Files:**
- Create: `scripts/lib/secure-io.ts`
- Create: `tests/secure-io.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/secure-io.test.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { safeMkdir, safeWriteFile, safeWriteJson } from '../scripts/lib/secure-io.js';

describe('secure-io', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-secio-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('safeMkdir', () => {
    it('creates directory with 0o700 permissions', () => {
      const dir = path.join(tmpDir, 'subdir');
      safeMkdir(dir);
      expect(fs.existsSync(dir)).toBe(true);
      if (process.platform !== 'win32') {
        const mode = fs.statSync(dir).mode & 0o777;
        expect(mode).toBe(0o700);
      }
    });

    it('is idempotent — does not throw on existing dir', () => {
      const dir = path.join(tmpDir, 'subdir');
      safeMkdir(dir);
      expect(() => safeMkdir(dir)).not.toThrow();
    });

    it('creates nested directories', () => {
      const dir = path.join(tmpDir, 'a', 'b', 'c');
      safeMkdir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('safeWriteFile', () => {
    it('writes file with 0o600 permissions', () => {
      const fp = path.join(tmpDir, 'test.txt');
      safeWriteFile(fp, 'hello');
      expect(fs.readFileSync(fp, 'utf8')).toBe('hello');
      if (process.platform !== 'win32') {
        const mode = fs.statSync(fp).mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it('overwrites existing file', () => {
      const fp = path.join(tmpDir, 'test.txt');
      safeWriteFile(fp, 'first');
      safeWriteFile(fp, 'second');
      expect(fs.readFileSync(fp, 'utf8')).toBe('second');
    });
  });

  describe('safeWriteJson', () => {
    it('writes JSON with trailing newline', () => {
      const fp = path.join(tmpDir, 'data.json');
      safeWriteJson(fp, { key: 'value' });
      const content = fs.readFileSync(fp, 'utf8');
      expect(content).toBe('{\n  "key": "value"\n}\n');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx jest tests/secure-io.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/lib/secure-io.ts
import fs from 'fs';

export function safeMkdir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

export function safeWriteFile(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data, { encoding: 'utf8', mode: 0o600 });
}

export function safeWriteJson(filePath: string, obj: unknown): void {
  safeWriteFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}
```

- [ ] **Step 4: Build and run test to verify it passes**

Run: `npm run build && npx jest tests/secure-io.test.ts --no-coverage`
Expected: 3 test suites PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/secure-io.ts tests/secure-io.test.ts
git commit -m "feat(v069): add secure-io helper with tests"
```

---

### Task 2: Refactor hooks to use secure-io

**Files:**
- Modify: `hooks/mindlore-index.cjs` (lines 167, 169)
- Modify: `hooks/mindlore-session-end.cjs` (lines 206, 221, 366, 463)
- Modify: `hooks/lib/mindlore-common.cjs` (lines 671, 682)

- [ ] **Step 1: Add require to `hooks/mindlore-index.cjs`**

At the top of the file (after existing requires), add:
```javascript
const { safeMkdir, safeWriteFile } = require('../dist/scripts/lib/secure-io.js');
```

Replace line 167:
```javascript
// OLD: fs.mkdirSync(memoryDir, { recursive: true, mode: 0o700 });
safeMkdir(memoryDir);
```

Replace line 169:
```javascript
// OLD: fs.writeFileSync(destPath, cleaned, { encoding: 'utf8', mode: 0o600 });
safeWriteFile(destPath, cleaned);
```

- [ ] **Step 2: Refactor `hooks/mindlore-session-end.cjs`**

At the top (after existing requires), add:
```javascript
const { safeWriteFile, safeWriteJson } = require('../dist/scripts/lib/secure-io.js');
```

Replace 4 call sites:
- Line 206: `fs.writeFileSync(deltaPath, sections.join('\n'), { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(deltaPath, sections.join('\n'))`
- Line 221: `fs.writeFileSync(tmpFile, workerData, { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(tmpFile, workerData)`
- Line 366: `fs.writeFileSync(filePath, lines.join('\n'), { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(filePath, lines.join('\n'))`
- Line 463: `fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 })` → `safeWriteJson(configPath, config)`

- [ ] **Step 3: Refactor `hooks/lib/mindlore-common.cjs`**

At the top (after existing requires), add:
```javascript
const { safeMkdir, safeWriteFile } = require('../../dist/scripts/lib/secure-io.js');
```

Replace 2 call sites:
- Line 671: `fs.writeFileSync(tmpPath, lines.slice(-keepLines).join('\n') + '\n', { mode: 0o600 })` → `safeWriteFile(tmpPath, lines.slice(-keepLines).join('\n') + '\n')`
- Line 682: `fs.mkdirSync(GLOBAL_MINDLORE_DIR, { recursive: true, mode: 0o700 })` → `safeMkdir(GLOBAL_MINDLORE_DIR)`

- [ ] **Step 4: Build and run all hook-related tests**

Run: `npm run build && npx jest --no-coverage`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/mindlore-index.cjs hooks/mindlore-session-end.cjs hooks/lib/mindlore-common.cjs
git commit -m "refactor(v069): hooks use secure-io helper"
```

---

### Task 3: Refactor scripts to use secure-io

**Files:**
- Modify: `scripts/init.ts` (lines 62, 428, 467, 704, 705)
- Modify: `scripts/fetch-raw.ts` (lines 95, 96, 289, 292)
- Modify: `scripts/cc-session-sync.ts` (lines 364, 365)
- Modify: `scripts/cc-memory-bulk-sync.ts` (line 113)

- [ ] **Step 1: Refactor `scripts/init.ts`**

Add import at top:
```typescript
import { safeMkdir, safeWriteFile, safeWriteJson } from './lib/secure-io.js';
```

Replace 5 call sites:
- Line 62: `fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 })` → `safeMkdir(dirPath)`
- Line 428: `fs.writeFileSync(configDest, JSON.stringify(defaultConfig, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })` → `safeWriteJson(configDest, defaultConfig)`
- Line 467: `fs.writeFileSync(configDest, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })` → `safeWriteJson(configDest, config)`
- Line 704: `fs.writeFileSync(versionPath, packageJson.version, { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(versionPath, packageJson.version)`
- Line 705: `fs.writeFileSync(pkgVersionPath, packageJson.version, { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(pkgVersionPath, packageJson.version)`

- [ ] **Step 2: Refactor `scripts/fetch-raw.ts`**

Add import at top:
```typescript
import { safeMkdir, safeWriteFile, safeWriteJson } from './lib/secure-io.js';
```

Replace 4 call sites:
- Line 95: `fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })` → `safeMkdir(outDir)`
- Line 96: `fs.writeFileSync(path.join(outDir, `.${slug}.meta.json`), JSON.stringify(headers), { mode: 0o600 })` → `safeWriteJson(path.join(outDir, `.${slug}.meta.json`), headers)`
- Line 289: `fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })` → `safeMkdir(outDir)`
- Line 292: `fs.writeFileSync(filePath, fullContent, { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(filePath, fullContent)`

- [ ] **Step 3: Refactor `scripts/cc-session-sync.ts`**

Add import at top:
```typescript
import { safeMkdir, safeWriteFile } from './lib/secure-io.js';
```

Replace 2 call sites:
- Line 364: `fs.mkdirSync(destDir, { recursive: true, mode: 0o700 })` → `safeMkdir(destDir)`
- Line 365: `fs.writeFileSync(destPath, md, { encoding: 'utf8', mode: 0o600 })` → `safeWriteFile(destPath, md)`

- [ ] **Step 4: Refactor `scripts/cc-memory-bulk-sync.ts`**

Add import at top:
```typescript
import { safeMkdir } from './lib/secure-io.js';
```

Replace 1 call site:
- Line 113: `fs.mkdirSync(memoryDestDir, { recursive: true, mode: 0o700 })` → `safeMkdir(memoryDestDir)`

- [ ] **Step 5: Build and run all tests**

Run: `npm run build && npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/init.ts scripts/fetch-raw.ts scripts/cc-session-sync.ts scripts/cc-memory-bulk-sync.ts
git commit -m "refactor(v069): scripts use secure-io helper"
```

---

## Phase 2: Performance (fts5-sync)

### Task 4: fts5-sync `.md` guard + bulk hash fetch

**Files:**
- Modify: `hooks/mindlore-fts5-sync.cjs` (lines 27-66)

- [ ] **Step 1: Read current fts5-sync hook**

Read `hooks/mindlore-fts5-sync.cjs` fully — understand the flow before editing.

- [ ] **Step 2: Replace per-file hash query with bulk fetch**

D1 (early-return guard) needs deeper investigation — the hook already skips `.md` triggers (line 27). The real problem is that non-`.md` triggers (config.json, DB changes) cause a full `.md` scan. A simple guard doesn't fix this. **D1 is deferred to v0.7** — the bulk hash fetch below is the actionable perf win.



Replace line 41 (`const getHash = ...`) with bulk Map:

```javascript
const allHashes = new Map();
for (const row of db.prepare('SELECT path, content_hash FROM file_hashes').all()) {
  allHashes.set(row.path, row.content_hash);
}
```

Replace lines 65-66 in the inner loop:
```javascript
// BEFORE:
// const existing = getHash.get(file);
// if (existing && existing.content_hash === hash) continue;

// AFTER:
const existingHash = allHashes.get(file);
if (existingHash === hash) continue;
```

Remove the `getHash` prepared statement (line 41 old) — it's no longer used.

- [ ] **Step 4: Build and run fts5-sync tests**

Run: `npm run build && npx jest tests/fts5-sync.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run build && npx jest --no-coverage`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add hooks/mindlore-fts5-sync.cjs
git commit -m "perf(v069): fts5-sync early-return guard + bulk hash fetch"
```

---

## Phase 3: Plugin Manifest v2

### Task 5: Manifest Validation — Test + Implementation

**Files:**
- Create: `scripts/lib/validate-manifest.ts`
- Create: `tests/manifest-v2.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/manifest-v2.test.ts
import { validateManifest, ManifestValidationResult } from '../scripts/lib/validate-manifest.js';

describe('validate-manifest', () => {
  const validV2 = {
    manifestVersion: 2,
    name: 'mindlore',
    version: '0.6.9',
    description: 'AI-native knowledge system',
    skills: [],
    hooks: [],
  };

  it('accepts valid v2 manifest', () => {
    const result = validateManifest(validV2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts v1 manifest (no manifestVersion field)', () => {
    const v1 = { name: 'test', description: 'test plugin', skills: [], hooks: [] };
    const result = validateManifest(v1);
    expect(result.valid).toBe(true);
    expect(result.manifestVersion).toBe(1);
  });

  it('rejects missing name', () => {
    const bad = { ...validV2, name: undefined };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/name/i);
  });

  it('rejects invalid version format', () => {
    const bad = { ...validV2, version: 'not-semver' };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/version/i);
  });

  it('rejects invalid manifestVersion', () => {
    const bad = { ...validV2, manifestVersion: 99 };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/manifestVersion/i);
  });

  it('accepts optional fields when missing', () => {
    const minimal = { ...validV2 };
    delete (minimal as Record<string,unknown>).minCCVersion;
    delete (minimal as Record<string,unknown>).conflicts;
    delete (minimal as Record<string,unknown>).dependencies;
    const result = validateManifest(minimal);
    expect(result.valid).toBe(true);
  });

  it('validates minCCVersion format when present', () => {
    const withCC = { ...validV2, minCCVersion: '2.1.100' };
    expect(validateManifest(withCC).valid).toBe(true);

    const badCC = { ...validV2, minCCVersion: 'abc' };
    expect(validateManifest(badCC).valid).toBe(false);
  });

  it('validates conflicts is array of strings', () => {
    const good = { ...validV2, conflicts: ['other-plugin'] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, conflicts: [123] };
    expect(validateManifest(bad).valid).toBe(false);
  });

  it('validates skills have name and path', () => {
    const good = { ...validV2, skills: [{ name: 'test', path: 'skills/test/SKILL.md', description: 'desc' }] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, skills: [{ name: 'test' }] };
    expect(validateManifest(bad).valid).toBe(false);
  });

  it('validates hooks have event and script', () => {
    const good = { ...validV2, hooks: [{ event: 'SessionStart', script: 'hooks/test.cjs' }] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, hooks: [{ event: 'SessionStart' }] };
    expect(validateManifest(bad).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx jest tests/manifest-v2.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/lib/validate-manifest.ts

export interface ManifestValidationResult {
  valid: boolean;
  manifestVersion: number;
  errors: string[];
  warnings: string[];
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const KNOWN_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'FileChanged', 'PreToolUse', 'PostToolUse',
  'PreCompact', 'PostCompact', 'CwdChanged',
];

export function validateManifest(manifest: Record<string, unknown>): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mv = typeof manifest.manifestVersion === 'number' ? manifest.manifestVersion : 1;

  if (manifest.manifestVersion !== undefined && (typeof manifest.manifestVersion !== 'number' || ![1, 2].includes(mv))) {
    errors.push(`manifestVersion must be 1 or 2, got: ${manifest.manifestVersion}`);
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  if (mv >= 2) {
    if (manifest.version !== undefined) {
      if (typeof manifest.version !== 'string' || !SEMVER_RE.test(manifest.version)) {
        errors.push(`version must be valid SemVer (x.y.z), got: ${manifest.version}`);
      }
    }

    if (manifest.minCCVersion !== undefined) {
      if (typeof manifest.minCCVersion !== 'string' || !SEMVER_RE.test(manifest.minCCVersion)) {
        errors.push(`minCCVersion must be valid SemVer (x.y.z), got: ${manifest.minCCVersion}`);
      }
    }

    if (manifest.conflicts !== undefined) {
      if (!Array.isArray(manifest.conflicts) || !manifest.conflicts.every((c: unknown) => typeof c === 'string')) {
        errors.push('conflicts must be an array of strings');
      }
    }
  }

  // Validate skills array
  if (manifest.skills !== undefined) {
    if (!Array.isArray(manifest.skills)) {
      errors.push('skills must be an array');
    } else {
      for (let i = 0; i < manifest.skills.length; i++) {
        const s = manifest.skills[i] as Record<string, unknown>;
        if (!s.name || typeof s.name !== 'string') errors.push(`skills[${i}]: name is required`);
        if (!s.path || typeof s.path !== 'string') errors.push(`skills[${i}]: path is required`);
      }
    }
  }

  // Validate hooks array
  if (manifest.hooks !== undefined) {
    if (!Array.isArray(manifest.hooks)) {
      errors.push('hooks must be an array');
    } else {
      for (let i = 0; i < manifest.hooks.length; i++) {
        const h = manifest.hooks[i] as Record<string, unknown>;
        if (!h.event || typeof h.event !== 'string') errors.push(`hooks[${i}]: event is required`);
        if (!h.script || typeof h.script !== 'string') errors.push(`hooks[${i}]: script is required`);
        if (h.event && typeof h.event === 'string' && !KNOWN_EVENTS.includes(h.event)) {
          warnings.push(`hooks[${i}]: unknown event "${h.event}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, manifestVersion: mv, errors, warnings };
}
```

- [ ] **Step 4: Build and run test**

Run: `npm run build && npx jest tests/manifest-v2.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate-manifest.ts tests/manifest-v2.test.ts
git commit -m "feat(v069): manifest validation with v2 schema support"
```

---

### Task 6: Update plugin.json to v2 + add validate-manifest command

**Files:**
- Modify: `plugin.json`
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Update `plugin.json`**

Add `manifestVersion` and update `version`:
```json
{
  "manifestVersion": 2,
  "name": "mindlore",
  "description": "AI-native knowledge system for Claude Code. Persistent, searchable, evolving knowledge base with FTS5.",
  "version": "0.6.9",
  ...rest stays the same
}
```

Only add `manifestVersion: 2` as first field and update `version` to `0.6.9`. Do NOT change anything else.

- [ ] **Step 2: Add npm script to `package.json`**

Add to the `"scripts"` section:
```json
"validate-manifest": "node dist/scripts/validate-manifest-cli.js"
```

- [ ] **Step 3: Create CLI wrapper**

Create `scripts/validate-manifest-cli.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import { validateManifest } from './lib/validate-manifest.js';

const manifestPath = path.resolve(__dirname, '..', '..', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const result = validateManifest(manifest);

if (result.valid) {
  console.log(`✓ Manifest v${result.manifestVersion} valid`);
  if (result.warnings.length > 0) {
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  }
} else {
  console.error('✗ Manifest validation failed:');
  for (const e of result.errors) console.error(`  ERROR: ${e}`);
  process.exit(1);
}
```

- [ ] **Step 4: Build and verify**

Run: `npm run build && npm run validate-manifest`
Expected: `✓ Manifest v2 valid`

- [ ] **Step 5: Commit**

```bash
git add plugin.json package.json scripts/validate-manifest-cli.ts
git commit -m "feat(v069): plugin.json upgraded to manifest v2"
```

---

## Phase 4: Test Cleanup

### Task 7: Duplicate test helper — consolidate to single name

**Files:**
- Modify: `tests/helpers/db.ts` (lines 61-84)

- [ ] **Step 1: Read `tests/helpers/db.ts` to confirm current state**

Verify `createTestDbWithFullSchema` (line 61) and `createTestDbWithMigrations` (line 78) are identical.

- [ ] **Step 2: Replace `createTestDbWithFullSchema` with alias**

`createTestDbWithMigrations` has 25 call sites vs 1. Keep `createTestDbWithMigrations` as canonical.

In `tests/helpers/db.ts`:

1. Delete lines 61-67 (`createTestDbWithFullSchema` function body)
2. After line 84 (end of `createTestDbWithMigrations`), add the alias:

```typescript
export const createTestDbWithFullSchema = createTestDbWithMigrations;
```

This ensures `createTestDbWithMigrations` is defined first, then aliased.

- [ ] **Step 3: Build and run all tests**

Run: `npm run build && npx jest --no-coverage`
Expected: All PASS (the alias ensures backward compat)

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/db.ts
git commit -m "refactor(v069): consolidate duplicate test helper to createTestDbWithMigrations"
```

---

### Task 8: mkdtempSync migration for race-prone test files

**Files:**
- Modify: `tests/migrations-v068.test.ts` (line 13)
- Modify: `tests/nomination-counts.test.ts` (line 14)
- Modify: `tests/episode-file.test.ts` (line 25)
- Modify: `tests/fetch-raw.test.ts` (line 7)
- Modify: `tests/git-snapshot.test.ts` (lines 7, 61, 73)
- Modify: `tests/pre-compact.test.ts` (line 25)
- Modify: `tests/recall-telemetry.test.ts` (line 11)
- Modify: `tests/search-offload.test.ts` (line 6)
- Modify: `tests/skill-path-resolution.test.ts` (line 8)

**Pattern:** `Date.now()` kullanarak tmpdir/db path oluşturanları `fs.mkdtempSync` pattern'ine geçir.

NOT: `Date.now()` ile tarih hesaplayan satırlar (decay.test.ts, cc-session-sync.test.ts vb.) dokunulmaz — bunlar timestamp aritmetiği, tmpdir değil.

- [ ] **Step 1: Read each file to find the exact line to change**

For each file, read the line using Date.now() for path creation. Only change lines where Date.now() is used to create a file/directory path.

- [ ] **Step 2: Apply pattern for DB-only files**

For files creating just a `.db` path (migrations-v068, nomination-counts):

```typescript
// BEFORE: const dbPath = path.join(os.tmpdir(), `mindlore-v068-test-${Date.now()}.db`);
// AFTER:
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-v068-test-'));
const dbPath = path.join(tmpDir, 'test.db');
```

Add cleanup in `afterAll` or `afterEach`:
```typescript
afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
```

- [ ] **Step 3: Apply pattern for directory-based files**

For files creating a tmpdir (fetch-raw, git-snapshot, recall-telemetry, search-offload, skill-path-resolution, episode-file, pre-compact):

```typescript
// BEFORE: const tmpDir = path.join(os.tmpdir(), 'mindlore-fetch-test-' + Date.now());
// AFTER:  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-fetch-test-'));
```

The rest of the code (mkdir, cleanup) should already work since `mkdtempSync` returns a valid directory path.

For `pre-compact.test.ts` which uses `__dirname`:
```typescript
// BEFORE: testDir = path.join(__dirname, `.test-pre-compact-${Date.now()}`);
// AFTER:  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-pre-compact-'));
```

- [ ] **Step 4: Build and run all tests**

Run: `npm run build && npx jest --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add tests/migrations-v068.test.ts tests/nomination-counts.test.ts tests/episode-file.test.ts tests/fetch-raw.test.ts tests/git-snapshot.test.ts tests/pre-compact.test.ts tests/recall-telemetry.test.ts tests/search-offload.test.ts tests/skill-path-resolution.test.ts
git commit -m "refactor(v069): migrate test tmpdir to mkdtempSync for parallel safety"
```

---

## Phase 5: Code Quality Cleanup

### Task 9: R4 pattern comment consolidation

**Files:**
- Modify: `scripts/lib/secure-io.ts` (add JSDoc)
- Modify: `hooks/mindlore-fts5-sync.cjs` (remove R4 comment, lines 59, 74)
- Modify: `scripts/cc-session-sync.ts` (remove R4 comment, line 374)
- Modify: `scripts/cc-memory-bulk-sync.ts` (check for R4 comment)

- [ ] **Step 1: Grep for all R4 pattern comments**

Run: `grep -rn "R4\|no file I/O inside.*transaction\|no file I/O inside DB" hooks/ scripts/ --include="*.cjs" --include="*.ts"`

Identify all locations.

- [ ] **Step 2: Add canonical R4 reference to `secure-io.ts`**

Add at the top of `scripts/lib/secure-io.ts`:
```typescript
/**
 * R4 Convention: File I/O must happen BEFORE the DB transaction.
 * Pre-read data into memory, then run DB writes in a single transaction.
 * This prevents holding SQLite write locks during slow disk I/O.
 *
 * All secure file operations are centralized here.
 */
```

- [ ] **Step 3: Remove duplicate R4 comments from other files**

Remove inline R4 comments from the files found in Step 1. The pattern is established in secure-io.ts.

- [ ] **Step 4: Build and run all tests**

Run: `npm run build && npx jest --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/secure-io.ts hooks/mindlore-fts5-sync.cjs scripts/cc-session-sync.ts scripts/cc-memory-bulk-sync.ts
git commit -m "refactor(v069): consolidate R4 pattern comments to secure-io.ts"
```

---

### Task 10: Transaction strategy — document per-item as intentional

**Files:**
- Modify: `scripts/cc-session-sync.ts` (line 374 — add clarifying comment)

- [ ] **Step 1: Add intentional design comment**

The per-item transaction in `cc-session-sync.ts` is intentional — it provides partial failure tolerance (one bad session doesn't block others). Do NOT convert to batch.

Add a comment before line 375:
```typescript
// Per-item transaction is intentional: each session syncs independently
// so one corrupt session file doesn't block the rest (partial failure tolerance).
```

- [ ] **Step 2: Commit**

```bash
git add scripts/cc-session-sync.ts
git commit -m "docs(v069): document intentional per-item transaction in cc-session-sync"
```

---

## Phase 6: Profiling & Monitoring

### Task 11: Search hook profiling

**Files:**
- No file changes — analysis only

- [ ] **Step 1: Run perf report**

Run: `npm run build && npm run perf`

Capture the output. Look for `mindlore-search` hook latency: p50, p95, p99 values.

- [ ] **Step 2: Analyze results**

If telemetry data exists, identify the hotspot:
- If p95 > 1000ms → needs optimization (file a finding)
- If p95 < 500ms → acceptable, close the item
- If insufficient data → note that monitoring continues

- [ ] **Step 3: Document findings**

Add profiling results as a comment in `docs/superpowers/specs/2026-05-03-v069-plugin-polish-design.md` under D3 section. Update the status (RESOLVED or DEFERRED TO v0.7).

- [ ] **Step 4: Commit if spec updated**

```bash
git add docs/superpowers/specs/2026-05-03-v069-plugin-polish-design.md
git commit -m "docs(v069): search hook profiling results"
```

---

### Task 12: busy_timeout telemetry check

**Files:**
- No file changes — analysis only

- [ ] **Step 1: Check telemetry for SQLITE_BUSY errors**

Run: `npm run build && node -e "const fs=require('fs'),p=require('path'),h=p.join(require('os').homedir(),'.mindlore','telemetry.jsonl');if(!fs.existsSync(h)){console.log('No telemetry file');process.exit(0);}const lines=fs.readFileSync(h,'utf8').split('\\n').filter(l=>l.includes('SQLITE_BUSY'));console.log('SQLITE_BUSY count:',lines.length);if(lines.length>0)lines.slice(-5).forEach(l=>console.log(l))"`

- [ ] **Step 2: Evaluate**

- 0 occurrences → 2000ms is fine, close the item
- 1-5 occurrences → monitor, note in spec
- 5+ occurrences → raise busy_timeout to 3000ms (create follow-up task)

- [ ] **Step 3: Document findings in spec**

Update D9 section in `docs/superpowers/specs/2026-05-03-v069-plugin-polish-design.md`.

- [ ] **Step 4: Commit if spec updated**

```bash
git add docs/superpowers/specs/2026-05-03-v069-plugin-polish-design.md
git commit -m "docs(v069): busy_timeout telemetry analysis results"
```

---

## Phase 7: Stabilization

### Task 13: v0.7 pre-requisite check + final validation

**Files:**
- No new files — verification only

- [ ] **Step 1: Verify FTS5 indexes decisions/episodes/learnings**

Run: `npm run build && npm run search -- "decision" && npm run search -- "episode" && npm run search -- "learning"`

Confirm results come from the correct categories.

- [ ] **Step 2: Run full health check**

Run: `npm run health`
Expected: All 16 checks pass, no warnings.

- [ ] **Step 3: Run full test suite**

Run: `npm run build && npx jest --no-coverage`
Expected: All suites PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Run validate-manifest**

Run: `npm run validate-manifest`
Expected: `✓ Manifest v2 valid`

- [ ] **Step 6: Document stabilization results**

If any issues found, create follow-up tasks or fix inline. Update spec D2 (Stabilizasyon) with results.

- [ ] **Step 7: Final commit if needed**

```bash
git add -A
git commit -m "chore(v069): stabilization pass complete"
```

---

## Spec Corrections (from plan writing)

The following corrections were identified during plan writing:

1. **D1 fts5-sync guard:** Mevcut kod zaten `.md` tetikleyicileri skip ediyor (line 27). Gerçek sorun non-`.md` tetikleyicilerde full scan — basit guard ile çözülmez. **D1 v0.7'ye ertelendi.** Sadece bulk hash fetch (D2) uygulandı.

2. **D5 Transaction Strategy:** Per-item transaction in `cc-session-sync.ts` is intentional (partial failure tolerance). It should NOT be converted to batch. Spec updated: Task 10 documents this as intentional instead of converting.

3. **D8 Test Helper:** `createTestDbWithMigrations` (25 call sites) is the canonical name, not `createTestDbWithFullSchema` (1 call site). Spec was wrong — plan uses correct direction.

4. **Manifest v1 backward compat:** Validation'ın `mv >= 2` gating'i, v1 manifest'lerde `version` alanını doğrulamaz. Bu kasıtlı — v1 manifest'ler legacy, sadece v2'de strict validation uygulanır.

---

## Summary

| Phase | Tasks | Files Changed | Commits |
|-------|-------|---------------|---------|
| 1. Foundation | 1-3 | 11 | 3 |
| 2. Performance | 4 (D1 deferred→v0.7, D2 only) | 1 | 1 |
| 3. Manifest v2 | 5-6 | 4 | 2 |
| 4. Test Cleanup | 7-8 | 10 | 2 |
| 5. Quality | 9-10 | 4 | 2 |
| 6. Profiling | 11-12 | 1 (spec only) | 2 |
| 7. Stabilization | 13 | 0 | 1 |
| **Total** | **13** | **~15** | **13** |
