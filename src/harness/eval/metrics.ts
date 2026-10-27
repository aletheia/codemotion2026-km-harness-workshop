// Steps 3–4 (05-harness-design.md §2): count, then micro-average over all golden items.
//   correct pair = TP     incorrect pair = FP + FN     unpaired expected = FN     unpaired proposal = FP
import type { PairOutcome } from './classify';

export interface Counts { readonly tp: number; readonly fp: number; readonly fn: number }
export interface Metrics extends Counts { readonly precision: number; readonly recall: number }

/** One expected claim's outcome (undefined = missing) plus the number of unpaired proposals. */
export function count(outcomes: readonly (PairOutcome | undefined)[], unpairedProposals: number): Counts {
  let tp = 0, fp = unpairedProposals, fn = 0;
  for (const o of outcomes) {
    if (o === 'correct') tp++;
    else if (o === undefined) fn++;
    else { fp++; fn++; }
  }
  return { tp, fp, fn };
}

/** precision = TP/(TP+FP), recall = TP/(TP+FN); 0 when the denominator is 0. */
export function microAverage(c: Counts): Metrics {
  return { ...c, precision: c.tp + c.fp === 0 ? 0 : c.tp / (c.tp + c.fp), recall: c.tp + c.fn === 0 ? 0 : c.tp / (c.tp + c.fn) };
}
