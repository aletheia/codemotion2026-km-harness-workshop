import { beforeAll, describe, expect, it } from 'vitest';
import { classify, auditSampled, sameTreeShape } from '../src/harness/compare';
import { batchGate, gateLine } from '../src/harness/eval/batchGate';
import { checkMayEmit } from '../src/domain/policy';
import { normalize } from '../src/domain/value';
import { asDocumentId } from '../src/domain/ids';
import { config } from '../src/config';
import { read, root, sandbox, tool, type Sandbox } from './helpers';
import { join } from 'node:path';

const span = (v: string, s: number, e: number) => ({ documentId: asDocumentId('d'), version: v, start: s, end: e });
const subj = (v: string, value = '10 %') => ({ subjectKey: 'theft.coinsurance', value: normalize(value), span: span(v, 100, 140) });
const belief = (value = '10 %') => ({ claimId: 'b1', value: normalize(value), span: span('2024', 100, 140) });

describe('segment 3: comparator (pure)', () => {
  it('classifies A, B, C and UNEXPECTED', () => {
    expect(classify(subj('2025'), belief(), true, 0.8).cls).toBe('A');
    expect(classify(subj('2025'), undefined, true, 0.8).cls).toBe('B');
    expect(classify(subj('2025', '15 %'), belief(), true, 0.8).cls).toBe('C');
    expect(classify(subj('2025'), belief(), false, 0.8).cls).toBe('UNEXPECTED');
  });
  it('equal values written differently are still class A (comparison is on normalized values)', () => {
    expect(classify({ subjectKey: 'liability.limit', value: normalize('1.000.000 EUR'), span: span('2025', 0, 10) }, { claimId: 'b', value: normalize('1,000,000 EUR'), span: span('2024', 0, 10) }, true, 0.8).cls).toBe('A');
  });
  it('within one document version a class-A match also needs span IoU >= theta', () => {
    const same = { claimId: 'b', value: normalize('10 %'), span: span('2024', 100, 140) };
    expect(classify({ subjectKey: 'x.y', value: normalize('10 %'), span: span('2024', 100, 140) }, same, true, 0.8).cls).toBe('A');
    expect(classify({ subjectKey: 'x.y', value: normalize('10 %'), span: span('2024', 300, 340) }, same, true, 0.8).cls).toBe('B');
  });
  it('tree shape ignores offsets but not titles or order', () => {
    const n = (path: string, title: string, start: number) => ({ path, type: 'article' as const, title, start, end: start + 5 });
    expect(sameTreeShape([n('a', 'A', 0), n('b', 'B', 5)], [n('a', 'A', 0), n('b', 'B', 9)])).toBe(true);
    expect(sameTreeShape([n('a', 'A', 0), n('b', 'B', 5)], [n('a', 'A', 0), n('b', 'C', 5)])).toBe(false);
    expect(sameTreeShape([n('a', 'A', 0), n('b', 'B', 5)], [n('b', 'B', 0), n('a', 'A', 5)])).toBe(false);
  });
  it('audit sampling is 100 % at rate 1, 0 at rate 0, and deterministic in between', () => {
    expect(auditSampled('00ff00ff00ff00ff', 1)).toBe(true);
    expect(auditSampled('00ff00ff00ff00ff', 0)).toBe(false);
    expect(auditSampled('12345678abcdef00', 0.05)).toBe(auditSampled('12345678abcdef00', 0.05));
  });
  it('the harness may emit class-A verification, never a human-evidence verification, and agents never decide', () => {
    expect(checkMayEmit('ClaimVerified', 'harness', 'class-A')).toBeNull();
    expect(checkMayEmit('ClaimVerified', 'harness', 'human')).not.toBeNull();
    expect(checkMayEmit('ClaimVerified', 'agent', 'class-A')).not.toBeNull();
    expect(checkMayEmit('ExtractorVersionPromoted', 'harness', 'class-A')).not.toBeNull();
  });
});

describe('segment 3: batch gate (pure)', () => {
  it('is not applicable below the probe minimum, with the exact line from the run sheet', () => {
    const g = batchGate(4, undefined);
    expect(g).toEqual({ kind: 'not-applicable', goldenItems: 4, minimum: 10 });
    expect(gateLine(g)).toBe('batch gate: not applicable (golden set 4 expected items < minimum 10); class-A audit sampling 100 %');
    expect(config.sampling.belowProbeMinimum).toBe(1);
  });
  it('at or above the minimum it is count based: FN <= 1, FP <= 1, no critical errors', () => {
    expect(batchGate(10, { counts: { tp: 8, fp: 1, fn: 1 }, criticalErrors: 0 }).kind).toBe('passed');
    expect(batchGate(10, { counts: { tp: 8, fp: 2, fn: 0 }, criticalErrors: 0 }).kind).toBe('rejected');
    expect(batchGate(10, { counts: { tp: 8, fp: 0, fn: 2 }, criticalErrors: 0 }).kind).toBe('rejected');
    expect(batchGate(10, { counts: { tp: 9, fp: 0, fn: 0 }, criticalErrors: 1 }).kind).toBe('rejected');
  });
  it('refuses to guess a probe result', () => {
    expect(() => batchGate(10, undefined)).toThrow(/probe result is required/);
  });
});

interface Ev { seq: number; type: string; actor: { kind: string; id: string }; payload: Record<string, unknown>; evidence?: Record<string, unknown>; causationId: string | null; eventId: string }

describe('segment 3: the log through the CLI', { timeout: 240_000 }, () => {
  let sb: Sandbox;
  const events = (): Ev[] => sb.lines().map((l) => JSON.parse(l) as Ev);
  const must = (name: string, ...a: string[]) => { const r = tool(sb, name, ...a); expect(r.status, `${name} ${a.join(' ')}: ${r.stderr}`).toBe(0); return r; };
  let afterCompare: Ev[] = [];
  let cmp: Record<string, unknown> = {};
  let afterExtract = 0;

  beforeAll(() => {
    sb = sandbox();
    must('seg2', 'log-init');
    must('seg2', 'ingest', '--edition', '2024');
    must('seg2', 'extract', 'structure', '--doc', 'cp-2024');
    must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg2', 'extract', 'claims', '--doc', 'cp-2024');
    must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg3', 'ingest', '--edition', '2025');
  });

  it('refuses claims extraction for 2025 before the structure is verified (exit 2, one stderr line)', () => {
    const r = tool(sb, 'seg3', 'extract', '--layers', 'claims', '--doc', 'cp-2025');
    expect(r.status).toBe(2);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(events().filter((e) => e.type === 'ACLRejected')).toHaveLength(0); // no tree yet: nothing to attribute the rejection to
  });

  it('extract structure,claims: the harness reconfirms the 2025 tree (class A), then six proposals', () => {
    must('seg3', 'extract', '--layers', 'structure,claims', '--doc', 'cp-2025', '--section', 'art12');
    afterExtract = events().length;
    const ev = events();
    const sv = ev.filter((e) => e.type === 'StructureVerified');
    expect(sv.map((e) => e.actor.kind)).toEqual(['human', 'harness']);
    expect(sv[1]!.evidence).toMatchObject({ kind: 'class-A', gate: 'not-applicable', auditSampled: true });
    const proposed = ev.filter((e) => e.type === 'ClaimProposed' && (e.payload.documentId as string) === 'cp-2025');
    expect(proposed.map((e) => `${e.payload.subjectKey}=${e.payload.valueText}`)).toEqual([
      'fire.deductible=750 EUR', 'theft.deductible=250 EUR', 'theft.coinsurance=10 %', 'liability.limit=1.000.000 EUR', 'hail.deductible=300 EUR', 'weather.coinsurance=5 %',
    ]);
    for (const p of proposed) { expect(p.actor.kind).toBe('agent'); expect(p.causationId).toBe(sv[1]!.eventId); }
  });

  it('compare: three harness verifications with evidence, one contestation, two proposals queued, gate line printed', () => {
    const r = must('compare');
    cmp = r.json!;
    expect(cmp.counts).toEqual({ A: 3, B: 2, C: 1, UNEXPECTED: 0 });
    expect(cmp.gate).toBe('batch gate: not applicable (golden set 4 expected items < minimum 10); class-A audit sampling 100 %');
    afterCompare = events().slice(afterExtract);
    expect(afterCompare.map((e) => `${e.type}:${e.actor.kind}`)).toEqual([
      'ClaimContested:harness',
      'ClaimVerified:harness', 'ClaimSuperseded:harness',
      'ClaimVerified:harness', 'ClaimSuperseded:harness',
      'ClaimVerified:harness', 'ClaimSuperseded:harness',
    ]);
    for (const e of afterCompare.filter((x) => x.type === 'ClaimVerified')) {
      expect(e.evidence).toMatchObject({ kind: 'class-A', gate: 'not-applicable', auditSampled: true });
      expect((e.evidence as { reconfirmed: { claimId?: string } }).reconfirmed.claimId).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(afterCompare[0]!.evidence).toMatchObject({ kind: 'class-C', beliefValue: '500 EUR', proposedValue: '750 EUR' });
  });

  it('at that point 500 is still the verified belief and 750 is contested (class C is a human decision)', () => {
    const s = must('replay').json!;
    expect(s.byState).toEqual({ proposed: 4, verified: 4, contested: 1, superseded: 3 });
  });

  it('compare is idempotent: a second run writes nothing', () => {
    const before = events().length;
    must('compare');
    expect(events().length).toBe(before);
  });

  it('review resolves the contested claim: 750 verified by a human, 500 superseded with 750 as successor', () => {
    must('seg3', 'review', '--auto');
    const tail = events().slice(-2);
    expect(tail.map((e) => `${e.type}:${e.actor.kind}`)).toEqual(['ClaimVerified:human', 'ClaimSuperseded:human']);
    expect(tail[1]!.evidence).toMatchObject({ kind: 'supersession', reason: 'human-resolution' });
    const s = must('replay').json!;
    expect(s.byState).toEqual({ proposed: 4, verified: 4, contested: 0, superseded: 4 });
    expect(s.currentBeliefs).toBe(4);
  });

  it('replay is stable: the beliefs hash does not change between two replays', () => {
    expect(must('replay').json!.beliefsHash).toBe(must('replay').json!.beliefsHash);
  });

  it('layers-4-6 prints a hand-written excerpt marked precomputed and does not touch the log', () => {
    const n = events().length;
    const r = must('seg3', 'layers-4-6');
    const evs = r.json!.events as { precomputed: boolean; type: string; actor: { kind: string } }[];
    expect(evs.length).toBeGreaterThanOrEqual(5);
    expect(evs.every((e) => e.precomputed === true)).toBe(true);
    expect(evs.filter((e) => e.type.endsWith('Proposed')).every((e) => e.actor.kind === 'agent')).toBe(true);
    expect(events().length).toBe(n);
  });

  it('fallback files for segment 3 exist', () => {
    for (const f of ['log-after-extract-2025.jsonl', 'log-after-compare.jsonl', 'layers-4-6.jsonl']) expect(read(join(root, 'fallback/seg3', f)).length).toBeGreaterThan(100);
  });
});
