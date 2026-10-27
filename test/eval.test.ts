import { copyFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocument } from '../src/acl/sourceToStructure';
import { config } from '../src/config';
import { droppedMultiplier } from '../src/catalog/normalizer';
import type { NormalizedValue, SubjectKey } from '../src/domain/claim';
import { documentId } from '../src/domain/ids';
import type { Span } from '../src/domain/span';
import { append, readLog } from '../src/events/log';
import { deriveEventId } from '../src/events/eventId';
import { firstProposals, ofType } from '../src/events/lookup';
import { align, type EvalProposal } from '../src/harness/eval/align';
import { batchGate, batchRejectedDraft, probeOf } from '../src/harness/eval/batchGate';
import { classify } from '../src/harness/eval/classify';
import { drift, noiseIntroduced, provenanceDrift } from '../src/harness/eval/drift';
import { evaluate } from '../src/harness/eval/evaluate';
import { count, microAverage } from '../src/harness/eval/metrics';
import { promotion } from '../src/harness/eval/promotion';
import { expectedCount, goldenSet, goldenSetVersion, resolveCutoff, toWordBoundaries, type ExpectedClaim, type GoldenItem } from '../src/harness/golden/query';
import { goldenSize } from '../src/harness/golden/size';
import { claimsGolden, runDrift, runEval } from '../src/processes/eval';
import { segment3Log, segment4Log } from './walkthrough';

const THETA = { thetaIoU: config.eval.iouThreshold };
const textOf = (d: string, v: string) => readDocument(d, v);
const money = (amount: number): NormalizedValue => ({ type: 'money', amount, currency: 'EUR' });
const years = (value: number): NormalizedValue => ({ type: 'integer', value, unit: 'years' });
const v8 = (start: number, end: number): Span => ({ documentId: documentId('cc-art2477'), version: 'v8', start, end });
const show = (x: ExpectedClaim) => `${x.subjectKey} [${x.spans[0]!.start},${x.spans[0]!.end})`;

/** A copy of a walkthrough log, so tests that append do not see each other's events. */
function copyOf(path: string): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'dnk-')), 'out');
  mkdirSync(dir, { recursive: true });
  copyFileSync(path, join(dir, 'events.jsonl'));
  return join(dir, 'events.jsonl');
}

const SEG4 = segment4Log();

// ---------------------------------------------------------------- pure functions

describe('metrics: align, classify, count, micro-average', () => {
  const expected = (subjectKey: string, value: NormalizedValue, span: Span): ExpectedClaim =>
    ({ subjectKey: subjectKey as SubjectKey, value, spans: [span], claimId: subjectKey, verifiedEventId: 'e' });
  const proposal = (subjectKey: string, value: NormalizedValue, span: Span, claimId = subjectKey): EvalProposal =>
    ({ inputArtifactId: 'in', claimId, subjectKey: subjectKey as SubjectKey, value, spans: [span] });
  const item = (...xs: ExpectedClaim[]): GoldenItem<ExpectedClaim> =>
    ({ inputArtifactId: 'in', input: {} as never, expected: xs, provenance: { verifiedBy: 'luca', seq: 1, goldenSetVersion: 'claims@g1' } });

  it('several proposals with the key: the highest IoU aligns, the rest stay unaligned', () => {
    const x = expected('attivo.limite', money(2e6), v8(1000, 1062));
    const far = proposal('attivo.limite', money(2e6), v8(900, 950), 'far');
    const near = proposal('attivo.limite', money(2e6), v8(998, 1062), 'near');
    const { alignments, unpaired } = align(item(x), [far, near]);
    expect(alignments[0]!.proposal?.claimId).toBe('near');
    expect(alignments[0]!.iou).toBeCloseTo(62 / 64);
    expect(unpaired.map((p) => p.claimId)).toEqual(['far']);
  });

  it('classifies by value first, then IoU against θ = 0.8 (half-open intervals)', () => {
    const x = expected('esercizi.consecutivi', years(2), v8(936, 964));
    expect(classify(x, proposal('esercizi.consecutivi', years(3), v8(936, 964)), 1, 0.8)).toBe('wrong-value');
    expect(classify(x, proposal('esercizi.consecutivi', years(2), v8(936, 964)), 1, 0.8)).toBe('correct');
    expect(classify(x, proposal('esercizi.consecutivi', years(2), v8(964, 990)), 0, 0.8)).toBe('wrong-provenance');   // adjacent, no overlap
  });

  it('counts: correct = TP, incorrect = FP + FN, missing = FN, unpaired proposal = FP', () => {
    expect(count(['correct', 'correct', 'wrong-value', undefined], 1)).toEqual({ tp: 2, fp: 2, fn: 2 });
    expect(microAverage({ tp: 3, fp: 2, fn: 1 })).toMatchObject({ precision: 0.6, recall: 0.75 });
    expect(microAverage({ tp: 0, fp: 0, fn: 0 })).toMatchObject({ precision: 0, recall: 0 });
  });

  it('a monetary amount off by a power of 1,000 is diagnosed as a dropped multiplier', () => {
    expect(droppedMultiplier(money(2e6), money(2e3), 'ricavi delle vendite e delle prestazioni: 2 milioni di euro')).toBe('"milioni" dropped');
    expect(droppedMultiplier(money(2e6), money(3e3), '2 milioni di euro')).toBeUndefined();
    expect(droppedMultiplier(money(2e6), money(4e6), '2 milioni di euro')).toBeUndefined();
  });
});

// ---------------------------------------------------------------- golden set

describe('golden set: a query over the log', () => {
  const events = readLog(SEG4);
  const query = (untilSeq: number, excludePromptExampleIds: readonly string[] = []) => goldenSet(events, 'claims', untilSeq, { excludePromptExampleIds, textOf });

  it('claims@g1 (until seq 15): one input, the four human-verified claims of v8 c2, attivo at its word boundaries', () => {
    const g1 = query(resolveCutoff('g1', events.length));
    expect(g1.version).toBe('claims@g1');
    expect(g1.items).toHaveLength(1);
    expect(g1.items[0]!.input).toMatchObject({ treeId: 'tree-v8', sectionPath: 'c2', baseOffset: 720 });
    expect(g1.items[0]!.expected.map(show)).toEqual([
      'attivo.limite [1000,1062)', 'ricavi.limite [1067,1126)', 'esercizi.consecutivi [936,964)', 'dipendenti.limite [1131,1189)',
    ]);
    expect(g1.excluded).toEqual({ harness: [], import: [], promptExamples: [] });
  });

  it('claims@g2 (end of log): 2 inputs, 7 expected; the harness verification ev-0025 is excluded', () => {
    const g2 = query(events.length);
    expect(g2.version).toBe('claims@g2');
    expect(`inputs: ${g2.items.length} · expected items: ${expectedCount(g2)}`).toBe('inputs: 2 · expected items: 7');
    expect(g2.excluded.harness).toEqual([events[24]!.eventId]);
    expect(g2.items[1]!.expected.map(show)).toEqual(['attivo.limite [1017,1079)', 'ricavi.limite [1084,1143)', 'dipendenti.limite [1148,1206)']);
    expect(g2.items[1]!.expected.map((x) => x.resolvedEventId)).toEqual([26, 27, 28].map((i) => events[i]!.eventId));
    expect(expectedCount(g2)).toBe(goldenSize(events, 'claims'));
  });

  it('is reproducible: the same (layer, untilSeq) gives the same set, whatever comes after the cut-off', () => {
    expect(query(15)).toEqual(goldenSet(events.slice(0, 15), 'claims', 15, { excludePromptExampleIds: [], textOf }));
    expect(query(15)).toEqual(query(15));
  });

  it('excludes prompt examples by claim id', () => {
    const ricavi2m = ofType(events, 'ClaimProposed').find((e) => e.payload.label === 'clm-ricavi2m')!.payload.claimId;
    const g = query(15, [ricavi2m]);
    expect(expectedCount(g)).toBe(3);
    expect(g.excluded.promptExamples).toEqual([ricavi2m]);
  });

  it('excludes import-actor verifications', () => {
    const path = copyOf(SEG4);
    const cess3 = [...firstProposals(readLog(path)).values()].find((e) => e.payload.label === 'clm-cess3')!;
    const { seq } = append(path, {
      eventId: deriveEventId({ producer: 'import:register', inputArtifactId: 'row 7', extractorVersion: null, eventType: 'ClaimVerified', aggregateId: cess3.payload.claimId }),
      type: 'ClaimVerified', layer: 'claims', aggregateId: cess3.payload.claimId,
      actor: { kind: 'import', id: 'register', source: 'compliance-register.csv' }, causationId: cess3.eventId, correlationId: 'import-test',
      payload: { claimId: cess3.payload.claimId }, evidence: { kind: 'import', sourceRecord: 'row 7' },
    });
    const after = readLog(path);
    const g = goldenSet(after, 'claims', after.length, { excludePromptExampleIds: [], textOf });
    expect(expectedCount(g)).toBe(7);
    expect(g.excluded.import).toEqual([after[seq - 1]!.eventId]);
  });

  it('names cut-offs: g1 = 15, past it g2; reads the checked span at its word boundaries', () => {
    expect(goldenSetVersion('claims', 15)).toBe('claims@g1');
    expect(goldenSetVersion('claims', 46)).toBe('claims@g2');
    expect(() => resolveCutoff('g9', 46)).toThrow(/unknown golden cut-off/);
    expect(toWordBoundaries(v8(998, 1062), readDocument('cc-art2477', 'v8'))).toEqual(v8(1000, 1062));
    expect(toWordBoundaries(v8(1131, 1189), readDocument('cc-art2477', 'v8'))).toEqual(v8(1131, 1189));   // ends on "à"
  });
});

// ---------------------------------------------------------------- worked numbers

describe('worked numbers on claims@g1 (comma 2 of v8)', () => {
  const events = readLog(SEG4);
  const g1 = claimsGolden(events, 'g1');
  const proposals = (version: string) => ofType(events, 'ClaimProposed')
    .filter((e) => e.actor.kind === 'agent' && e.actor.extractorVersion === version && e.causationId === g1.items[0]!.input.structureEventId)
    .map((e): EvalProposal => ({
      inputArtifactId: g1.items[0]!.inputArtifactId, claimId: e.payload.claimId, subjectKey: e.payload.subjectKey as SubjectKey,
      value: e.payload.normalizedValue as NormalizedValue, spans: e.payload.spans as Span[],
    }));
  const v1 = evaluate(g1.items, proposals('claims@v1'), THETA);
  const v2 = evaluate(g1.items, proposals('claims@v2'), THETA);
  const outcomes = (e: typeof v1) => e.pairs.map((p) => `${p.expected.subjectKey}:${p.outcome ?? 'missing'}`);

  it('claims@v1: TP 2 FP 2 FN 2, P 0.50 R 0.50; attivo IoU 62/64', () => {
    expect(v1.metrics).toEqual({ tp: 2, fp: 2, fn: 2, precision: 0.5, recall: 0.5 });
    expect(v1.pairs[0]!.iou).toBe(62 / 64);
    expect(v1.pairs[0]!.iou!.toFixed(2)).toBe('0.97');
    expect(outcomes(v1)).toEqual(['attivo.limite:correct', 'ricavi.limite:correct', 'esercizi.consecutivi:wrong-value', 'dipendenti.limite:missing']);
    expect(v1.unpaired.map((p) => p.subjectKey)).toEqual(['capitale.soglia']);
  });

  it('claims@v2: TP 3 FP 2 FN 1, P 0.60 R 0.75; ricavi 2,000 EUR is a wrong value', () => {
    expect(v2.metrics).toMatchObject({ tp: 3, fp: 2, fn: 1 });
    expect(v2.metrics.precision).toBeCloseTo(0.6);
    expect(v2.metrics.recall).toBe(0.75);
    expect(outcomes(v2)).toEqual(['attivo.limite:correct', 'ricavi.limite:wrong-value', 'esercizi.consecutivi:correct', 'dipendenti.limite:correct']);
    expect(v2.pairs[0]!.iou).toBe(1);
  });

  it('drift per item: attivo stable, ricavi regression (critical), esercizi and dipendenti improvement; noise cessazione', () => {
    const rows = drift(v1.pairs, v2.pairs);
    expect(rows.map((r) => `${r.subjectKey}:${r.cell}`)).toEqual([
      'attivo.limite:stable', 'ricavi.limite:regression', 'esercizi.consecutivi:improvement', 'dipendenti.limite:improvement',
    ]);
    expect(rows.find((r) => r.subjectKey === 'ricavi.limite')!.critical).toBe(true);
    expect(noiseIntroduced(v1, v2).map((p) => p.subjectKey)).toEqual(['cessazione.esercizi']);
    expect(provenanceDrift(rows, THETA.thetaIoU)).toEqual([]);
  });

  it('promotion of v2 fails criteria 1 and 3 and holds 2 and 4', () => {
    const result = promotion(v1.metrics, v2.metrics, drift(v1.pairs, v2.pairs));
    expect(result.promoted).toBe(false);
    expect(result.failedCriteria).toEqual([1, 3]);
    expect(result.criticalRegressions).toEqual(['ricavi.limite']);
    expect(result.criteria[1]!.threshold).toBeCloseTo(0.48);
  });

  it('promotion passes when all four hold (recall exactly at the floor still holds)', () => {
    const rows = drift(v2.pairs, v2.pairs);
    const cfg = { ...config.promotion, precisionThreshold: 0.6 };
    expect(promotion(v2.metrics, v2.metrics, rows, cfg)).toMatchObject({ promoted: true, failedCriteria: [] });
    expect(promotion({ ...v2.metrics, recall: 0.77 }, v2.metrics, rows, cfg).promoted).toBe(true);
  });
});

// ---------------------------------------------------------------- processes

describe('eval and drift processes on the walkthrough log', () => {
  it('eval appends EvalCompleted at 47 (v1) and 48 (v2), idempotently; drift appends nothing', () => {
    const path = copyOf(SEG4);
    const v1 = runEval('claims@v1', 'g1', path);
    const v2 = runEval('claims@v2', 'g1', path);
    expect([v1.result.seq, v2.result.seq]).toEqual([47, 48]);
    expect(v2.previous).toEqual({ extractorVersion: 'claims@v1', metrics: expect.objectContaining({ precision: 0.5, recall: 0.5 }) });
    const e47 = readLog(path)[46]!;
    expect(e47).toMatchObject({ type: 'EvalCompleted', actor: { kind: 'harness', id: 'eval' }, payload: { goldenSetVersion: 'claims@g1', tp: 2, fp: 2, fn: 2 } });

    expect(runEval('claims@v1', 'g1', path).result).toEqual({ seq: 47, duplicate: true });
    const d = runDrift('claims@v1', 'claims@v2', 'g1', path);
    expect(d.promotion.failedCriteria).toEqual([1, 3]);
    expect(d.result).toBeUndefined();
    expect(d.noise[0]).toMatchObject({ sectionPath: 'c2', statedElsewhere: true, notInUnit: true, noExpectedItem: true });
    expect(readLog(path)).toHaveLength(48);
  });

  it('a passing promotion appends ExtractorVersionPromoted(actor=harness) with the four criteria as evidence', () => {
    const path = copyOf(segment3Log());
    const d = runDrift('claims@v1', 'claims@v1', 'g1', path, { ...config.promotion, precisionThreshold: 0.5 });
    expect(d.promotion.promoted).toBe(true);
    const last = readLog(path).at(-1)!;
    expect(last.type).toBe('ExtractorVersionPromoted');
    expect(last.actor.kind).toBe('harness');
    expect(last.evidence).toMatchObject({ kind: 'criteria', criteria: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
  });
});

describe('batch gate on probe items', () => {
  const events = readLog(SEG4);
  const g1 = claimsGolden(events, 'g1');

  it('probes are measured like the eval; v1 on the g1 item fails (FN 2, FP 2, critical errors)', () => {
    const v1 = runEval('claims@v1', 'g1', copyOf(SEG4)).evaluation;
    const probe = probeOf(v1.pairs, v1.unpaired);
    expect(probe).toMatchObject({ items: 4, counts: { tp: 2, fp: 2, fn: 2 }, criticalKeys: ['esercizi.consecutivi', 'dipendenti.limite'] });
    expect(batchGate({ goldenItems: expectedCount(g1), probe }).kind).toBe('not-applicable');   // cold start: 4 < 10
    expect(batchGate({ goldenItems: 10, probe }).kind).toBe('rejected');
  });

  it('a rejected batch is recorded as BatchRejected with the probe counts as evidence', () => {
    const path = copyOf(SEG4);
    const v1 = runEval('claims@v1', 'g1', path).evaluation;
    const { seq } = append(path, batchRejectedDraft('btc-v8-01', probeOf(v1.pairs, v1.unpaired)));
    expect(readLog(path)[seq - 1]).toMatchObject({
      type: 'BatchRejected', actor: { kind: 'harness', id: 'gate' },
      evidence: { probeItems: 4, fp: 2, fn: 2, criticalErrors: ['esercizi.consecutivi', 'dipendenti.limite'] },
    });
  });
});
