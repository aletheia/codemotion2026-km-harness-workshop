// Batch gate on online probes (05-harness-design.md §5). Count-based, because rates on 3–10 items are
// unstable: pass iff FN ≤ 1 and FP ≤ 1 across the probe items and no critical error. A batch that passes
// is signal (its class-A proposals may be reconfirmed); a batch that fails is noise (BatchRejected, every
// proposal stays proposed).
//
// Cold start: while the layer's golden set holds fewer expected items than the probe minimum, the gate is
// not applicable; class A is then decided by the comparator alone and audit sampling of class A is 100 %.
import { config } from '../../config';
import { isCritical } from '../../catalog/subjects';
import { deriveEventId } from '../../events/eventId';
import type { EventDraft } from '../../events/log';
import type { EvalProposal } from './align';
import type { AlignedPair } from './evaluate';
import { count, type Counts } from './metrics';

export type { Counts };

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

export interface Probe {
  readonly items: number;
  readonly counts: Counts;
  readonly criticalErrors: number;
  /** The subject keys behind criticalErrors, for the BatchRejected evidence. */
  readonly criticalKeys: readonly string[];
}

/** The probe items of a batch, measured like the offline eval; a critical error is a critical-subset expected claim not got right. */
export function probeOf(pairs: readonly AlignedPair[], unpaired: readonly EvalProposal[]): Probe {
  const criticalKeys = pairs.filter((p) => p.outcome !== 'correct' && isCritical(p.expected.subjectKey)).map((p) => p.expected.subjectKey);
  return { items: pairs.length, counts: count(pairs.map((p) => p.outcome), unpaired.length), criticalErrors: criticalKeys.length, criticalKeys };
}

/** The decision a failed gate leads to: every proposal of the batch stays proposed, the probe counts are the evidence. */
export function batchRejectedDraft(batchId: string, probe: Probe): EventDraft {
  return {
    eventId: deriveEventId({ producer: 'harness:gate', inputArtifactId: batchId, extractorVersion: null, eventType: 'BatchRejected', aggregateId: batchId }),
    type: 'BatchRejected',
    layer: 'harness',
    aggregateId: batchId,
    actor: { kind: 'harness', id: 'gate', rule: 'gate' },
    correlationId: batchId,
    payload: { batchId },
    evidence: { probeItems: probe.items, fp: probe.counts.fp, fn: probe.counts.fn, criticalErrors: [...probe.criticalKeys] },
  };
}
