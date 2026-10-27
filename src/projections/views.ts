// Views over the fold. Pure.
import { hash16 } from '../domain/ids';
import type { Actor } from '../events/types';
import { formatValue } from '../domain/value';
import { FoldError, type ClaimRec, type DecisionRec, type Fold } from './fold';

export class BeliefInvariantError extends FoldError {}

export type Root = 'human' | 'import' | 'harness-only';

export interface Belief {
  lineageId: string;
  subjectKey: string;
  rec: ClaimRec;
  verification: DecisionRec; // the decision that made it verified
  verifiedBy: Actor;
  /** Claim ids from this claim back to the root decision (this claim first). */
  chain: string[];
  root: Root;
  rootActor: Actor | null;
}

const lastVerification = (r: ClaimRec): DecisionRec | undefined => [...r.decisions].reverse().find((d) => d.type === 'ClaimVerified');

/** Follows class-A reconfirmations back to the first non-harness verification. */
export function traceRoot(f: Fold, rec: ClaimRec): { chain: string[]; root: Root; rootActor: Actor | null } {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: ClaimRec | undefined = rec;
  while (cur) {
    if (seen.has(cur.claim.claimId)) throw new BeliefInvariantError(`reconfirmation cycle at ${cur.claim.claimId}`);
    seen.add(cur.claim.claimId);
    chain.push(cur.claim.claimId);
    const v = lastVerification(cur);
    if (!v) return { chain, root: 'harness-only', rootActor: null };
    if (v.actor.kind === 'human') return { chain, root: 'human', rootActor: v.actor };
    if (v.actor.kind === 'import') return { chain, root: 'import', rootActor: v.actor };
    const prev = v.evidence?.kind === 'class-A' ? v.evidence.reconfirmed.claimId : undefined;
    if (!prev) return { chain, root: 'harness-only', rootActor: null };
    cur = f.claims.get(prev);
  }
  return { chain, root: 'harness-only', rootActor: null };
}

function toBelief(f: Fold, rec: ClaimRec): Belief {
  const verification = lastVerification(rec);
  if (!verification) throw new BeliefInvariantError(`claim ${rec.claim.claimId} is verified without a ClaimVerified decision`);
  return { lineageId: rec.claim.lineageId, subjectKey: rec.claim.subjectKey, rec, verification, verifiedBy: verification.actor, ...traceRoot(f, rec) };
}

/**
 * CurrentBeliefs: keyed by (lineageId, subjectKey), at most one verified non-superseded claim per key.
 * A second one means the COMPARATOR failed to supersede: build throws and says so.
 */
export function currentBeliefs(f: Fold): Map<string, Belief> {
  const out = new Map<string, Belief>();
  for (const rec of f.claims.values()) {
    if (rec.state !== 'verified') continue;
    const key = `${rec.claim.lineageId}|${rec.claim.subjectKey}`;
    const prev = out.get(key);
    if (prev) {
      throw new BeliefInvariantError(
        `two verified claims for ${rec.claim.subjectKey} (${prev.rec.claim.claimId.slice(0, 8)}, ${rec.claim.claimId.slice(0, 8)}): the comparator did not supersede`,
      );
    }
    out.set(key, toBelief(f, rec));
  }
  return out;
}

/** Edition in force on a date (VALID time): latest effectiveFrom <= date within the lineage. */
export function editionInForce(f: Fold, lineageId: string, date: string): string | undefined {
  let best: { id: string; from: string } | undefined;
  for (const d of f.docs.values()) {
    if (d.lineageId !== lineageId || d.effectiveFrom > date) continue;
    if (!best || d.effectiveFrom > best.from) best = { id: d.documentId, from: d.effectiveFrom };
  }
  return best?.id;
}

/**
 * Beliefs about the edition in force on `date` (valid time). Transaction time is a separate
 * axis: fold the log only up to SEQ before calling this (foldEvents(events, {untilSeq})).
 * A claim counts if it was ever verified and is not contested/proposed now (superseded
 * claims still describe their own edition).
 */
export function beliefsAtDate(f: Fold, lineageId: string, date: string): { documentId: string | undefined; beliefs: Belief[] } {
  const documentId = editionInForce(f, lineageId, date);
  if (!documentId) return { documentId, beliefs: [] };
  const out: Belief[] = [];
  for (const rec of f.claims.values()) {
    if (rec.documentId !== documentId || rec.claim.lineageId !== lineageId) continue;
    if (rec.state !== 'verified' && rec.state !== 'superseded') continue;
    out.push(toBelief(f, rec));
  }
  return { documentId, beliefs: out.sort((a, b) => a.subjectKey.localeCompare(b.subjectKey)) };
}

export function beliefJson(b: Belief) {
  return {
    subjectKey: b.subjectKey,
    claimId: b.rec.claim.claimId,
    document: `${b.rec.documentId}@${b.rec.version}`,
    value: formatValue(b.rec.claim.value),
    state: b.rec.state,
    span: { start: b.rec.claim.spans[0].start, end: b.rec.claim.spans[0].end },
    verifiedBy: `${b.verifiedBy.kind}:${b.verifiedBy.id}`,
    verifiedSeq: b.verification.seq,
    root: b.root,
    chain: b.chain,
  };
}

/** Hash of the CurrentBeliefs projection: proves a drop/rebuild reproduced the same state. */
export function beliefsHash(f: Fold): string {
  const rows = [...currentBeliefs(f).values()].map(beliefJson).sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  return hash16(JSON.stringify(rows));
}

export const claimsOfDocument = (f: Fold, documentId: string): ClaimRec[] =>
  [...f.claims.values()].filter((c) => c.documentId === documentId).sort((a, b) => a.firstSeq - b.firstSeq);
