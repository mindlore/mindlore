import * as readline from 'readline/promises';
import * as path from 'path';
import { Readable, Writable } from 'stream';

export interface SetupAnswers {
  mindloreHome: string;
  projectName: string;
}

export interface SetupWizardOpts {
  stdin: Readable;
  stdout: Writable;
  defaultMindloreHome: string;
  cwd: string;
}

export async function runSetupWizard(opts: SetupWizardOpts): Promise<SetupAnswers> {
  const rl = readline.createInterface({ input: opts.stdin, output: opts.stdout });
  const defaultProject = path.basename(opts.cwd);
  try {
    const home = (await rl.question(`Mindlore home [${opts.defaultMindloreHome}]: `)).trim() || opts.defaultMindloreHome;
    const proj = (await rl.question(`Project name [${defaultProject}]: `)).trim() || defaultProject;
    return { mindloreHome: home, projectName: proj };
  } finally {
    rl.close();
  }
}
