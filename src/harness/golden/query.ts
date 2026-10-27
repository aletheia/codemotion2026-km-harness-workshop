// The golden set of the Claims layer as a query over the log (05-harness-design.md §1): every human-actor
// ClaimVerified up to untilSeq, grouped by the input the claim was extracted from (a StructureVerified
// section). Excluded: harness- and import-actor verifications (circular: they derive from decisions already
// in the set) and claims used as prompt examples. Pure over the log slice: the same (layer, untilSeq) gives
// the same set, so the set's version is that pair; config names the cut-offs (claims@g1 = until seq 15).
import { config } from '../../config';
import type { NormalizedValue, SubjectKey } from '../../domain/claim';
import type { Span } from '../../domain/span';
import { firstProposals, ofType, proposedTree } from '../../events/lookup';
import type { LogEvent } from '../../events/schema';

export interface ExpectedClaim {
  readonly subjectKey: SubjectKey;          // 'ricavi.limite'
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
  readonly tolerance?: { readonly iou: number };
  readonly claimId: string;
  /** The human ClaimVerified that put the claim in the set. */
  readonly verifiedEventId: string;
  /** The ClaimContested this verification resolved, when it resolved one. */
  readonly resolvedEventId?: string;
}

/** For claims: one extraction unit, i.e. one section of a verified tree. */
export interface GoldenInput {
  readonly structureEventId: string;        // the StructureVerified the unit came from
  readonly treeId: string;
  readonly documentId: string;
  readonly version: string;
  readonly sectionPath: string;
  readonly baseOffset: number;              // absolute offset of the section: local = absolute − base
}

export interface GoldenItem<TExpected> {
  readonly inputArtifactId: string;         // `${structureEventId}#${sectionPath}`
  readonly input: GoldenInput;
  readonly expected: readonly TExpected[];
  readonly provenance: { readonly verifiedBy: string; readonly seq: number; readonly goldenSetVersion: string };
}

export interface GoldenSet {
  readonly layer: 'claims';
  readonly untilSeq: number;
  readonly version: string;                 // 'claims@g1'
  readonly items: readonly GoldenItem<ExpectedClaim>[];
  /** What the query left out, for the header line: verification event ids, and claim ids for prompt examples. */
  readonly excluded: { readonly harness: readonly string[]; readonly import: readonly string[]; readonly promptExamples: readonly string[] };
}

/** The text of a document version, to read the checked spans against. */
export type TextOf = (documentId: string, version: string) => string;

export interface GoldenOptions {
  readonly excludePromptExampleIds: readonly string[];
  readonly textOf: TextOf;
  readonly cutoffs?: Readonly<Record<string, number>>;
}

/** 'g1' → its seq; a number → itself; nothing → the end of the log. */
export function resolveCutoff(cutoff: string | undefined, logEnd: number, cutoffs: Readonly<Record<string, number>> = config.golden.cutoffs): number {
  if (cutoff === undefined) return logEnd;
  const named = cutoffs[cutoff];
  if (named !== undefined) return named;
  if (/^\d+$/.test(cutoff)) return Number(cutoff);
  throw new Error(`unknown golden cut-off "${cutoff}" (named: ${Object.keys(cutoffs).join(', ')})`);
}

/** The named cut-off at untilSeq; past every named cut-off, the next name (end of log after g1 = g2). */
export function goldenSetVersion(layer: string, untilSeq: number, cutoffs: Readonly<Record<string, number>> = config.golden.cutoffs): string {
  const named = Object.entries(cutoffs).sort(([, a], [, b]) => a - b);
  const exact = named.find(([, seq]) => seq === untilSeq);
  if (exact) return `${layer}@${exact[0]}`;
  if (named.every(([, seq]) => seq < untilSeq)) return `${layer}@g${named.length + 1}`;
  return `${layer}@seq${untilSeq}`;
}

/** The named cut-off strictly before untilSeq, if any: the set a later one is printed against. */
export function previousCutoff(untilSeq: number, cutoffs: Readonly<Record<string, number>> = config.golden.cutoffs): number | undefined {
  return Object.values(cutoffs).filter((seq) => seq < untilSeq).sort((a, b) => b - a)[0];
}

const WORD = /[\p{L}\p{N}]/u;

/**
 * A span reduced to its word boundaries: leading and trailing punctuation and spaces are not provenance.
 * TODO(luca): 03 (segment 2) has the reviewer check clm-attivo2m on [998,1062), the v1 span starting at the
 * ")" of "1) ", while 00 §5 and manifest.json fix the expected span at [1000,1062) and the worked IoU at
 * 62/64. The golden query reads the checked span at its word boundaries, which gives [1000,1062) and leaves
 * every other expected span unchanged.
 */
export function toWordBoundaries(span: Span, text: string): Span {
  let { start, end } = span;
  while (start < end && !WORD.test(text[start]!)) start++;
  while (end > start && !WORD.test(text[end - 1]!)) end--;
  return { ...span, start, end };
}

type Of<T extends LogEvent['type']> = Extract<LogEvent, { type: T }>;

/** Inputs in log order of their StructureVerified, sections in tree order; expected claims in verification order. */
export function goldenSet(events: readonly LogEvent[], layer: 'claims', untilSeq: number, opts: GoldenOptions): GoldenSet {
  const slice = events.filter((e) => e.seq <= untilSeq);
  const version = goldenSetVersion(layer, untilSeq, opts.cutoffs);
  const byId = new Map(slice.map((e) => [e.eventId, e] as const));
  const first = firstProposals(slice);
  const verifications = ofType(slice, 'ClaimVerified');
  const promptExamples = new Set(opts.excludePromptExampleIds);

  const groups = new Map<string, { input: GoldenInput; nodeIndex: number; seq: number; entries: { expected: ExpectedClaim; v: Of<'ClaimVerified'> }[] }>();
  const excludedExamples: string[] = [];
  for (const v of verifications) {
    if (v.actor.kind !== 'human') continue;
    const claimId = v.payload.claimId;
    const proposal = first.get(claimId);
    const structure = proposal?.causationId ? byId.get(proposal.causationId) : undefined;
    if (!proposal || structure?.type !== 'StructureVerified') continue;   // not extracted from a verified section
    if (promptExamples.has(claimId)) { excludedExamples.push(claimId); continue; }

    const nodes = proposedTree(slice, structure.payload.treeId)?.payload.nodes ?? [];
    const nodeIndex = nodes.findIndex((n) => n.path === proposal.payload.sectionPath);
    const span0 = proposal.payload.spans[0]!;
    const input: GoldenInput = {
      structureEventId: structure.eventId, treeId: structure.payload.treeId, documentId: span0.documentId, version: span0.version,
      sectionPath: proposal.payload.sectionPath, baseOffset: nodes[nodeIndex]?.start ?? 0,
    };
    // What the human read: the checked span of an agent proposal, or the spans of the reviewer's own claim.
    const checked = v.evidence.kind === 'human' && v.evidence.checkedSpan ? [v.evidence.checkedSpan as Span] : (proposal.payload.spans as Span[]);
    const text = opts.textOf(input.documentId, input.version);
    const cause = v.causationId ? byId.get(v.causationId) : undefined;
    const expected: ExpectedClaim = {
      subjectKey: proposal.payload.subjectKey as SubjectKey,
      value: proposal.payload.normalizedValue as NormalizedValue,
      spans: checked.map((s) => toWordBoundaries(s, text)),
      claimId,
      verifiedEventId: v.eventId,
      ...(cause?.type === 'ClaimContested' ? { resolvedEventId: cause.eventId } : {}),
    };

    const key = `${structure.eventId}#${input.sectionPath}`;
    const group = groups.get(key) ?? { input, nodeIndex, seq: structure.seq, entries: [] };
    group.entries.push({ expected, v });
    groups.set(key, group);
  }

  const items = [...groups.entries()]
    .sort(([, a], [, b]) => a.seq - b.seq || a.nodeIndex - b.nodeIndex)
    .map(([inputArtifactId, g]): GoldenItem<ExpectedClaim> => ({
      inputArtifactId,
      input: g.input,
      expected: g.entries.map((e) => e.expected),
      provenance: {
        verifiedBy: [...new Set(g.entries.map((e) => e.v.actor.id))].join(','),
        seq: Math.max(...g.entries.map((e) => e.v.seq)),
        goldenSetVersion: version,
      },
    }));

  return {
    layer, untilSeq, version, items,
    excluded: {
      harness: verifications.filter((v) => v.actor.kind === 'harness').map((v) => v.eventId),
      import: verifications.filter((v) => v.actor.kind === 'import').map((v) => v.eventId),
      promptExamples: excludedExamples,
    },
  };
}

export const expectedCount = (set: Pick<GoldenSet, 'items'>): number => set.items.reduce((n, i) => n + i.expected.length, 0);
