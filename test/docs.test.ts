import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { read, root } from './helpers';

describe('README', () => {
  const readme = read(join(root, 'README.md'));
  it('has the detached-HEAD line', () => expect(readme).toContain('git switch -c mio-lavoro seg3-start'));
  it('has the three-class table and the golden-set definition', () => {
    expect(readme).toMatch(/\| A \| reconfirmation/);
    expect(readme).toMatch(/\| B \| novelty/);
    expect(readme).toMatch(/\| C \| conflict/);
    expect(readme).toMatch(/a query over the event log, not a file/);
  });
  it('labels what is not verified', () => expect(readme).toMatch(/Not verified/i));
});

describe('DECISIONS.md', () => {
  it('records the five defaults', () => {
    const d = read(join(root, 'DECISIONS.md'));
    for (const k of ['Cold-start batch gate', 'valid-time', 'Actor kind `process`', 'eval` coordinates', 'run-sheet change #8']) expect(d).toContain(k);
  });
});

describe('package.json', () => {
  const pkg = JSON.parse(read(join(root, 'package.json'))) as { engines: { node: string }; scripts: Record<string, string>; devDependencies: Record<string, string> };
  it('pins node, keeps tsx local, and every script is a one-liner', () => {
    expect(pkg.engines.node).toMatch(/^>=20/);
    expect(read(join(root, '.nvmrc')).trim()).toMatch(/^20\./);
    expect(pkg.devDependencies.tsx).toBeDefined();
    for (const [name, cmd] of Object.entries(pkg.scripts)) expect(cmd, name).toMatch(/^(tsx tools\/[\w./-]+\.ts|vitest run|tsc --noEmit)$/);
  });
});
