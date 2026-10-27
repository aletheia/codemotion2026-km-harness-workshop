// Promotion criteria, offline (05-harness-design.md §4). All four must hold:
//   1. precision(next) ≥ layer threshold
//   2. recall(next) ≥ recall(prev) − ε
//   3. regressions on the critical subset (monetary, count, time-limit) = 0
//   4. wrong-provenance pairs ≤ 2 % of value-correct pairs (of next)
// Pure. Pass → the caller appends ExtractorVersionPromoted with the four values as evidence; fail → nothing.
import { config } from '../../config';
import type { DriftRow } from './drift';
import type { Metrics } from './metrics';

export type PromotionConfig = { readonly [K in keyof typeof config.promotion]: number };
export type CriterionId = 1 | 2 | 3 | 4;

export interface Criterion {
  readonly id: CriterionId;
  readonly value: number;
  readonly threshold: number;
  readonly holds: boolean;
}

export interface PromotionResult {
  readonly promoted: boolean;
  readonly failedCriteria: readonly CriterionId[];
  readonly criteria: readonly Criterion[];
  /** The subject keys behind criterion 3. */
  readonly criticalRegressions: readonly string[];
}

// Rounding guard: 0.48 computed as 0.50 − 0.02 must still admit a recall of exactly 0.48.
const EPS = 1e-9;

export function promotion(prev: Metrics, next: Metrics, rows: readonly DriftRow[], cfg: PromotionConfig = config.promotion): PromotionResult {
  const criticalRegressions = rows.filter((r) => r.cell === 'regression' && r.critical).map((r) => r.subjectKey);
  const valueCorrect = rows.filter((r) => r.v2 === 'correct' || r.v2 === 'wrong-provenance').length;
  const wrongProvenance = rows.filter((r) => r.v2 === 'wrong-provenance').length;
  const recallFloor = prev.recall - cfg.recallEpsilon;
  const provenanceRate = valueCorrect === 0 ? 0 : wrongProvenance / valueCorrect;

  const criteria: Criterion[] = [
    { id: 1, value: next.precision, threshold: cfg.precisionThreshold, holds: next.precision >= cfg.precisionThreshold - EPS },
    { id: 2, value: next.recall, threshold: recallFloor, holds: next.recall >= recallFloor - EPS },
    { id: 3, value: criticalRegressions.length, threshold: 0, holds: criticalRegressions.length === 0 },
    { id: 4, value: provenanceRate, threshold: cfg.maxWrongProvenanceRate, holds: provenanceRate <= cfg.maxWrongProvenanceRate + EPS },
  ];
  const failedCriteria = criteria.filter((c) => !c.holds).map((c) => c.id);
  return { promoted: failedCriteria.length === 0, failedCriteria, criteria, criticalRegressions };
}
