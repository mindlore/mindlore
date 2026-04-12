'use strict';

/**
 * mindlore-model-router — PreToolUse (Agent) hook
 * Overrides model for [mindlore:SKILL] marked Agent spawns.
 */

const fs = require('fs');
const { findMindloreDir, readConfig, DEFAULT_MODELS } = require('./lib/mindlore-common.cjs');

const SKILL_KEYS = Object.keys(DEFAULT_MODELS).filter((k) => k !== 'default');
const MARKER_REGEX = new RegExp(`\\[mindlore:(${SKILL_KEYS.join('|')})\\]`);

function main() {
  const mindloreDir = findMindloreDir();
  if (!mindloreDir) return;

  let input;
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) return;
    input = JSON.parse(raw);
  } catch (_err) {
    return;
  }

  const toolName = input.tool_name || '';
  if (toolName !== 'Agent') return;

  const toolInput = input.tool_input || {};
  const prompt = toolInput.prompt || '';
  const match = prompt.match(MARKER_REGEX);
  if (!match) return;

  const skill = match[1];

  // Resolve model: config.json → config default → hardcoded
  const config = readConfig(mindloreDir);
  const models = (config && config.models) || {};
  const model = models[skill] || models.default || DEFAULT_MODELS[skill] || DEFAULT_MODELS.default;

  const updatedInput = { ...toolInput, model: model };

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: updatedInput,
    },
  };

  process.stdout.write(JSON.stringify(output));
}

main();
