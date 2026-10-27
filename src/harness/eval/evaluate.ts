// The offline eval of an extractor version on a golden set: align → classify → count → micro-average.
// Pure; the process that appends EvalCompleted is processes/eval.ts.
import type { ExpectedClaim, GoldenItem } from '../golden/query';
import { align, type EvalProposal } from './align';
import { classify, type PairOutcome } from './classify';
import { count, microAverage, type Metrics } from './metrics';

export interface AlignedPair {
  readonly inputArtifactId: string;
  readonly expected: ExpectedClaim;
  readonly proposal?: EvalProposal;
  readonly iou?: number;
  readonly outcome?: PairOutcome;           // absent = missing
}

export interface Evaluation {
  /** One per expected claim, in golden-set order. */
  readonly pairs: readonly AlignedPair[];
  /** Proposals no expected claim aligned with, in proposal order: one FP each. */
  readonly unpaired: readonly EvalProposal[];
  readonly metrics: Metrics;
}

export function evaluate(golden: readonly GoldenItem<ExpectedClaim>[], proposals: readonly EvalProposal[], opts: { thetaIoU: number }): Evaluation {
  const pairs: AlignedPair[] = [];
  const unpaired: EvalProposal[] = [];
  for (const item of golden) {
    const { alignments, unpaired: rest } = align(item, proposals);
    for (const a of alignments) {
      pairs.push(a.proposal
        ? { inputArtifactId: item.inputArtifactId, ...a, outcome: classify(a.expected, a.proposal, a.iou!, a.expected.tolerance?.iou ?? opts.thetaIoU) }
        : { inputArtifactId: item.inputArtifactId, expected: a.expected });
    }
    unpaired.push(...rest);
  }
  return { pairs, unpaired, metrics: microAverage(count(pairs.map((p) => p.outcome), unpaired.length)) };
}
