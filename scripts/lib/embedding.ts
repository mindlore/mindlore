export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIM = 384;

// Pipeline instance — cached after first load (~16s)
let cachedPipeline: unknown = null;

async function getEmbedder(): Promise<unknown> {
  if (cachedPipeline) return cachedPipeline;

  // Dynamic import — @xenova/transformers is ESM
  const { pipeline: createPipeline } = await import('@xenova/transformers');
  cachedPipeline = await createPipeline('feature-extraction', EMBEDDING_MODEL, {
    quantized: true, // int8 quantization — smaller, faster
  });
  return cachedPipeline;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  // multilingual-e5-small expects "query: " or "passage: " prefix
  const prefixed = text.startsWith('query:') || text.startsWith('passage:')
    ? text
    : `passage: ${text}`;
  // Pipeline is callable — returns Tensor with tolist()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- @xenova/transformers pipeline is callable but untyped
  const run = embedder as (input: string[], opts: Record<string, unknown>) => Promise<{ tolist: () => number[][] }>;
  // normalize: true in pipeline options already returns L2-normalized vectors
  const result = await run([prefixed], { pooling: 'mean', normalize: true });
  const list = result.tolist();
  const raw = list[0];
  if (!raw) throw new Error('Embedding pipeline returned empty result');
  return raw;
}

export async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
