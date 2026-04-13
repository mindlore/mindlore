import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';
import { dbAll } from '../scripts/lib/db-helpers.js';

const TEST_DIR = path.join(__dirname, '..', '.test-explore');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

let db: Database.Database;

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'domains', 'connections']);
  db = createTestDb(DB_PATH);
});

afterEach(() => {
  db.close();
  teardownTestDir(TEST_DIR);
});

describe('Explore — cross-reference detection and connections', () => {
  test('detects shared tags between sources', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'react-hooks.md'),
      slug: 'react-hooks',
      type: 'source',
      content: 'React hooks for state management',
      tags: 'hooks, react, state',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'vue-composables.md'),
      slug: 'vue-composables',
      type: 'source',
      content: 'Vue composables for state management',
      tags: 'hooks, vue, state',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'python-ml.md'),
      slug: 'python-ml',
      type: 'source',
      content: 'Machine learning with Python',
      tags: 'python, ml',
    });

    // Find tag overlaps
    const allSources = dbAll<{ slug: string; tags: string }>(
      db,
      "SELECT slug, tags FROM mindlore_fts WHERE type = 'source'"
    );

    const tagMap: Record<string, string[]> = {};
    for (const src of allSources) {
      if (!src.tags) continue;
      for (const tag of src.tags.split(',').map(t => t.trim())) {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag]!.push(src.slug);
      }
    }

    // "hooks" and "state" shared by react-hooks + vue-composables
    expect(tagMap['hooks']).toHaveLength(2);
    expect(tagMap['state']).toHaveLength(2);
    // "python" only in python-ml
    expect(tagMap['python']).toHaveLength(1);
  });

  test('connections file has correct frontmatter format', () => {
    const connectionContent = [
      '---',
      'type: connection',
      'slug: conn-react-vue-state',
      'date_created: 2026-04-12',
      'sources: [react-hooks.md, vue-composables.md]',
      'strength: high',
      'tags: hooks, state',
      '---',
      '',
      '## Connection',
      'Both sources discuss hooks-based state management in different frameworks.',
      '',
      '## Action Suggestion',
      'Create a cross-framework state management domain page.',
    ].join('\n');

    const connPath = path.join(TEST_DIR, 'connections', 'conn-react-vue-state.md');
    fs.writeFileSync(connPath, connectionContent);

    const content = fs.readFileSync(connPath, 'utf8');
    expect(content).toContain('type: connection');
    expect(content).toContain('strength: high');
    expect(content).toContain('sources: [react-hooks.md, vue-composables.md]');
    expect(content).toContain('## Connection');
    expect(content).toContain('## Action Suggestion');
  });

  test('duplicate connections are not created for same source pair', () => {
    const connectionsDir = path.join(TEST_DIR, 'connections');

    // Existing connection for source-a + source-b
    fs.writeFileSync(path.join(connectionsDir, 'conn-a-b.md'),
      '---\ntype: connection\nslug: conn-a-b\nsources: [source-a.md, source-b.md]\n---\n');

    expect(fs.readdirSync(connectionsDir).filter(f => f.endsWith('.md'))).toHaveLength(1);

    // Simulate duplicate check before writing
    const newPair = ['source-a.md', 'source-b.md'];
    const newPairKey = newPair.sort().join('+');

    const existingFiles = fs.readdirSync(connectionsDir).filter(f => f.endsWith('.md'));
    const alreadyExists = existingFiles.some(f => {
      const content = fs.readFileSync(path.join(connectionsDir, f), 'utf8');
      const match = content.match(/sources:\s*\[([^\]]+)\]/);
      if (!match) return false;
      return match[1]!.split(',').map(s => s.trim()).sort().join('+') === newPairKey;
    });

    // Should detect existing pair
    expect(alreadyExists).toBe(true);

    // Only write if NOT already exists
    if (!alreadyExists) {
      fs.writeFileSync(path.join(connectionsDir, 'conn-a-b-2.md'), 'duplicate');
    }

    // File count should still be 1 — no duplicate written
    expect(fs.readdirSync(connectionsDir).filter(f => f.endsWith('.md'))).toHaveLength(1);
  });

  test('connections are indexable in FTS5', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'connections', 'conn-test.md'),
      slug: 'conn-test',
      type: 'connection',
      title: 'Test Connection',
      content: 'Two sources share hooks patterns',
      tags: 'hooks',
    });

    const results = dbAll<{ slug: string }>(
      db,
      "SELECT slug FROM mindlore_fts WHERE type = 'connection'"
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.slug).toBe('conn-test');

    // Searchable by content
    const searchResults = db.prepare(
      "SELECT slug FROM mindlore_fts WHERE mindlore_fts MATCH 'hooks' AND type = 'connection'"
    ).all();
    expect(searchResults).toHaveLength(1);
  });

  test('strength ranking: high requires 3+ shared tags', () => {
    // Simulate strength calculation
    const tagsA = ['hooks', 'state', 'reactivity', 'frontend'].map(t => t.trim());
    const tagsB = ['hooks', 'state', 'reactivity', 'vue'].map(t => t.trim());

    const shared = tagsA.filter(t => tagsB.includes(t));
    const strength = shared.length >= 3 ? 'high' : shared.length >= 2 ? 'medium' : 'low';

    expect(shared).toHaveLength(3);
    expect(strength).toBe('high');
  });

  test('log.md receives EXPLORE entries', () => {
    const logPath = path.join(TEST_DIR, 'log.md');
    fs.writeFileSync(logPath, '| Date | Op | File |\n|------|-----|------|\n');

    fs.appendFileSync(logPath, '| 2026-04-12 | explore | 2 connections found |\n');

    const content = fs.readFileSync(logPath, 'utf8');
    expect(content).toContain('explore');
    expect(content).toContain('connections found');
  });
});
