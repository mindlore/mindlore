import { extractSkeleton } from '../scripts/lib/skeleton';

describe('extractSkeleton', () => {
  describe('JavaScript/TypeScript', () => {
    it('keeps imports and top-level declarations', () => {
      const input = `import fs from 'fs';
import path from 'path';

const THRESHOLD = 30;

function doSomething(a: string, b: number): boolean {
  const result = a.length > b;
  if (result) {
    console.log('yes');
    return true;
  }
  return false;
}

export class MyClass {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
  getName(): string {
    return this.name;
  }
}`;

      const result = extractSkeleton(input, 'ts');
      expect(result).toContain("import fs from 'fs'");
      expect(result).toContain("import path from 'path'");
      expect(result).toContain('const THRESHOLD = 30');
      expect(result).toContain('function doSomething');
      expect(result).toContain('export class MyClass');
      expect(result).not.toContain("console.log('yes')");
      expect(result).not.toContain('return this.name');
    });

    it('keeps interface and type declarations', () => {
      const input = `interface Config {
  name: string;
  value: number;
  nested: {
    deep: boolean;
  };
}

type Result = Config | null;`;

      const result = extractSkeleton(input, 'ts');
      expect(result).toContain('interface Config');
      expect(result).toContain('type Result');
    });
  });

  describe('Python', () => {
    it('keeps imports, defs, classes', () => {
      const input = `import os
from pathlib import Path

CONSTANT = 42

def process(data: list) -> dict:
    """Process the data."""
    result = {}
    for item in data:
        result[item] = True
    return result

class Handler:
    def __init__(self, name):
        self.name = name
    def run(self):
        pass`;

      const result = extractSkeleton(input, 'py');
      expect(result).toContain('import os');
      expect(result).toContain('from pathlib import Path');
      expect(result).toContain('CONSTANT = 42');
      expect(result).toContain('def process');
      expect(result).toContain('class Handler');
      expect(result).not.toContain('for item in data');
    });
  });

  describe('Markdown', () => {
    it('keeps headings only', () => {
      const input = `# Title

Some long paragraph about something.

## Section 1

More content here with details.

### Subsection

Even more details.`;

      const result = extractSkeleton(input, 'md');
      expect(result).toContain('# Title');
      expect(result).toContain('## Section 1');
      expect(result).toContain('### Subsection');
      expect(result).not.toContain('Some long paragraph');
    });
  });

  it('returns full content for unsupported extensions', () => {
    const input = 'just plain text';
    const result = extractSkeleton(input, 'xyz');
    expect(result).toBe(input);
  });

  it('returns full content if skeleton is >75% of original', () => {
    const input = `import a from 'a';
import b from 'b';
import c from 'c';
const x = 1;`;
    const result = extractSkeleton(input, 'ts');
    expect(result).toBe(input);
  });
});
