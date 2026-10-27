// Claims-layer metrics, exactly as the handbook defines them. Pure.
//   1. alignment: for each expected item, the proposals with the same document and subject key; the highest IoU wins.
//   2. a pair is value-correct (normalized values equal) and provenance-correct (span IoU >= theta); correct = both.
//   3. correct pair = TP; wrong pair = 1 FP + 1 FN; expected without a pair = FN; proposal without an expected item = FP.
//   4. precision = TP / (TP + FP), recall = TP / (TP + FN), micro-averaged over all items.
import { valueEquals, type NormalizedValue } from '../../domain/value';
import type { GoldenClaimItem } from '../golden';

export interface Interval { start: number; end: number }
export interface ProposalView {
  claimId: string; documentId: string; subjectKey: string; valueText: string; value: NormalizedValue; span: Interval; seq: number;
}
export type Outcome = 'TP' | 'WRONG' | 'MISSED' | 'SPURIOUS';
export interface EvalRow {
  documentId: string; subjectKey: string;
  expected: { valueText: string; span: Interval; itemId: string } | null;
  proposed: { valueText: string; span: Interval; claimId: string } | null;
  inter: number | null; union: number | null; iou: number | null;
  valueOk: boolean | null; provenanceOk: boolean | null;
  outcome: Outcome;
  wrong: 'value' | 'span' | 'value+span' | null;
  tp: number; fp: number; fn: number;
  critical: boolean;
}
export interface EvalResult {
  theta: number; rows: EvalRow[];
  tp: number; fp: number; fn: number; precision: number; recall: number;
  valueCorrectPairs: number; wrongProvenancePairs: number;
}

export function intervalIoU(a: Interval, b: Interval): { inter: number; union: number; iou: number } {
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = (a.end - a.start) + (b.end - b.start) - inter;
  return { inter, union, iou: union <= 0 ? 0 : inter / union };
}

const ratio = (n: number, d: number): number => (d === 0 ? 0 : n / d);

export function evaluate(expected: readonly GoldenClaimItem[], proposals: readonly ProposalView[], theta: number, isCritical: (subjectKey: string) => boolean): EvalResult {
  const used = new Set<string>(); // proposal claim id + seq
  const keyOf = (p: ProposalView) => `${p.claimId}#${p.seq}`;
  const rows: EvalRow[] = [];
  for (const e of expected) {
    const candidates = proposals.filter((p) => p.documentId === e.documentId && p.subjectKey === e.subjectKey && !used.has(keyOf(p)));
    let best: { p: ProposalView; m: ReturnType<typeof intervalIoU>; valueOk: boolean } | undefined;
    for (const p of candidates) {
      const m = intervalIoU(e.span, p.span);
      const valueOk = valueEquals(e.value, p.value);
      if (!best || m.iou > best.m.iou || (m.iou === best.m.iou && valueOk && !best.valueOk)) best = { p, m, valueOk };
    }
    const critical = isCritical(e.subjectKey);
    if (!best) {
      rows.push({ documentId: e.documentId, subjectKey: e.subjectKey, expected: { valueText: e.valueText, span: e.span, itemId: e.itemId }, proposed: null, inter: null, union: null, iou: null, valueOk: null, provenanceOk: null, outcome: 'MISSED', wrong: null, tp: 0, fp: 0, fn: 1, critical });
      continue;
    }
    used.add(keyOf(best.p));
    const provenanceOk = best.m.iou >= theta;
    const ok = best.valueOk && provenanceOk;
    rows.push({
      documentId: e.documentId, subjectKey: e.subjectKey,
      expected: { valueText: e.valueText, span: e.span, itemId: e.itemId }, proposed: { valueText: best.p.valueText, span: best.p.span, claimId: best.p.claimId },
      inter: best.m.inter, union: best.m.union, iou: best.m.iou, valueOk: best.valueOk, provenanceOk,
      outcome: ok ? 'TP' : 'WRONG', wrong: ok ? null : !best.valueOk && !provenanceOk ? 'value+span' : !best.valueOk ? 'value' : 'span',
      tp: ok ? 1 : 0, fp: ok ? 0 : 1, fn: ok ? 0 : 1, critical,
    });
  }
  for (const p of proposals) {
    if (used.has(keyOf(p))) continue;
    rows.push({
      documentId: p.documentId, subjectKey: p.subjectKey, expected: null, proposed: { valueText: p.valueText, span: p.span, claimId: p.claimId },
      inter: null, union: null, iou: null, valueOk: null, provenanceOk: null, outcome: 'SPURIOUS', wrong: null, tp: 0, fp: 1, fn: 0, critical: isCritical(p.subjectKey),
    });
  }
  const tp = rows.reduce((a, r) => a + r.tp, 0);
  const fp = rows.reduce((a, r) => a + r.fp, 0);
  const fn = rows.reduce((a, r) => a + r.fn, 0);
  const pairs = rows.filter((r) => r.expected && r.proposed);
  return {
    theta, rows, tp, fp, fn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn),
    valueCorrectPairs: pairs.filter((r) => r.valueOk).length,
    wrongProvenancePairs: pairs.filter((r) => r.valueOk && !r.provenanceOk).length,
  };
}
