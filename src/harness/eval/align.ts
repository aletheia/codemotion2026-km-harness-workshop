// Step 1 of the metrics (05-harness-design.md §2): align proposals with the expected claims of one golden
// item. Key = subject key; several proposals with the key → the one with the highest span IoU (first in
// proposal order on a tie), the rest stay unaligned. A proposal aligns with at most one expected claim.
import type { NormalizedValue, SubjectKey } from '../../domain/claim';
import { iou, type Span } from '../../domain/span';
import type { ExpectedClaim, GoldenItem } from '../golden/query';

/** A proposal as the eval reads it: what it claims, where, and the golden input it was extracted from. */
export interface EvalProposal {
  readonly inputArtifactId: string;
  readonly claimId: string;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
}

export interface Alignment {
  readonly expected: ExpectedClaim;
  readonly proposal?: EvalProposal;
  readonly iou?: number;
}

/** IoU of the primary spans (the first of each claim); half-open intervals, 0 across document versions. */
export const spanIoU = (a: readonly Span[], b: readonly Span[]): number => (a[0] && b[0] ? iou(a[0], b[0]) : 0);

export function align(item: GoldenItem<ExpectedClaim>, proposals: readonly EvalProposal[]): { alignments: Alignment[]; unpaired: EvalProposal[] } {
  const remaining = proposals.filter((p) => p.inputArtifactId === item.inputArtifactId);
  const alignments = item.expected.map((expected): Alignment => {
    let best: { proposal: EvalProposal; iou: number } | undefined;
    for (const proposal of remaining) {
      if (proposal.subjectKey !== expected.subjectKey) continue;
      const score = spanIoU(expected.spans, proposal.spans);
      if (!best || score > best.iou) best = { proposal, iou: score };
    }
    if (!best) return { expected };
    remaining.splice(remaining.indexOf(best.proposal), 1);
    return { expected, proposal: best.proposal, iou: best.iou };
  });
  return { alignments, unpaired: remaining };
}
