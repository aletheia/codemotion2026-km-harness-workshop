// Drift per item, never by aggregate (05-harness-design.md §3): both versions on the same golden set,
// each expected claim lands in one cell. Plus the proposals the new version introduces (noise) and the
// pairs whose value stays right while the span slips below θ (provenance drift).
import type { SubjectKey } from '../../domain/claim';
import { sameValue } from '../../domain/claim';
import { isCritical } from '../../catalog/subjects';
import type { EvalProposal } from './align';
import type { PairOutcome } from './classify';
import type { AlignedPair, Evaluation } from './evaluate';

export type DriftCell = 'stable' | 'regression' | 'improvement' | 'stable-wrong';

export interface DriftRow {
  readonly inputArtifactId: string;
  readonly subjectKey: SubjectKey;
  readonly v1: PairOutcome | 'missing';
  readonly v2: PairOutcome | 'missing';
  readonly cell: DriftCell;
  readonly critical: boolean;
  readonly a: AlignedPair;
  readonly b: AlignedPair;
}

const outcomeOf = (p: AlignedPair): PairOutcome | 'missing' => p.outcome ?? 'missing';

function cellOf(v1: PairOutcome | 'missing', v2: PairOutcome | 'missing'): DriftCell {
  if (v1 === 'correct') return v2 === 'correct' ? 'stable' : 'regression';
  return v2 === 'correct' ? 'improvement' : 'stable-wrong';
}

/** One row per expected claim of `a`, in golden-set order; `b` must be evaluated on the same golden set. */
export function drift(a: readonly AlignedPair[], b: readonly AlignedPair[]): DriftRow[] {
  const key = (p: AlignedPair) => `${p.inputArtifactId}|${p.expected.claimId}`;
  const inB = new Map(b.map((p) => [key(p), p] as const));
  return a.map((pa) => {
    const pb = inB.get(key(pa));
    if (!pb) throw new Error(`drift: ${pa.expected.subjectKey} is not in both evaluations (different golden sets?)`);
    const v1 = outcomeOf(pa), v2 = outcomeOf(pb);
    return { inputArtifactId: pa.inputArtifactId, subjectKey: pa.expected.subjectKey, v1, v2, cell: cellOf(v1, v2), critical: isCritical(pa.expected.subjectKey), a: pa, b: pb };
  });
}

/** Unpaired proposals of `b` that `a` did not make (same input, subject and value). */
export function noiseIntroduced(a: Evaluation, b: Evaluation): EvalProposal[] {
  const madeByA = [...a.pairs.flatMap((p) => (p.proposal ? [p.proposal] : [])), ...a.unpaired];
  return b.unpaired.filter((q) => !madeByA.some((p) => p.inputArtifactId === q.inputArtifactId && p.subjectKey === q.subjectKey && sameValue(p.value, q.value)));
}

/** Value right in both, span at or above θ in `a` and below it in `b`. */
export function provenanceDrift(rows: readonly DriftRow[], thetaIoU: number): DriftRow[] {
  return rows.filter((r) => r.v1 === 'correct' && r.v2 === 'wrong-provenance' && (r.b.iou ?? 0) < thetaIoU);
}
