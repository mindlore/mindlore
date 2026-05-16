import { describe, it, expect } from '@jest/globals';
import { runSetupWizard } from '../scripts/lib/setup-wizard';
import { Readable, PassThrough } from 'stream';

jest.mock('readline/promises', () => ({
  createInterface: jest.fn(),
}));

const { createInterface } = jest.requireMock('readline/promises') as { createInterface: jest.Mock };

describe('setup-wizard', () => {
  beforeEach(() => {
    createInterface.mockReset();
  });

  it('returns answers from mocked stdin', async () => {
    const question = jest.fn()
      .mockResolvedValueOnce('')   // accept default home
      .mockResolvedValueOnce('myproject');  // override project name
    createInterface.mockReturnValue({ question, close: jest.fn() });

    const stdin = new Readable({ read() {} });
    const stdout = new PassThrough();
    const answers = await runSetupWizard({ stdin, stdout, defaultMindloreHome: '/default/home', cwd: '/some/project-x' });
    expect(answers).toEqual({ mindloreHome: '/default/home', projectName: 'myproject' });
  });

  it('detects project name from cwd when user accepts default', async () => {
    const question = jest.fn()
      .mockResolvedValueOnce('')   // accept default home
      .mockResolvedValueOnce('');  // accept default project
    createInterface.mockReturnValue({ question, close: jest.fn() });

    const stdin = new Readable({ read() {} });
    const stdout = new PassThrough();
    const answers = await runSetupWizard({ stdin, stdout, defaultMindloreHome: '/h', cwd: '/some/auto-detected' });
    expect(answers.projectName).toBe('auto-detected');
  });
});
