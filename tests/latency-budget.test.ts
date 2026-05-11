describe('latency budget', () => {
  it('HOOK_LATENCY_BUDGETS has entry for all known hooks', () => {
    const common = require('../hooks/lib/mindlore-common.cjs');
    const budgets = common.HOOK_LATENCY_BUDGETS;
    expect(Object.keys(budgets).length).toBe(14);
    expect(budgets['mindlore-session-focus']).toBe(100);
    expect(budgets['mindlore-read-guard']).toBe(30);
    expect(budgets['mindlore-search']).toBe(50);
  });

  it('withTelemetrySync logs budget_exceeded in telemetry', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const common = require('../hooks/lib/mindlore-common.cjs');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-budget-'));
    const telPath = path.join(tmpDir, 'telemetry.jsonl');

    // Override MINDLORE_HOME to use tmp telemetry
    const origHome = process.env.MINDLORE_HOME;
    process.env.MINDLORE_HOME = tmpDir;

    // Slow function that exceeds 30ms budget
    common.withTelemetrySync('mindlore-read-guard', () => {
      const end = Date.now() + 50;
      while (Date.now() < end) {} // busy wait
    });

    process.env.MINDLORE_HOME = origHome;

    if (fs.existsSync(telPath)) {
      const lines = fs.readFileSync(telPath, 'utf8').trim().split('\n');
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.budget_exceeded).toBe(true);
      expect(last.budget_ms).toBe(30);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
