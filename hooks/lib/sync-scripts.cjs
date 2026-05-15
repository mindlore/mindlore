const fs = require('fs');
const path = require('path');

function getSyncScripts(hooksDir) {
  if (!fs.existsSync(hooksDir)) return [];
  return fs.readdirSync(hooksDir)
    .filter(f => f.startsWith('mindlore-') && f.endsWith('.cjs'))
    .map(f => path.join(hooksDir, f))
    .sort();
}

module.exports = { getSyncScripts };
