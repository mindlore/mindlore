import { z } from 'zod';
import { QUALITY_VALUES } from './constants.js';

const qualityEnum = z.enum(QUALITY_VALUES).optional();
const tagsField = z.union([z.string(), z.array(z.string())]).optional();
const dateField = z.string().optional();

export const rawSchema = z.object({
  type: z.literal('raw'),
  slug: z.string(),
  source_url: z.string().optional(),
  date_captured: dateField,
  tags: tagsField,
});

export const sourceSchema = z.object({
  type: z.literal('source'),
  slug: z.string(),
  title: z.string().optional(),
  source_url: z.string().optional(),
  source_type: z.string().optional(),
  date_captured: dateField,
  tags: tagsField,
  quality: qualityEnum,
  description: z.string().optional(),
});

export const domainSchema = z.object({
  type: z.literal('domain'),
  slug: z.string(),
  title: z.string().optional(),
  tags: tagsField,
  description: z.string().optional(),
});

export const analysisSchema = z.object({
  type: z.literal('analysis'),
  slug: z.string(),
  title: z.string().optional(),
  date: dateField,
  tags: tagsField,
  description: z.string().optional(),
});

export const diarySchema = z.object({
  type: z.literal('diary'),
  slug: z.string(),
  date: dateField,
});

export const decisionSchema = z.object({
  type: z.literal('decision'),
  slug: z.string(),
  title: z.string().optional(),
  date: dateField,
  status: z.enum(['active', 'superseded']).optional(),
  supersedes: z.string().optional(),
  tags: tagsField,
});

export const insightSchema = z.object({
  type: z.literal('insight'),
  slug: z.string(),
  title: z.string().optional(),
  tags: tagsField,
  description: z.string().optional(),
});

export const connectionSchema = z.object({
  type: z.literal('connection'),
  slug: z.string(),
  date_created: dateField,
  sources: z.union([z.string(), z.array(z.string())]).optional(),
  domains: z.union([z.string(), z.array(z.string())]).optional(),
  strength: z.enum(['high', 'medium', 'low']).optional(),
  tags: tagsField,
});

export const learningSchema = z.object({
  type: z.literal('learning'),
  slug: z.string(),
  title: z.string().optional(),
  tags: tagsField,
  description: z.string().optional(),
});

export const FRONTMATTER_SCHEMAS: Record<string, z.ZodObject<z.ZodRawShape>> = {
  raw: rawSchema,
  source: sourceSchema,
  domain: domainSchema,
  analysis: analysisSchema,
  diary: diarySchema,
  decision: decisionSchema,
  insight: insightSchema,
  connection: connectionSchema,
  learning: learningSchema,
};

// FrontmatterType is canonically defined in constants.ts
export type { FrontmatterType } from './constants.js';

/**
 * Validate frontmatter against its type schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateFrontmatter(meta: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const type = typeof meta.type === 'string' ? meta.type : undefined;
  if (!type) return { valid: false, errors: ['Missing "type" field in frontmatter'] };

  const schema = FRONTMATTER_SCHEMAS[type];
  if (!schema) return { valid: false, errors: [`Unknown frontmatter type: "${type}"`] };

  const result = schema.safeParse(meta);
  if (result.success) return { valid: true, errors: [] };

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );
  return { valid: false, errors };
}
