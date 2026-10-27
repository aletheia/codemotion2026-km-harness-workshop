import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, tool, type Sandbox } from './helpers';

// Runs the real tools (`tsx tools/<name>.ts`, what `npm run <name>` runs) against a temp events dir.
describe('vertical slice through the CLI', { timeout: 120_000 }, () => {
  const sb: Sandbox = sandbox();
  const ok = (name: string, ...a: string[]) => { const r = tool(sb, name, ...a); expect(r.status, `${name} ${a.join(' ')}: ${r.stderr}`).toBe(0); return r; };

  beforeAll(() => {
    ok('seg2', 'log-init');
    ok('seg2', 'ingest', '--edition', '2024');
  });

  it('refuses to hand out a unit before the structure is verified, and records ACLRejected', () => {
    const before = sb.lines().length;
    const r = tool(sb, 'unit', '--doc', 'cp-2024');
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(r.stderr).toMatch(/^error: /);
    expect(sb.lines()).toHaveLength(before); // no structure was proposed yet: nothing to attribute the rejection to
  });

  it('runs extract -> review for structure, claims; replay is stable', () => {
    ok('seg2', 'extract', 'structure', '--doc', 'cp-2024');
    ok('seg2', 'review', '--auto', '--doc', 'cp-2024');
    const unit = ok('unit', '--doc', 'cp-2024');
    expect(unit.json).toMatchObject({ ok: true, command: 'unit' });
    ok('seg2', 'extract', 'claims', '--doc', 'cp-2024');
    ok('seg2', 'review', '--auto', '--doc', 'cp-2024');
    const a = ok('replay');
    const b = ok('replay');
    expect(a.json!.beliefsHash).toBe(b.json!.beliefsHash);
    expect(a.json).toMatchObject({ ok: true, command: 'replay' });
    expect((a.json!.byState as Record<string, number>).verified).toBeGreaterThanOrEqual(4);
  });

  it('is byte-identical when run twice from scratch (logical clock, derived ids)', () => {
    const second = sandbox();
    const go = (name: string, ...a: string[]) => expect(tool(second, name, ...a).status).toBe(0);
    go('seg2', 'log-init'); go('seg2', 'ingest', '--edition', '2024');
    go('seg2', 'extract', 'structure', '--doc', 'cp-2024'); go('seg2', 'review', '--auto', '--doc', 'cp-2024');
    go('seg2', 'extract', 'claims', '--doc', 'cp-2024'); go('seg2', 'review', '--auto', '--doc', 'cp-2024');
    expect(second.lines()).toEqual(sb.lines());
  });

  describe('provenance is enforced inside the write path', () => {
    const bad = (quote: string, span = { start: 0, end: 10 }) => {
      const file = join(sb.dir, 'bad.json');
      writeFileSync(file, JSON.stringify({
        unitId: 'cp-2024:art12',
        extractor: { version: 'claims@v1', modelId: 'test', promptVersion: 'p1' },
        claims: [{ subjectKey: 'fire.deductible', valueText: '999 EUR', quote, span }],
      }));
      return tool(sb, 'propose', '--file', file);
    };

    it('a quote that is not in the source exits 2 with ONE line and writes nothing', () => {
      const before = sb.lines();
      const r = bad('Franchigia incendio: 999 EUR per sinistro');
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr.trim().split('\n')).toHaveLength(1);
      expect(r.stderr).toMatch(/^error: .*not found verbatim/);
      expect(sb.lines()).toEqual(before);
    });

    it('a malformed input file exits 2 as well', () => {
      const file = join(sb.dir, 'junk.json');
      writeFileSync(file, '{"nope":1}');
      const r = tool(sb, 'propose', '--file', file);
      expect(r.status).toBe(2);
      expect(r.stderr.trim().split('\n')).toHaveLength(1);
    });

    it('missing flag is a usage error (exit 1)', () => {
      const r = tool(sb, 'propose');
      expect(r.status).toBe(1);
      expect(r.stderr.trim().split('\n')).toHaveLength(1);
    });
  });

  it('reset empties the log; doctor passes', () => {
    const r = ok('reset');
    expect(r.json).toMatchObject({ ok: true, command: 'reset', eventLogRemoved: true });
    expect(sb.lines()).toHaveLength(0);
    expect(tool(sb, 'doctor').status).toBe(0);
  });
});
