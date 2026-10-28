// AGENTS.md §1.2: agents never verify. No file under src/agents may import a decision-event constructor (the
// schemas of decisionSchemas), the log's append, or a process that emits decisions (compare, review, eval).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decisionSchemas } from '../src/events/schema';

const decisionNames: readonly string[] = decisionSchemas.map((s) => s.shape.type.value);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? sources(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []);

interface Import { file: string; from: string; names: string[]; typeOnly: boolean }

/** Every static and dynamic import of a file, with its named bindings (`*` for a namespace or default import). */
function importsOf(file: string): Import[] {
  const text = readFileSync(file, 'utf8');
  const found: Import[] = [];
  for (const m of text.matchAll(/^\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gmu)) {
    const clause = m[2]!;
    const braced = /\{([\s\S]*)\}/u.exec(clause)?.[1] ?? '';
    const names = braced.split(',').map((n) => n.trim()).filter(Boolean)
      .filter((n) => !n.startsWith('type '))
      .map((n) => n.split(/\s+as\s+/u)[0]!.trim());
    if (clause.replace(/\{[\s\S]*\}/u, '').replace(/[\s,]/gu, '')) names.push('*');
    found.push({ file, from: m[3]!, names, typeOnly: Boolean(m[1]) });
  }
  for (const m of text.matchAll(/(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
    found.push({ file, from: m[1]!, names: ['*'], typeOnly: false });
  }
  return found;
}

const target = (imp: Import): string => relative('src', resolve(imp.file, '..', imp.from)).replace(/\.ts$/u, '');

function violations(imp: Import): string[] {
  if (imp.typeOnly || !imp.from.startsWith('.')) return [];
  const to = target(imp);
  const values = imp.names;
  if (to === 'events/schema') return values.filter((n) => n === '*' || decisionNames.includes(n) || n === 'decisionSchemas');
  if (to === 'events/log') return values.filter((n) => n === '*' || n === 'append');
  if (to.startsWith('processes/') || to.startsWith('harness/') || to.startsWith('tools/')) return values.length ? [`* from ${to}`] : [];
  return [];
}

describe('src/agents import boundary', () => {
  const files = sources('src/agents');

  it('scans the agents', () => {
    expect(files.map((f) => relative('src/agents', f)).sort()).toEqual(['ask.ts', 'claims.ts', 'oneshot.ts', 'replayer.ts', 'structure.ts']);
    expect(decisionNames).toContain('ClaimVerified');
  });

  it('no agent imports a decision-event constructor, append, or a decision-emitting process', () => {
    const found = files.flatMap(importsOf).flatMap((imp) => violations(imp).map((v) => `${relative('.', imp.file)}: ${v} (${imp.from})`));
    expect(found).toEqual([]);
  });

  it('the check catches a forbidden import', () => {
    const imp: Import = { file: 'src/agents/x.ts', from: '../events/schema', names: ['ClaimVerified'], typeOnly: false };
    expect(violations(imp)).toEqual(['ClaimVerified']);
    expect(violations({ ...imp, from: '../processes/review', names: ['reviewAuto'] })).toEqual(['* from processes/review']);
    expect(violations({ ...imp, typeOnly: true })).toEqual([]);
  });
});
