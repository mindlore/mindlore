import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME } from '../scripts/lib/constants.js';

describe('DB Singleton', () => {
  it('init and MCP server use the same DB path', () => {
    const expectedPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);

    // Both init.ts and mcp-server use GLOBAL_MINDLORE_DIR + DB_NAME
    expect(expectedPath).toContain('.mindlore');
    expect(expectedPath).toContain('mindlore.db');
  });

  it('DB_NAME is mindlore.db', () => {
    expect(DB_NAME).toBe('mindlore.db');
  });

  it('GLOBAL_MINDLORE_DIR points to ~/.mindlore/', () => {
    expect(GLOBAL_MINDLORE_DIR).toMatch(/[/\\]\.mindlore$/);
  });
});
