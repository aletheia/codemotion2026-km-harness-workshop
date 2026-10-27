import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execute, renderFallback } from '../tools/dry-run';
import { read, root } from './helpers';

describe('fallback folders', { timeout: 120_000 }, () => {
  it('seg1..seg6 each have a README telling what to paste from the rehearsal', () => {
    for (let n = 1; n <= 6; n++) {
      const p = join(root, `fallback/seg${n}/README.md`);
      expect(existsSync(p), p).toBe(true);
      expect(read(p)).toMatch(/session\.md/);
    }
  });
  it('expected-output.txt equals a fresh dry-run and is labelled as deterministic tool output', () => {
    const all = execute();
    expect(all.size).toBeGreaterThan(0);
    for (const [seg, recs] of all) {
      const file = read(join(root, `fallback/seg${seg}/expected-output.txt`));
      expect(file).toBe(renderFallback(seg, recs));
      expect(file).toMatch(/DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION/);
    }
  });
});
