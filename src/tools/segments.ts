// The live steps of each segment, in the order of workshop/en/03-walkthrough-script.md, with what to say about them.
export interface SegmentStep {
  script: string;
  /** Run instead of `script` with --yes (no one at the keyboard). */
  auto?: string;
  why: string;
}

export interface Segment {
  title: string;
  /** Events the log should hold when the segment starts (undefined: the segment does not read the log). */
  expectsEvents?: number;
  steps: readonly SegmentStep[];
}

export const segments: Readonly<Record<number, Segment>> = {
  1: {
    title: 'Three live failures of chunk → embed → retrieve',
    steps: [
      { script: 'rag:index', why: 'Builds the retrieval baseline: one chunk per paragraph of v7, v8 and v9 (pre-talk; skip it if already built).' },
      { script: 'rag:query', why: 'Failure 1: the three versions answer with the same confidence; similarity knows nothing of validity dates.' },
      { script: 'rag:delete-v8', why: 'Failure 2: we delete v8, as a document management system would when it is replaced…' },
      { script: 'rag:query', why: '…and the same question no longer sees v8: what was in force from March to June 2019 is gone from history.' },
      { script: 'rag:extract-c2', why: 'Failure 3: a one-shot extraction returns a value with no span, no version and no date: nothing to verify it against.' },
    ],
  },
  2: {
    title: 'Build the log by hand: comma 2 of v8',
    expectsEvents: 0,
    steps: [
      { script: 'log:reset', why: 'Starts from an empty out/: the room sees the log born at seq 1.' },
      { script: 'log:init', why: 'The log is one append-only JSONL file; every projection is a fold over it.' },
      { script: 'ingest:v8', why: 'The source layer: a DocumentVersion with its content hash and validity period, not a file.' },
      { script: 'extract:structure-v8', why: 'An agent proposes the section tree. Agents only propose: they never verify.' },
      { script: 'review', auto: 'review:auto', why: 'A human verifies the tree. Only a verified tree crosses the ACL into the Claims context.' },
      { script: 'extract:claims-v8', why: 'The ACL cuts one unit per comma; the claims agent proposes four claims with spans and normalized values.' },
      { script: 'show:ricavi-v8', why: 'One claim up close: span, normalized value, extractor version and the event that caused it.' },
      { script: 'review', auto: 'review:auto', why: 'The human verifies two claims, leaves two proposed and adds the two the agent missed.' },
    ],
  },
  3: {
    title: 'Context map, ACL, three classes: ingest v9',
    expectsEvents: 15,
    steps: [
      { script: 'ingest:v9', why: 'A new edition of the same lineage arrives: v9 does not overwrite v8, it follows it.' },
      { script: 'extract:v9', why: 'Same tree shape as v8: the harness reconfirms it (class A), then claims@v1 proposes six claims.' },
      { script: 'compare', why: 'The harness classifies each proposal against current beliefs: A reconfirms, B is new, C conflicts.' },
      { script: 'review', auto: 'review:auto', why: 'The human resolves only the conflicts: three verified, three superseded, with the evidence on screen.' },
      { script: 'layers-4-6', why: 'Entities, policies and workflow built on the same log: an excerpt, not appended.' },
    ],
  },
  4: {
    title: 'The log, projections, replay, temporal query',
    expectsEvents: 35,
    steps: [
      { script: 'log:cat', why: 'Thirty-five events: everything we know and how we came to know it.' },
      { script: 'projections:drop', why: 'Projections are disposable: we delete them…' },
      { script: 'projections:build', why: '…and rebuild them from the log, identical.' },
      { script: 'replay:claims-v2', why: 'A new extractor version replays the Claims layer from the same verified trees: proposals only.' },
      { script: 'projections:diff', why: 'What would change if claims@v2 were promoted: one value differs, and it is a monetary threshold.' },
      { script: 'beliefs:at-2019-04-30', why: 'Valid time: what the law said on 30 April 2019…' },
      { script: 'beliefs', why: '…and what it says today, from the same log.' },
    ],
  },
  5: {
    title: 'The harness: golden set, eval, drift, promotion',
    expectsEvents: 46,
    steps: [
      { script: 'golden:claims-until-seg2', why: 'The golden set is not a file: it is a query over human decisions in the log, here up to segment 2.' },
      { script: 'golden:claims', why: 'The same query today: it has grown with the decisions taken in segment 3.' },
      { script: 'eval:claims-v1', why: 'claims@v1 against g1: precision, recall and provenance, with the counting rules on screen.' },
      { script: 'eval:claims-v2-summary', why: 'claims@v2 scores higher on recall, yet it is not promoted: criteria 1 and 3 fail.' },
      { script: 'drift:v1-v2', why: 'Item by item: the regression on ricavi.limite that an average would hide.' },
    ],
  },
};
