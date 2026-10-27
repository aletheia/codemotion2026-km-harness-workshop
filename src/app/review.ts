// Human review actions. Every action is a human-actor event batch committed through `commit`.
import { buildEvent } from '../events/build';
import { asEventId, asClaimId, type EventId } from '../domain/ids';
import { absoluteToLocal, type LocalSpan } from '../domain/span';
import type { AnyDraft } from '../events/types';
import type { ClaimRec, Fold } from '../projections/fold';
import { commit } from './commit';
import { Rejection, UsageError } from './errors';
import { loadFold } from './context';
import { humanActor } from './actors';
import { claimDraft, unitFor } from './propose';
import { treeIdOf } from './structure';
import { normalize, valueEquals } from '../domain/value';

export function findClaim(f: Fold, ref: string): ClaimRec {
  if (ref.length < 4) throw new UsageError('claim id prefix too short (min 4 chars)');
  const hits = [...f.claims.values()].filter((c) => c.claim.claimId.startsWith(ref));
  if (hits.length === 0) throw new UsageError(`no claim with id starting ${ref}`);
  if (hits.length > 1) throw new UsageError(`claim id prefix ${ref} is ambiguous`);
  return hits[0]!;
}

export function findClaimBySubject(f: Fold, documentId: string, subjectKey: string, valueText: string, states: readonly string[]): ClaimRec | undefined {
  return [...f.claims.values()].find((c) => c.documentId === documentId && c.claim.subjectKey === subjectKey && states.includes(c.state) && normEq(c.valueText, valueText));
}
function normEq(a: string, b: string): boolean {
  try { return valueEquals(normalize(a), normalize(b)); } catch { return false; }
}

const lastEventId = (r: ClaimRec): EventId => {
  const all = [...r.proposals.map((p) => ({ seq: p.seq, id: p.eventId })), ...r.decisions.map((d) => ({ seq: d.seq, id: d.eventId }))];
  return asEventId(all.sort((a, b) => b.seq - a.seq)[0]!.id);
};

export function verifyClaim(ref: string, note: string, reviewedSpan?: { start: number; end: number }) {
  const f = loadFold();
  const rec = findClaim(f, ref);
  if (rec.state !== 'proposed' && rec.state !== 'contested') throw new Rejection(`claim ${rec.claim.claimId.slice(0, 8)} is ${rec.state}; only proposed or contested claims can be verified`);
  const draft = buildEvent({
    type: 'ClaimVerified', aggregateId: `claim:${rec.claim.claimId}`, actor: humanActor(), inputArtifactId: lastEventId(rec),
    causationId: lastEventId(rec), correlationId: `review-claims-${rec.version}`, payload: { claimId: rec.claim.claimId },
    evidence: { kind: 'human', note, ...(reviewedSpan ? { reviewedSpans: [reviewedSpan] } : {}) },
  });
  return commit([draft]);
}

/** Human adds a claim the extractor missed (or got wrong): ClaimProposed + ClaimVerified, atomically. */
export function addClaimByHand(a: { documentId: string; subjectKey: string; valueText: string; quote: string; span: { start: number; end: number }; note: string }) {
  const f = loadFold();
  const tree = f.trees.get(treeIdOf(a.documentId));
  const node = tree?.nodes.find((n) => n.type === 'article' && n.start <= a.span.start && a.span.end <= n.end);
  if (!node) throw new Rejection(`span [${a.span.start},${a.span.end}) is not inside one article of ${a.documentId}`);
  const unit = unitFor(f, a.documentId, node.path, { recordRejection: false });
  const local: LocalSpan = absoluteToLocal(a.span, unit.baseOffset);
  const actor = humanActor();
  const proposed = claimDraft(unit, actor, `review-claims-${unit.version}`, { subjectKey: a.subjectKey, valueText: a.valueText, quote: a.quote, span: local });
  const verified = buildEvent({
    type: 'ClaimVerified', aggregateId: proposed.aggregateId, actor, inputArtifactId: proposed.eventId,
    causationId: proposed.eventId, correlationId: proposed.correlationId, payload: { claimId: proposed.payload.claimId },
    evidence: { kind: 'human', note: a.note, handAdded: true },
  });
  return commit([proposed, verified]);
}

/** Resolve a contested claim: accept the new value (supersedes the belief) or keep the old one. */
export function resolveContested(ref: string, decision: 'accept-new' | 'keep-old', note: string) {
  const f = loadFold();
  const rec = findClaim(f, ref);
  if (rec.state !== 'contested') throw new Rejection(`claim ${rec.claim.claimId.slice(0, 8)} is ${rec.state}, not contested`);
  const contested = [...rec.decisions].reverse().find((d) => d.type === 'ClaimContested');
  if (!contested || contested.evidence?.kind !== 'class-C') throw new Rejection('contested claim has no class-C evidence');
  const beliefId = asClaimId(contested.evidence.beliefClaimId);
  const belief = f.claims.get(beliefId);
  if (!belief) throw new Rejection(`belief ${beliefId} not found`);
  const actor = humanActor();
  const drafts: AnyDraft[] = [];
  if (decision === 'accept-new') {
    const ver = buildEvent({
      type: 'ClaimVerified', aggregateId: `claim:${rec.claim.claimId}`, actor, inputArtifactId: lastEventId(rec),
      causationId: lastEventId(rec), correlationId: `review-contested-${rec.version}`, payload: { claimId: rec.claim.claimId },
      evidence: { kind: 'human', note },
    });
    const sup = buildEvent({
      type: 'ClaimSuperseded', aggregateId: `claim:${belief.claim.claimId}`, actor, inputArtifactId: ver.eventId,
      causationId: lastEventId(belief), correlationId: ver.correlationId,
      payload: { claimId: belief.claim.claimId, successor: rec.claim.claimId },
      evidence: { kind: 'supersession', supersededBy: rec.claim.claimId, reason: 'human-resolution' },
    });
    drafts.push(ver, sup);
  } else {
    const sup = buildEvent({
      type: 'ClaimSuperseded', aggregateId: `claim:${rec.claim.claimId}`, actor, inputArtifactId: lastEventId(rec),
      causationId: lastEventId(rec), correlationId: `review-contested-${rec.version}`,
      payload: { claimId: rec.claim.claimId, successor: belief.claim.claimId },
      evidence: { kind: 'supersession', supersededBy: belief.claim.claimId, reason: 'human-resolution' },
    });
    drafts.push(sup);
  }
  return commit(drafts);
}

export const proposedClaims = (f: Fold, documentId: string): ClaimRec[] =>
  [...f.claims.values()].filter((c) => c.documentId === documentId && c.state === 'proposed').sort((a, b) => a.firstSeq - b.firstSeq);
export const contestedClaims = (f: Fold): ClaimRec[] =>
  [...f.claims.values()].filter((c) => c.state === 'contested').sort((a, b) => a.firstSeq - b.firstSeq);
