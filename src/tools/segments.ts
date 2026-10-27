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

export const segments: Readonly<Record<number, Segment>> = {};
