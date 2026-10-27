// Golden sets are a QUERY over the event log, not a file. Pure.
//   golden(layer, untilSeq) = decision events of that layer whose actor is human, with seq <= untilSeq,
//   minus harness/import decisions (circular) and minus items listed as prompt examples.
// The same query on the same log slice always returns the same items; the version is (layer, untilSeq).
import type { NormalizedValue } from '../domain/value';
import type { Fold } from '../projections/fold';
import type { StructureNode } from '../events/types';

export interface GoldenClaimItem {
  itemId: string; // the claim id: what `promptExampleIds` refers to
  documentId: string;
  version: string;
  sectionPath: string;
  subjectKey: string;
  valueText: string;
  value: NormalizedValue;
  /** ABSOLUTE coordinates in the document version. The human's reviewed span wins over the proposal's span. */
  span: { start: number; end: number };
  verifiedBy: string; // "human:<id>"
  seq: number; // seq of the human ClaimVerified
}
export interface GoldenStructureItem {
  itemId: string; // the tree id
  documentId: string;
  version: string;
  nodes: StructureNode[];
  verifiedBy: string;
  seq: number;
}

export interface GoldenOpts { excludeIds?: readonly string[] }

export function goldenClaims(f: Fold, untilSeq: number | undefined, opts: GoldenOpts = {}): GoldenClaimItem[] {
  const out: GoldenClaimItem[] = [];
  const excluded = new Set(opts.excludeIds ?? []);
  for (const rec of f.claims.values()) {
    if (excluded.has(rec.claim.claimId)) continue;
    const d = rec.decisions.find((x) => x.type === 'ClaimVerified' && x.actor.kind === 'human' && (untilSeq === undefined || x.seq <= untilSeq));
    if (!d) continue;
    const reviewed = d.evidence?.kind === 'human' ? d.evidence.reviewedSpans?.[0] : undefined;
    const sp = reviewed ?? rec.claim.spans[0];
    out.push({
      itemId: rec.claim.claimId, documentId: rec.documentId, version: rec.version, sectionPath: rec.sectionPath,
      subjectKey: rec.claim.subjectKey, valueText: rec.valueText, value: rec.claim.value,
      span: { start: sp.start, end: sp.end }, verifiedBy: `${d.actor.kind}:${d.actor.id}`, seq: d.seq,
    });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

export function goldenStructure(f: Fold, untilSeq: number | undefined, opts: GoldenOpts = {}): GoldenStructureItem[] {
  const excluded = new Set(opts.excludeIds ?? []);
  const out: GoldenStructureItem[] = [];
  for (const t of f.trees.values()) {
    if (!t.verifiedEventId || t.verifiedBy?.kind !== 'human' || excluded.has(t.treeId)) continue;
    if (untilSeq !== undefined && (t.verifiedSeq ?? 0) > untilSeq) continue;
    out.push({ itemId: t.treeId, documentId: t.documentId, version: t.version, nodes: t.nodes, verifiedBy: `${t.verifiedBy.kind}:${t.verifiedBy.id}`, seq: t.verifiedSeq! });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** The version of a golden set: the pair (layer, untilSeq), with untilSeq resolved to the log's last seq when absent. */
export const goldenVersion = (layer: string, f: Fold, untilSeq: number | undefined): string => `${layer}@${untilSeq ?? f.lastSeq}`;
