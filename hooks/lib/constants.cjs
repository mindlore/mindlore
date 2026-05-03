'use strict';

const EPISODE_KINDS = [
  'session', 'decision', 'event', 'preference',
  'learning', 'friction', 'discovery', 'nomination',
  'session-summary'
];

function isValidKind(kind) {
  return typeof kind === 'string' && EPISODE_KINDS.includes(kind);
}

const DB_BUSY_TIMEOUT_MS = 2000;

module.exports = { EPISODE_KINDS, isValidKind, DB_BUSY_TIMEOUT_MS };
