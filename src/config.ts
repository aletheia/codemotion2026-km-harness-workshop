// illustrative — not a benchmark
// Every threshold, rate and cut-off of the repository lives here. None of them is a measured number.

export const config = {
  paths: {
    outDir: 'out',
    log: 'out/events.jsonl',
    projections: 'out/projections',
    ragIndex: 'out/rag/index.json',
    llmFixtures: 'fixtures/llm',
    documents: 'fixtures/documents',
    reviewDecisions: 'fixtures/review/decisions.json',
  },

  // The lineage of the example and the Normattiva act its versions come from.
  source: {
    lineageId: 'cc-art2477',
    atto: '042U0262',
    article: '2477',
  },

  // The reviewer of the walkthrough (actor human(luca)).
  reviewer: 'luca',

  // Segment 1 retrieval baseline: one chunk per paragraph, TF-IDF cosine, top 3; the query is the segment-6 question.
  rag: {
    indexName: 'cc-art2477',
    sourceDir: 'fixtures/documents',
    sourceFiles: ['cc-art2477-v7.txt', 'cc-art2477-v8.txt', 'cc-art2477-v9.txt'],
    topK: 3,
    query: "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo",
    extractUnit: { file: 'cc-art2477-v8.txt', documentId: 'cc-art2477', version: 'v8', path: 'c2' },
  },

  log: {
    logId: 'dnk-workshop',
    format: 'events-jsonl-v1',
  },

  // Fixed clock: occurredAt = base + seq seconds, unless DNK_CLOCK=real.
  clock: {
    base: '2026-10-28T13:37:00Z',
    // Duration printed by projections:build under the fixed clock, so the output is byte-identical across runs.
    projectionsBuildMs: 12,
  },

  // Bootstrap decision of log:init (seq 2).
  bootstrap: {
    extractor: 'claims',
    version: 'claims@v1',
    reviewer: 'luca',
    note: 'initial version, no predecessor',
  },

  // Named golden-set cut-offs (seq numbers): g1 = end of segment 2.
  golden: {
    g1: 15,
  },

  eval: {
    iouThreshold: 0.8,
  },

  promotion: {
    precisionThreshold: 0.9,
    recallEpsilon: 0.02,
    maxWrongProvenanceRate: 0.02,
  },

  batchGate: {
    probeRate: 0.05,
    probeMinimumExpectedItems: 10,
    maxFalseNegatives: 1,
    maxFalsePositives: 1,
  },

  sampling: {
    humanRooted: 0.05,
    importRooted: 0.2,
    coldStart: 1.0,
  },
} as const;

export function occurredAt(seq: number, env: NodeJS.ProcessEnv = process.env): string {
  if (env.DNK_CLOCK === 'real') return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  // TODO(luca): 03-walkthrough-script.md shows seq 7 at 13:37:12Z; AGENTS.md §1.4 (base + seq seconds) gives 13:37:07Z. Kept AGENTS.md.
  return new Date(Date.parse(config.clock.base) + seq * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
