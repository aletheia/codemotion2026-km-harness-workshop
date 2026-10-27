// All thresholds, rates and fixed names live here. Every number below is
// illustrative: it is a configuration value, not a measurement or a benchmark.
// illustrative — not a benchmark

export const config = {
  lineageId: 'casa-protetta',
  /** IoU threshold for "span provenance correct" (half-open intervals). */
  thetaIoU: 0.8,
  /** Layer precision threshold for promotion criterion 1. */
  promotion: {
    layerPrecision: 0.9,
    recallEpsilon: 0.02,
    maxWrongProvenanceShare: 0.02,
  },
  /** Batch gate (online probes): count based. */
  gate: {
    probeMinimumExpectedItems: 10,
    maxFalseNegatives: 1,
    maxFalsePositives: 1,
    maxCriticalErrors: 0,
  },
  /** Audit sampling of class-A reconfirmations. */
  sampling: {
    humanRooted: 0.05,
    importRooted: 0.2,
    belowProbeMinimum: 1.0, // DECISIONS.md #1: 100 % while the gate is not applicable
  },
  /** Critical subset: subject-key classes whose regressions block promotion. */
  criticalClasses: ['monetary', 'exclusion', 'time-limit'] as const,
  /**
   * Logical clock: occurredAt = clockBase + seq seconds. Real wall-clock time
   * would make every run differ; the repo is deterministic end to end.
   */
  clockBase: '2026-10-28T13:00:00Z',
  /** Actor ids used by deterministic steps. */
  humanReviewerId: 'luca',
} as const;
