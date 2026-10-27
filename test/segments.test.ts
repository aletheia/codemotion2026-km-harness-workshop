import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scriptNarration } from '../src/tools/narration';
import { segments } from '../src/tools/segments';

const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
const built = (name: string): boolean => scripts[name] !== undefined && !scripts[name]!.includes('not-implemented');
const steps = Object.values(segments).flatMap((s) => s.steps);

describe('segment runner', () => {
  it('runs only scripts this checkout has built', () => {
    for (const step of steps) {
      expect(built(step.script), step.script).toBe(true);
      if (step.auto) expect(built(step.auto), step.auto).toBe(true);
    }
  });

  it('narrates every step it runs, and only scripts this checkout has built', () => {
    for (const step of steps) expect(scriptNarration[step.script], step.script).toBeDefined();
    for (const name of Object.keys(scriptNarration)) expect(built(name), name).toBe(true);
  });
});
