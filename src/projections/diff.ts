// Pure: what each extractor version proposed for a document, side by side.
// Reads ProposalRec (every ClaimProposed event keeps its own span), never the claim's first span.
import { formatValue } from '../domain/value';
import type { Fold } from './fold';

export interface Cell { valueText: string; value: string; claimId: string; start: number; end: number; state: string }
export type RowStatus = 'same' | 'changed' | 'only-from' | 'only-to';
export interface DiffRow { subjectKey: string; from: Cell[]; to: Cell[]; status: RowStatus }

/** Extractor versions that have proposed at least one claim for the document (humans excluded), in first-seen order. */
export function extractorsFor(f: Fold, documentId: string): string[] {
  const seen: string[] = [];
  for (const rec of f.claims.values()) {
    if (rec.documentId !== documentId) continue;
    for (const p of rec.proposals) if (p.actor.kind === 'agent' && !seen.includes(p.extractorVersion)) seen.push(p.extractorVersion);
  }
  return seen;
}

function cellsOf(f: Fold, documentId: string, extractor: string): Map<string, Cell[]> {
  const out = new Map<string, Cell[]>();
  for (const rec of f.claims.values()) {
    if (rec.documentId !== documentId) continue;
    for (const p of rec.proposals) {
      if (p.actor.kind !== 'agent' || p.extractorVersion !== extractor) continue;
      const list = out.get(rec.claim.subjectKey) ?? [];
      list.push({ valueText: p.valueText, value: formatValue(rec.claim.value), claimId: rec.claim.claimId, start: p.spans[0].start, end: p.spans[0].end, state: rec.state });
      out.set(rec.claim.subjectKey, list);
    }
  }
  return out;
}

export function diffDocument(f: Fold, documentId: string, from: string, to: string): DiffRow[] {
  const a = cellsOf(f, documentId, from);
  const b = cellsOf(f, documentId, to);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return keys.map((subjectKey): DiffRow => {
    const fa = a.get(subjectKey) ?? [];
    const tb = b.get(subjectKey) ?? [];
    const ids = (cs: Cell[]) => cs.map((c) => c.claimId).sort().join(',');
    const status: RowStatus = fa.length === 0 ? 'only-to' : tb.length === 0 ? 'only-from' : ids(fa) === ids(tb) ? 'same' : 'changed';
    return { subjectKey, from: fa, to: tb, status };
  });
}
