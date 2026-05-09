import Database from 'better-sqlite3';
import { handleSearch } from '../scripts/lib/tool-adapters/search-adapter';
import { handleStats } from '../scripts/lib/tool-adapters/stats-adapter';
import { handleRecall } from '../scripts/lib/tool-adapters/recall-adapter';
import { handleBrief } from '../scripts/lib/tool-adapters/brief-adapter';
import { handleIngest } from '../scripts/lib/tool-adapters/ingest-adapter';
import { handleDecide } from '../scripts/lib/tool-adapters/decide-adapter';
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
    CREATE TABLE IF NOT EXISTS mindlore_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_a TEXT NOT NULL,
      source_b TEXT NOT NULL,
      relation_type TEXT NOT NULL CHECK(relation_type IN ('cites', 'extends', 'contradicts', 'supersedes')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      UNIQUE(source_a, source_b, relation_type)
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

  it('returns related field in search results', () => {
    const ctx = createTestContext();
    try {
      ctx.db.prepare(
        'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('/test/a.md', 'a', 'desc', 'source', 'sources', 'A', 'content A', 'tag', '5', '2026-05-04', 'mindlore');

      const result = handleSearch(ctx, { query: 'content A' });
      expect(result.related).toBeDefined();
      expect(Array.isArray(result.related)).toBe(true);
    } finally {
      ctx.cleanup();
    }
  });
});

describe('stats adapter', () => {
  it('returns basic stats', () => {
    const ctx = createTestContext();
    try {
      const result = handleStats(ctx);
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
      const result = handleStats(ctx);
      expect(result.version).toBeDefined();
    } finally {
      ctx.cleanup();
    }
  });
});

describe('recall adapter', () => {
  it('returns empty items for empty KB', () => {
    const ctx = createTestContext();
    try {
      const result = handleRecall(ctx, { type: 'all' });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  it('returns decisions when type=decisions', () => {
    const ctx = createTestContext();
    try {
      // Create a test decision file
      const decPath = path.join(ctx.baseDir, 'decisions', 'test-decision.md');
      fs.writeFileSync(decPath, [
        '---',
        'slug: test-decision',
        'type: decision',
        'date: 2026-05-04',
        'title: Use MCP Protocol',
        'tags: [mcp, architecture]',
        '---',
        '',
        'We decided to use MCP protocol for cross-host communication.',
      ].join('\n'));

      const result = handleRecall(ctx, { type: 'decisions' });
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.title).toBe('Use MCP Protocol');
    } finally {
      ctx.cleanup();
    }
  });
});

describe('brief adapter', () => {
  it('returns project brief for empty KB', () => {
    const ctx = createTestContext();
    try {
      const result = handleBrief(ctx, {});
      expect(result.summary).toBeDefined();
      expect(typeof result.recentDecisions).toBe('number');
      expect(typeof result.recentEpisodes).toBe('number');
    } finally {
      ctx.cleanup();
    }
  });
});

describe('ingest adapter', () => {
  it('ingests text content and returns slug', () => {
    const ctx = createTestContext();
    try {
      const result = handleIngest(ctx, {
        type: 'text',
        content: 'MCP protocol is a cross-host memory layer for AI agents.',
        title: 'MCP Overview',
      });
      expect(result.slug).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
    } finally {
      ctx.cleanup();
    }
  });

  it('rejects empty content', () => {
    const ctx = createTestContext();
    try {
      expect(() => handleIngest(ctx, { type: 'text', content: '' })).toThrow();
    } finally {
      ctx.cleanup();
    }
  });
});

describe('decide adapter', () => {
  it('saves a decision and returns slug', () => {
    const ctx = createTestContext();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- discriminated union narrowing in test
      const result = handleDecide(ctx, {
        action: 'save',
        title: 'Use Stdio Transport',
        rationale: 'Proven model from context-mode, 14 platform support.',
      }) as { slug: string; path: string };
      expect(result.slug).toBe('use-stdio-transport');
      expect(result.path).toContain('decisions');
      expect(fs.existsSync(result.path)).toBe(true);
    } finally {
      ctx.cleanup();
    }
  });

  it('lists decisions from empty dir', () => {
    const ctx = createTestContext();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- discriminated union narrowing in test
      const result = handleDecide(ctx, { action: 'list' }) as { decisions: unknown[]; total: number };
      expect(result.decisions).toEqual([]);
      expect(result.total).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  it('lists saved decisions', () => {
    const ctx = createTestContext();
    try {
      handleDecide(ctx, {
        action: 'save',
        title: 'Decision One',
        rationale: 'First reason.',
      });
      handleDecide(ctx, {
        action: 'save',
        title: 'Decision Two',
        rationale: 'Second reason.',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- discriminated union narrowing in test
      const result = handleDecide(ctx, { action: 'list' }) as { decisions: unknown[]; total: number };
      expect(result.decisions.length).toBe(2);
    } finally {
      ctx.cleanup();
    }
  });
});
