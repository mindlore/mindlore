/**
 * Integration smoke test — only runs when @huggingface/transformers installed.
 * Skips automatically if package missing (dev environment guard).
 */
let pkgAvailable = false;
try {
  require.resolve('@huggingface/transformers');
  pkgAvailable = true;
} catch { /* skip */ }

(pkgAvailable ? describe : describe.skip)('HF Transformers smoke', () => {
  test('Xenova/multilingual-e5-small loads from HF package', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
      dtype: 'q8',
    } as any);
    const result = await (embedder as any)(['passage: hello'], { pooling: 'mean', normalize: true });
    const list = result.tolist();
    expect(list[0]).toHaveLength(384);
  }, 60_000);

  test('alternative ID intfloat/multilingual-e5-small loads', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const embedder = await pipeline('feature-extraction', 'intfloat/multilingual-e5-small');
    const result = await (embedder as any)(['passage: hello'], { pooling: 'mean', normalize: true });
    expect(result.tolist()[0]).toHaveLength(384);
  }, 60_000);
});

let embeddingAvailable = false;
try {
  require('@huggingface/transformers');
  embeddingAvailable = true;
} catch { /* ESM-only module — Jest CJS mode cannot load it */ }

(embeddingAvailable ? describe : describe.skip)('embedding drift check', () => {
  test('cosine >=0.99 vs reference v2 embedding', async () => {
    const refPath = require('path').join(__dirname, 'fixtures/embedding-v2-reference.json');
    expect(require('fs').existsSync(refPath)).toBe(true);
    const ref: number[] = JSON.parse(require('fs').readFileSync(refPath, 'utf8'));
    const { generateEmbedding } = await import('../scripts/lib/embedding.js');
    const fresh = await generateEmbedding('passage: mindlore test');
    let dot = 0;
    for (let i = 0; i < ref.length; i++) dot += (ref[i] ?? 0) * (fresh[i] ?? 0);
    expect(dot).toBeGreaterThanOrEqual(0.99);
  }, 60_000);
});
