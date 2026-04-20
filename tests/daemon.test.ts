describe('daemon constants', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const constants = require('../dist/scripts/lib/constants.js');

  it('should define DAEMON_PORT_FILE inside mindlore dir', () => {
    expect(constants.DAEMON_PORT_FILE).toContain('mindlore-daemon.port');
  });

  it('should define DAEMON_PID_FILE inside mindlore dir', () => {
    expect(constants.DAEMON_PID_FILE).toContain('mindlore-daemon.pid');
  });

  it('should define DAEMON_TIMEOUT_MS as 300', () => {
    expect(constants.DAEMON_TIMEOUT_MS).toBe(300);
  });

  it('should define DAEMON_HOST as 127.0.0.1', () => {
    expect(constants.DAEMON_HOST).toBe('127.0.0.1');
  });
});
