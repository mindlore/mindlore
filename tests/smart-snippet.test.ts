import Database from 'better-sqlite3';
import { extractSmartSnippet } from '../scripts/lib/smart-snippet';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE chunks (
      source_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      heading TEXT,
      breadcrumb TEXT DEFAULT '',
      char_count INTEGER DEFAULT 0
    )
  `);
  return db;
}

describe('extractSmartSnippet', () => {
  it('returns chunk-based snippet when chunk matches', () => {
    const db = createTestDb();
    db.prepare('INSERT INTO chunks VALUES (?, ?, ?, ?, ?)').run(
      '/test/source.md', 0, 'Introduction', 'Introduction', 50
    );
    db.prepare('INSERT INTO chunks VALUES (?, ?, ?, ?, ?)').run(
      '/test/source.md', 1, 'Architecture', 'Architecture', 200
    );

    const fullContent = [
      '# Introduction',
      'This is the intro section with some basic text that provides context about the project.',
      'It explains what the project does and why it matters to the users and developers.',
      '',
      '# Architecture',
      'The architecture uses MCP protocol for cross-host communication between different nodes.',
      'Stdio transport handles all message passing between host and server in a secure manner.',
      'Each tool maps to an existing script via thin adapter pattern for maximum flexibility.',
      'This design ensures that the system can scale horizontally across multiple machines.',
      'Developers can add new tools without modifying the core server implementation at all.',
    ].join('\n');

    const result = extractSmartSnippet(db, '/test/source.md', fullContent, ['MCP', 'protocol'], 500);
    expect(result.snippet).toContain('MCP protocol');
    expect(result.heading).toBe('Architecture');
    db.close();
  });

  it('falls back to term-based snippet when no chunks table', () => {
    const db = new Database(':memory:');
    const content = 'The MCP protocol enables cross-host memory access.';
    const result = extractSmartSnippet(db, '/missing.md', content, ['MCP'], 500);
    expect(result.snippet).toContain('MCP');
    expect(result.heading).toBeNull();
    db.close();
  });

  it('falls back to term-based snippet when no chunks for path', () => {
    const db = createTestDb();
    const content = 'Some content about MCP servers and tools.';
    const result = extractSmartSnippet(db, '/no-chunks.md', content, ['MCP'], 500);
    expect(result.snippet).toContain('MCP');
    expect(result.heading).toBeNull();
    db.close();
  });

  it('respects maxLen parameter', () => {
    const db = createTestDb();
    const longContent = 'word '.repeat(200);
    const result = extractSmartSnippet(db, '/test.md', longContent, ['word'], 100);
    expect(result.snippet.length).toBeLessThanOrEqual(106); // 100 + "..." prefix/suffix
    db.close();
  });
});
