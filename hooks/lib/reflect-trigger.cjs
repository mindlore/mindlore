const { REFLECT_THRESHOLD_DAYS, NUDGE_COOLDOWN_HOURS } = require('../../dist/scripts/lib/constants.js');

function isValidDate(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime());
}

function shouldNudgeReflect(lastReflectIso, lastNudgeIso, now = new Date()) {
  let needsReflect;
  if (!lastReflectIso) {
    needsReflect = true;
  } else if (!isValidDate(lastReflectIso)) {
    return false;
  } else {
    const daysSince = (now.getTime() - new Date(lastReflectIso).getTime()) / 86400000;
    needsReflect = daysSince >= REFLECT_THRESHOLD_DAYS;
  }
  if (!needsReflect) return false;

  if (lastNudgeIso && isValidDate(lastNudgeIso)) {
    const hoursSinceNudge = (now.getTime() - new Date(lastNudgeIso).getTime()) / 3600000;
    if (hoursSinceNudge < NUDGE_COOLDOWN_HOURS) return false;
  }
  return true;
}

module.exports = { shouldNudgeReflect, REFLECT_THRESHOLD_DAYS, NUDGE_COOLDOWN_HOURS };
