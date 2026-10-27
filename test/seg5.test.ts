import { beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { evaluate, intervalIoU, type ProposalView } from '../src/harness/eval/metrics';
import { drift } from '../src/harness/eval/drift';
import { goldenClaims, type GoldenClaimItem } from '../src/harness/golden';
import { foldEvents } from '../src/projections/fold';
import { normalize } from '../src/domain/value';
import type { AnyStoredEvent } from '../src/events/types';
import { read, root, sandbox, tool, type Sandbox } from './helpers';

const crit = (k: string) => k !== 'noncritical.thing';
const item = (key: string, valueText: string, start: number, end: number, doc = 'd1'): GoldenClaimItem => ({
  itemId: `i-${key}`, documentId: doc, version: '1', sectionPath: 'art12', subjectKey: key, valueText, value: normalize(valueText), span: { start, end }, verifiedBy: 'human:x', seq: 1,
});
const prop = (key: string, valueText: string, start: number, end: number, seq = 1, doc = 'd1'): ProposalView => ({
  claimId: `c-${key}-${valueText}`, documentId: doc, subjectKey: key, valueText, value: normalize(valueText), span: { start, end }, seq,
});

describe('segment 5: metrics (pure)', () => {
  it('IoU of half-open intervals: 40 / 42', () => {
    expect(intervalIoU({ start: 4240, end: 4280 }, { start: 4238, end: 4280 })).toEqual({ inter: 40, union: 42, iou: 40 / 42 });
    expect(intervalIoU({ start: 0, end: 5 }, { start: 5, end: 9 }).iou).toBe(0);
  });

  const expected = [item('fire.deductible', '500 EUR', 4240, 4280), item('theft.deductible', '250 EUR', 4281, 4320), item('theft.coinsurance', '10 %', 4321, 4360), item('liability.limit', '1.000.000 EUR', 4361, 4420)];

  it('handbook worked example, v1: TP 2, FP 2, FN 2, precision 0.50, recall 0.50', () => {
    const r = evaluate(expected, [prop('fire.deductible', '500 EUR', 4238, 4280), prop('theft.deductible', '250 EUR', 4281, 4320), prop('theft.coinsurance', '15 %', 4321, 4360), prop('hail.deductible', '300 EUR', 4430, 4460)], 0.8, crit);
    expect([r.tp, r.fp, r.fn, r.precision, r.recall]).toEqual([2, 2, 2, 0.5, 0.5]);
    expect(r.rows.map((x) => x.outcome)).toEqual(['TP', 'TP', 'WRONG', 'MISSED', 'SPURIOUS']);
    expect(r.rows[0]!.iou).toBeCloseTo(0.9524, 4);
    expect(r.rows[2]!.wrong).toBe('value');
  });

  it('handbook worked example, v2: TP 3, FP 2, FN 1, precision 0.60, recall 0.75', () => {
    const r = evaluate(expected, [prop('fire.deductible', '500 EUR', 4240, 4280), prop('theft.deductible', '2.500 EUR', 4281, 4320), prop('theft.coinsurance', '10 %', 4321, 4360), prop('liability.limit', '1.000.000 EUR', 4361, 4420), prop('theft.limit', '5.000 EUR', 4430, 4460)], 0.8, crit);
    expect([r.tp, r.fp, r.fn, r.precision, r.recall]).toEqual([3, 2, 1, 0.6, 0.75]);
  });

  it('a right value in the wrong place is a wrong pair (span), counted FP + FN, and is wrong provenance', () => {
    const r = evaluate([item('a.b', '10 %', 100, 140)], [prop('a.b', '10 %', 200, 240)], 0.8, crit);
    expect([r.tp, r.fp, r.fn]).toEqual([0, 1, 1]);
    expect(r.rows[0]!.wrong).toBe('span');
    expect([r.valueCorrectPairs, r.wrongProvenancePairs]).toEqual([1, 1]);
  });

  it('with two proposals on one subject the highest IoU wins and the other is spurious', () => {
    const r = evaluate([item('a.b', '10 %', 100, 140)], [prop('a.b', '12 %', 100, 140, 1), prop('a.b', '10 %', 102, 140, 2)], 0.8, crit);
    expect(r.rows.map((x) => `${x.outcome}:${x.proposed?.valueText}`)).toEqual(['WRONG:12 %', 'SPURIOUS:10 %']);
    const r2 = evaluate([item('a.b', '10 %', 100, 140)], [prop('a.b', '10 %', 102, 140, 1), prop('a.b', '12 %', 300, 340, 2)], 0.8, crit);
    expect(r2.rows.map((x) => x.outcome)).toEqual(['TP', 'SPURIOUS']);
  });

  it('proposals in another document never align with this document\'s expected items', () => {
    const r = evaluate([item('a.b', '10 %', 100, 140, 'd1')], [prop('a.b', '10 %', 100, 140, 1, 'd2')], 0.8, crit);
    expect([r.tp, r.fp, r.fn]).toEqual([0, 1, 1]);
  });

  it('empty denominators give 0, not NaN', () => {
    const r = evaluate([], [], 0.8, crit);
    expect([r.precision, r.recall]).toEqual([0, 0]);
  });
});

describe('segment 5: drift (pure)', () => {
  const expected = [item('fire.deductible', '500 EUR', 40, 80), item('theft.deductible', '250 EUR', 81, 120), item('theft.coinsurance', '10 %', 121, 160), item('liability.limit', '1.000.000 EUR', 161, 220)];
  const v1 = evaluate(expected, [prop('fire.deductible', '500 EUR', 38, 80), prop('theft.deductible', '250 EUR', 81, 120), prop('theft.coinsurance', '15 %', 121, 160), prop('hail.deductible', '300 EUR', 300, 330)], 0.8, crit);
  const v2 = evaluate(expected, [prop('fire.deductible', '500 EUR', 40, 80), prop('theft.deductible', '2.500 EUR', 81, 120), prop('theft.coinsurance', '10 %', 121, 160), prop('liability.limit', '1.000.000 EUR', 161, 220), prop('theft.limit', '5.000 EUR', 300, 330)], 0.8, crit);

  it('puts every item in one of the four cells', () => {
    const d = drift(v1, v2);
    expect(Object.fromEntries(d.items.map((i) => [i.subjectKey, i.cell]))).toEqual({
      'fire.deductible': 'stable', 'theft.deductible': 'regression', 'theft.coinsurance': 'improvement', 'liability.limit': 'improvement',
    });
    expect(drift(v1, v1).items.some((i) => i.cell === 'stable-wrong')).toBe(true);
  });
  it('v1 -> v2 fails criteria 1 and 3, not 2 and 4; lists the noise and the provenance drift', () => {
    const d = drift(v1, v2);
    expect(d.failed).toEqual([1, 3]);
    expect(d.meetsAll).toBe(false);
    expect(d.noise.map((n) => n.subjectKey)).toEqual(['theft.limit']);
    expect(d.provenance).toHaveLength(1);
    expect(d.provenance[0]!.subjectKey).toBe('fire.deductible');
  });
  it('a critical regression blocks promotion even when precision is above the threshold', () => {
    const only = [item('theft.deductible', '250 EUR', 81, 120)];
    const a = evaluate(only, [prop('theft.deductible', '250 EUR', 81, 120)], 0.8, crit);
    const b = evaluate(only, [prop('theft.deductible', '2.500 EUR', 81, 120)], 0.8, crit);
    const d = drift(a, { ...b, precision: 0.95, recall: 1 });
    expect(d.criteria.find((c) => c.n === 1)!.met).toBe(true);
    expect(d.failed).toContain(3);
  });
  it('a regression on a non-critical subject does not fail criterion 3', () => {
    const d = drift(evaluate([item('k.k', '1 EUR', 1, 5)], [prop('k.k', '1 EUR', 1, 5)], 0.8, () => false), evaluate([item('k.k', '1 EUR', 1, 5)], [prop('k.k', '2 EUR', 1, 5)], 0.8, () => false));
    expect(d.criteria.find((c) => c.n === 3)!.met).toBe(true);
  });
});

describe('segment 5: golden set is a query over the log', { timeout: 300_000 }, () => {
  let sb: Sandbox;
  const must = (name: string, ...a: string[]) => { const r = tool(sb, name, ...a); expect(r.status, `${name} ${a.join(' ')}: ${r.stderr}`).toBe(0); return r; };
  const events = () => sb.lines().map((l) => JSON.parse(l) as AnyStoredEvent);

  beforeAll(() => {
    sb = sandbox();
    must('seg2', 'log-init'); must('seg2', 'ingest', '--edition', '2024');
    must('seg2', 'extract', 'structure', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg2', 'extract', 'claims', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg3', 'ingest', '--edition', '2025');
    must('seg3', 'extract', '--layers', 'structure,claims', '--doc', 'cp-2025');
    must('compare'); must('seg3', 'review', '--auto');
  });

  it('golden --until 15 has four items, without a cut-off five; harness verifications are never items', () => {
    const g4 = must('golden', '--layer', 'claims', '--until', '15').json!;
    expect(g4).toMatchObject({ version: 'claims@15', count: 4, untilSeq: 15 });
    const g5 = must('golden', '--layer', 'claims').json!;
    expect(g5.count).toBe(5);
    expect(g5.excluded).toEqual({ harnessVerified: 3, importVerified: 0 });
    const items = g5.items as { verifiedBy: string; subjectKey: string; value: string }[];
    expect(items.every((i) => i.verifiedBy.startsWith('human:'))).toBe(true);
    expect(items[4]).toMatchObject({ subjectKey: 'fire.deductible', value: '750 EUR' });
  });

  it('the same query on the same log slice returns the same set, and a later log does not change an earlier cut', () => {
    const a = must('golden', '--layer', 'claims', '--until', '15').stdout;
    expect(must('golden', '--layer', 'claims', '--until', '15').stdout).toBe(a);
  });

  it('prompt examples are subtracted from the golden set', () => {
    const f = foldEvents(events());
    const all = goldenClaims(f, 15);
    const ex = all[0]!.itemId;
    expect(goldenClaims(f, 15, { excludeIds: [ex] })).toHaveLength(3);
  });

  it('golden refuses a cut-off beyond the log and an unknown layer (exit 1, one line)', () => {
    for (const a of [['--until', '999'], ['--layer', 'nope'], ['--until', 'x']]) {
      const r = tool(sb, 'golden', ...a);
      expect(r.status).toBe(1);
      expect(r.stderr.trim().split('\n')).toHaveLength(1);
    }
  });

  it('eval claims@v1: TP 2, FP 2, FN 2, precision 0.5, recall 0.5; spans absolute with local form', () => {
    const r = must('eval', '--extractor', 'claims@v1').json!;
    expect(r).toMatchObject({ goldenVersion: 'claims@15', expectedItems: 4 });
    const res = r.result as { tp: number; fp: number; fn: number; precision: number; recall: number; rows: { subjectKey: string; iou: number | null; inter: number | null; union: number | null }[] };
    expect([res.tp, res.fp, res.fn, res.precision, res.recall]).toEqual([2, 2, 2, 0.5, 0.5]);
    expect(res.rows[0]).toMatchObject({ subjectKey: 'fire.deductible', inter: 40, union: 42 });
    const text = tool(sb, 'eval', '--extractor', 'claims@v1', '--text').stdout;
    expect(text).toMatch(/500 EUR \[4240,4280\) \[120,160\)\s+500 EUR \[4238,4280\) \[118,160\)\s+0\.95 \(40\/42\)/);
  });

  it('eval claims@v2 before the replay fails with the command to run (exit 2, one line)', () => {
    const r = tool(sb, 'eval', '--extractor', 'claims@v2');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/npm run replay -- --extractor claims@v2/);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('after the replay: v2 summary 0.60 / 0.75, and the 2025 proposals are not evaluated', () => {
    must('replay', '--extractor', 'claims@v2');
    const s = must('eval', '--extractor', 'claims@v2', '--summary').json!;
    expect(s).toMatchObject({ tp: 3, fp: 2, fn: 1, precision: 0.6, recall: 0.75 });
    expect(Object.keys(s)).not.toContain('result');
  });

  it('drift v1 -> v2: regression on theft.deductible, criteria [1, 3] fail, no ExtractorVersionPromoted, log untouched', () => {
    const before = sb.lines();
    const r = must('drift', '--from', 'claims@v1', '--to', 'claims@v2').json!;
    const d = r.drift as { failed: number[]; items: { subjectKey: string; cell: string }[]; meetsAll: boolean };
    expect(d.failed).toEqual([1, 3]);
    expect(d.items.find((i) => i.subjectKey === 'theft.deductible')!.cell).toBe('regression');
    expect(r).toMatchObject({ promotionEventEmitted: false, alreadyPromoted: false });
    expect(sb.lines()).toEqual(before);
    expect(events().filter((e) => e.type === 'ExtractorVersionPromoted').map((e) => (e.payload as { version: string }).version)).toEqual(['claims@v1']);
    expect(tool(sb, 'drift', '--from', 'claims@v1', '--to', 'claims@v2', '--text').stdout).toMatch(/criteria failed: \[1, 3\]/);
  });

  it('drift without --to is a usage error (exit 1, one line)', () => {
    const r = tool(sb, 'drift', '--from', 'claims@v1');
    expect(r.status).toBe(1);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('segment 5 fallbacks exist and are labelled deterministic tool output', () => {
    for (const f of ['golden-claims.txt', 'eval-v1.txt', 'eval-v2-summary.txt', 'drift-v1-v2.txt']) expect(read(join(root, 'fallback/seg5', f))).toMatch(/DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION/);
  });
});
