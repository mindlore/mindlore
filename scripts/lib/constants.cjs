'use strict';

/**
 * Shared constants and utilities for mindlore scripts.
 */

const os = require('os');

const MINDLORE_DIR = '.mindlore';
const DB_NAME = 'mindlore.db';

const DIRECTORIES = [
  'raw',
  'sources',
  'domains',
  'analyses',
  'insights',
  'connections',
  'learnings',
  'diary',
  'decisions',
];

const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);

const TYPE_TO_DIR = {
  raw: 'raw',
  source: 'sources',
  domain: 'domains',
  analysis: 'analyses',
  insight: 'insights',
  connection: 'connections',
  learning: 'learnings',
  decision: 'decisions',
  diary: 'diary',
};

function homedir() {
  return os.homedir();
}

module.exports = {
  MINDLORE_DIR,
  DB_NAME,
  DIRECTORIES,
  SKIP_FILES,
  TYPE_TO_DIR,
  homedir,
};
