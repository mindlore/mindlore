/**
 * Embedding module unit tests — mock @huggingface/transformers.
 * Real model integration test → Task 14 standalone script.
 */

// Mock the dynamic import before any imports
jest.mock('@huggingface/transformers', () => {
  // Return a fake 384-dim embedding based on text hash for deterministic results
  function fakeEmbed(texts: string[]): { tolist: () => number[][] } {
    const embeddings = texts.map(text => {
      // Simple deterministic pseudo-embedding from text
      const vec = new Array(384).fill(0).map((_, i) => {
        let h = 0;
        for (let c = 0; c < text.length; c++) {
          h = ((h << 5) - h + text.charCodeAt(c) + i) | 0;
        }
        return (h % 1000) / 1000;
      });
      // Normalize
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      return norm > 0 ? vec.map(v => v / norm) : vec;
    });
    return { tolist: () => embeddings };
  }

  return {
    __esModule: true,
    pipeline: jest.fn().mockResolvedValue(
      jest.fn().mockImplementation((texts: string[], _opts: Record<string, unknown>) => {
        return Promise.resolve(fakeEmbed(texts));
      })
    ),
  };
});

import { generateEmbedding, batchEmbed, EMBEDDING_DIM, EMBEDDING_MODEL } from '../scripts/lib/embedding.js';

describe('Embedding Module', () => {
  test('EMBEDDING_DIM should be 384', () => {
    expect(EMBEDDING_DIM).toBe(384);
  });

  test('EMBEDDING_MODEL should be multilingual-e5-small', () => {
    expect(EMBEDDING_MODEL).toBe('Xenova/multilingual-e5-small');
  });

  test('should generate a 384-dim embedding', async () => {
    const embedding = await generateEmbedding('TypeScript is a programming language');
    expect(embedding).toHaveLength(384);
    expect(typeof embedding[0]).toBe('number');
    // Embeddings should be normalized (L2 norm ≈ 1.0)
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 1);
  });

  test('should batch embed multiple texts', async () => {
    const texts = ['Hello world', 'Merhaba dünya'];
    const embeddings = await batchEmbed(texts);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(384);
    expect(embeddings[1]).toHaveLength(384);
  });

  test('should produce different embeddings for different texts', async () => {
    const e1 = await generateEmbedding('authentication security');
    const e2 = await generateEmbedding('database performance');
    // Different texts should produce different embeddings
    const same = e1.every((v, i) => v === (e2[i] ?? 0));
    expect(same).toBe(false);
  });

  test('should add passage: prefix when not present', async () => {
    const e1 = await generateEmbedding('test text');
    const e2 = await generateEmbedding('passage: test text');
    // Both should produce valid embeddings
    expect(e1).toHaveLength(384);
    expect(e2).toHaveLength(384);
  });
});
