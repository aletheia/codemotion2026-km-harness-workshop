// Step 2 (05-harness-design.md §2): an aligned pair is correct when the normalized values are equal and
// the spans overlap with IoU ≥ θ (θ = 0.8, illustrative); a different value is a wrong value whatever the
// span; an equal value read from the wrong place is wrong provenance.
import { sameValue } from '../../domain/claim';
import type { ExpectedClaim } from '../golden/query';
import type { EvalProposal } from './align';

export type PairOutcome = 'correct' | 'wrong-value' | 'wrong-provenance';

export function classify(expected: ExpectedClaim, proposal: EvalProposal, iou: number, thetaIoU: number): PairOutcome {
  if (!sameValue(expected.value, proposal.value)) return 'wrong-value';
  return iou >= thetaIoU ? 'correct' : 'wrong-provenance';
}
