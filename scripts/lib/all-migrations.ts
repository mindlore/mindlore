import type { Migration } from './schema-version.js';
import { V050_MIGRATIONS, V051_MIGRATIONS } from './migrations.js';
import { V052_MIGRATIONS } from './migrations-v052.js';
import { V053_MIGRATIONS } from './migrations-v053.js';
import { V061_MIGRATIONS } from './migrations-v061.js';
import { V062_MIGRATIONS } from './migrations-v062.js';
import { V063_MIGRATIONS } from './migrations-v063.js';
import { V066_MIGRATIONS } from './migrations-v066.js';

// All migrations — single source of truth
export const ALL_MIGRATIONS: Migration[] = [
  ...V050_MIGRATIONS,
  ...V051_MIGRATIONS,
  ...V052_MIGRATIONS,
  ...V053_MIGRATIONS,
  ...V061_MIGRATIONS,
  ...V062_MIGRATIONS,
  ...V063_MIGRATIONS,
  ...V066_MIGRATIONS,
];

// V062 v9 (episodes_session_summary) ve V066 v14 (episode_inject_log) require episodes table
const EPISODES_DEPENDENT = new Set([9, 14]);
export const FTS_DB_MIGRATIONS: Migration[] = ALL_MIGRATIONS.filter(m => !EPISODES_DEPENDENT.has(m.version));

// Init/upgrade migrations — episodes tablosu olan DB (init.ts)
export const INIT_MIGRATIONS: Migration[] = [
  ...V062_MIGRATIONS,
  ...V063_MIGRATIONS,
  ...V066_MIGRATIONS,
];

export const EXPECTED_SCHEMA_VERSION = Math.max(...ALL_MIGRATIONS.map(m => m.version));
