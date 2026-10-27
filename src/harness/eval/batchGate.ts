// Batch gate on online probes (05-harness-design.md §5). Count-based, because rates on 3–10 items are
// unstable: pass iff FN ≤ 1 and FP ≤ 1 across the probe items and no critical error. A batch that passes
// is signal (its class-A proposals may be reconfirmed); a batch that fails is noise (BatchRejected, every
// proposal stays proposed).
//
// Cold start: while the layer's golden set holds fewer expected items than the probe minimum, the gate is
// not applicable; class A is then decided by the comparator alone and audit sampling of class A is 100 %.
import { config } from '../../config';

export interface Counts {
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
}

export type GateResult =
  | { readonly kind: 'passed'; readonly counts: Counts }
  | { readonly kind: 'rejected'; readonly counts: Counts; readonly criticalErrors: number }
  | { readonly kind: 'not-applicable'; readonly goldenItems: number; readonly minimum: number };   // cold start

export interface GateInput {
  /** Expected items in the layer's golden set (golden/size.ts). */
  readonly goldenItems: number;
  /** The probe items' counts; required once the golden set reaches the minimum. */
  readonly probe?: { readonly counts: Counts; readonly criticalErrors: number };
}

export type GateConfig = Pick<typeof config.batchGate, 'probeMinimumExpectedItems' | 'maxFalseNegatives' | 'maxFalsePositives'>;

/** Cold start first (whatever the probes say), then the count-based rule; a missing probe above the minimum is an error. */
export function batchGate(input: GateInput, cfg: GateConfig = config.batchGate): GateResult {
  if (input.goldenItems < cfg.probeMinimumExpectedItems) {
    return { kind: 'not-applicable', goldenItems: input.goldenItems, minimum: cfg.probeMinimumExpectedItems };
  }
  if (!input.probe) throw new Error(`batch gate: golden set has ${input.goldenItems} items but the batch carries no probe items`);
  const { counts, criticalErrors } = input.probe;
  const passes = counts.fn <= cfg.maxFalseNegatives && counts.fp <= cfg.maxFalsePositives && criticalErrors === 0;
  return passes ? { kind: 'passed', counts } : { kind: 'rejected', counts, criticalErrors };
}

export const isColdStart = (gate: GateResult): boolean => gate.kind === 'not-applicable';
