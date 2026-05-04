import { errMsg } from '../scripts/lib/err-msg';

describe('errMsg', () => {
  it('extracts message from Error instance', () => {
    expect(errMsg(new Error('test error'))).toBe('test error');
  });

  it('converts string to string', () => {
    expect(errMsg('plain string')).toBe('plain string');
  });

  it('converts number to string', () => {
    expect(errMsg(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(errMsg(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(errMsg(undefined)).toBe('undefined');
  });

  it('converts object to string', () => {
    expect(errMsg({ code: 'ENOENT' })).toBe('[object Object]');
  });
});
