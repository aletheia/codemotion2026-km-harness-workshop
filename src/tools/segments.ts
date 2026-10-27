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
};
