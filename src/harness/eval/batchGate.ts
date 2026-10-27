// Batch gate (online probes). Pure. Count-based, because rates on a handful of items are unstable.
// Cold start (DECISIONS.md #1, run-sheet change #4, labelled illustrative): below the probe minimum the gate
// is NOT APPLICABLE; class A is decided by the comparator alone and class-A audit sampling is 100 %.
import { config } from '../../config';

export interface Counts { tp: number; fp: number; fn: number }
export type GateResult =
  | { kind: 'passed'; counts: Counts }
  | { kind: 'rejected'; counts: Counts; criticalErrors: number }
  | { kind: 'not-applicable'; goldenItems: number; minimum: number };

export function batchGate(goldenItems: number, probe: { counts: Counts; criticalErrors: number } | undefined, cfg = config.gate): GateResult {
  if (goldenItems < cfg.probeMinimumExpectedItems) return { kind: 'not-applicable', goldenItems, minimum: cfg.probeMinimumExpectedItems };
  if (!probe) throw new Error('batchGate: a probe result is required once the golden set reaches the minimum');
  const ok = probe.counts.fn <= cfg.maxFalseNegatives && probe.counts.fp <= cfg.maxFalsePositives && probe.criticalErrors <= cfg.maxCriticalErrors;
  return ok ? { kind: 'passed', counts: probe.counts } : { kind: 'rejected', counts: probe.counts, criticalErrors: probe.criticalErrors };
}

/** The line printed by `compare` (wording fixed by the run sheet). */
export function gateLine(g: GateResult): string {
  switch (g.kind) {
    case 'not-applicable':
      return `batch gate: not applicable (golden set ${g.goldenItems} expected items < minimum ${g.minimum}); class-A audit sampling ${Math.round(config.sampling.belowProbeMinimum * 100)} %`;
    case 'passed': return `batch gate: passed (FP ${g.counts.fp}, FN ${g.counts.fn}, critical errors 0)`;
    case 'rejected': return `batch gate: rejected (FP ${g.counts.fp}, FN ${g.counts.fn}, critical errors ${g.criticalErrors}); every proposal of the batch stays proposed`;
  }
}
