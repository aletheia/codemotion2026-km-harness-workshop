// End to end: the whole walkthrough through `npm run dry-run`, in a temporary working directory whose out/ is
// fresh. src/ is copied (the tools' entry-point check compares real paths); fixtures and fallback/ are linked.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLog } from '../src/events/log';

const linked = ['package.json', 'tsconfig.json', 'node_modules', 'fixtures', 'fallback'];

describe('npm run dry-run', () => {
  it('reproduces every fallback/ file from an empty out/ and leaves the log at 48 events', () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dnk-dry-run-')));
    for (const name of linked) symlinkSync(resolve(name), join(cwd, name));
    cpSync('src', join(cwd, 'src'), { recursive: true });

    const r = spawnSync('npm', ['run', '--silent', 'dry-run'], { cwd, encoding: 'utf8', env: { ...process.env, DNK_NARRATE: '0' } });

    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('dry-run: OK (byte-identical with fallback/)\n');
    expect(r.status).toBe(0);
    expect(readLog(join(cwd, 'out/events.jsonl'))).toHaveLength(48);
    expect(readFileSync(join(cwd, 'out/dry-run/seg5/eval-v1.txt'), 'utf8')).toBe(readFileSync('fallback/seg5/eval-v1.txt', 'utf8'));
    expect(existsSync(join(cwd, 'out/projections'))).toBe(true);
  }, 180_000);
});
