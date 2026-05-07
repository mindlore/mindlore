"use strict";

// hooks/src/mindlore-model-router.cjs
var fs = require("fs");
var { findMindloreDir, readConfig, DEFAULT_MODELS, hookLog, withTelemetrySync } = require("./lib/mindlore-common.cjs");
var SKILL_KEYS = Object.keys(DEFAULT_MODELS).filter((k) => k !== "default");
var MARKER_REGEX = new RegExp(`\\[mindlore:(${SKILL_KEYS.join("|")})\\]`);
function main() {
  const mindloreDir = findMindloreDir();
  if (!mindloreDir) return;
  let input;
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) return;
    input = JSON.parse(raw);
  } catch (_err) {
    return;
  }
  const toolName = input.tool_name || "";
  if (toolName !== "Agent") return;
  const toolInput = input.tool_input || {};
  const prompt = toolInput.prompt || "";
  const match = prompt.match(MARKER_REGEX);
  if (!match) return;
  const skill = match[1];
  const config = readConfig(mindloreDir);
  const models = config && config.models || {};
  const model = models[skill] || models.default || DEFAULT_MODELS[skill] || DEFAULT_MODELS.default;
  const updatedInput = { ...toolInput, model };
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput
    }
  };
  process.stdout.write(JSON.stringify(output));
}
try {
  withTelemetrySync("mindlore-model-router", main);
} catch (err) {
  hookLog("model-router", "error", err?.message ?? String(err));
}
