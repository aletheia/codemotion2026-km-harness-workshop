import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listTs, read, root } from './helpers';

// Import direction. Pure layers know nothing about adapters, app or tools; app may use adapters; tools use app.
const PURE = ['src/domain', 'src/events', 'src/catalog', 'src/acl', 'src/projections', 'src/agents', 'src/fixtures-gen'];
const PURE_FILES = ['src/config.ts'];
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
  const out: string[] = [];
  const text = read(file);
  for (const m of text.matchAll(IMPORT)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}
function area(abs: string): string {
  const rel = relative(root, abs).replace(/\\/g, '/');
  const parts = rel.split('/');
  return parts[0] === 'src' ? `src/${parts[1]!.replace(/\.ts$/, '')}` : parts[0]!;
}
const pureAreas = new Set([...PURE, ...PURE_FILES.map((f) => f.replace(/\.ts$/, ''))]);

describe('import direction', () => {
  const pureFiles = [...PURE.flatMap((d) => listTs(join(root, d))), ...PURE_FILES.map((f) => join(root, f))];

  it('finds the pure files', () => expect(pureFiles.length).toBeGreaterThan(20));

  it('pure layers never import adapters, app or tools', () => {
    const bad: string[] = [];
    for (const f of pureFiles) {
      for (const spec of importsOf(f)) {
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(f), spec);
        if (!pureAreas.has(area(target))) bad.push(`${relative(root, f)} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('pure layers use no I/O: only node:crypto and zod are allowed from outside', () => {
    const bad: string[] = [];
    for (const f of pureFiles) {
      for (const spec of importsOf(f)) {
        if (spec.startsWith('.')) continue;
        if (spec !== 'node:crypto' && spec !== 'zod') bad.push(`${relative(root, f)} imports ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('src never imports from tools; adapters never import app', () => {
    const bad: string[] = [];
    for (const f of listTs(join(root, 'src'))) {
      for (const spec of importsOf(f)) {
        if (!spec.startsWith('.')) continue;
        const a = area(resolve(dirname(f), spec));
        if (a === 'tools') bad.push(`${relative(root, f)} -> ${spec}`);
        if (relative(root, f).startsWith('src/adapters') && a === 'src/app') bad.push(`${relative(root, f)} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the test would catch a violation (self-check of the matcher)', () => {
    const sample = "import { x } from '../adapters/eventLog';\nimport fs from 'node:fs';";
    const specs = [...sample.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);
    expect(specs).toEqual(['../adapters/eventLog', 'node:fs']);
    expect(pureAreas.has(area(resolve(root, 'src/domain', '../adapters/eventLog')))).toBe(false);
  });
});
