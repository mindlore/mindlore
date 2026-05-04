import Database from 'better-sqlite3';
import { handleSearch } from '../scripts/lib/tool-adapters/search-adapter';
import { handleStats } from '../scripts/lib/tool-adapters/stats-adapter';
import type { McpContext } from '../scripts/lib/mcp-tools';
import path from 'path';
import os from 'os';
import fs from 'fs';

function createTestContext(): McpContext & { cleanup: () => void } {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-mcp-test-'));
  for (const sub of ['sources', 'episodes', 'decisions', 'diary', 'learnings']) {
    fs.mkdirSync(path.join(baseDir, sub), { recursive: true });
  }
  const db = new Database(':memory:');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(
      path, slug, description, type, category, title, content, tags, quality, date_captured, project
    );
    CREATE TABLE IF NOT EXISTS chunks (
      source_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      heading TEXT,
      breadcrumb TEXT DEFAULT '',
      char_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT,
      last_indexed TEXT,
      project TEXT,
      importance TEXT
    );
    CREATE TABLE IF NOT EXISTS vocabulary (
      word TEXT PRIMARY KEY
    );
  `);
  return {
    db,
    baseDir,
    cleanup: () => { db.close(); fs.rmSync(baseDir, { recursive: true, force: true }); },
  };
}

describe('search adapter', () => {
  it('returns empty results for no-match query', () => {
    const ctx = createTestContext();
    try {
      const result = handleSearch(ctx, { query: 'nonexistent' });
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.truncated).toBe(false);
    } finally {
      ctx.cleanup();
    }
  });

  it('returns results with heading for matching content', () => {
    const ctx = createTestContext();
    try {
      ctx.db.prepare(
        'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('/test/source.md', 'test-source', 'Test description', 'source', 'sources', 'Test Source', 'MCP protocol enables cross-host memory', 'mcp,protocol', '8', '2026-05-04', 'mindlore');

      const result = handleSearch(ctx, { query: 'MCP protocol' });
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(result.results[0]!.slug).toBe('test-source');
    } finally {
      ctx.cleanup();
    }
  });

  it('respects limit parameter', () => {
    const ctx = createTestContext();
    try {
      for (let i = 0; i < 10; i++) {
        ctx.db.prepare(
          'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(`/test/s${i}.md`, `slug-${i}`, 'desc', 'source', 'sources', `Source ${i}`, `content about topic ${i}`, 'tag', '5', '2026-05-04', 'mindlore');
      }
      const result = handleSearch(ctx, { query: 'content topic', limit: 3 });
      expect(result.results.length).toBeLessThanOrEqual(3);
    } finally {
      ctx.cleanup();
    }
  });
});

describe('stats adapter', () => {
  it('returns basic stats', () => {
    const ctx = createTestContext();
    try {
      const result = handleStats(ctx, {});
      expect(result.health).toBeDefined();
      expect(typeof result.sources).toBe('number');
      expect(typeof result.dbSize).toBe('string');
    } finally {
      ctx.cleanup();
    }
  });

  it('returns version string', () => {
    const ctx = createTestContext();
    try {
      const result = handleStats(ctx, {});
      expect(result.version).toBeDefined();
    } finally {
      ctx.cleanup();
    }
  });
});
