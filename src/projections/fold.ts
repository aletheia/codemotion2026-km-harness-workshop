// The single fold: events -> state. Every projection is a view of this state.
// Pure; throws FoldError when the log violates an invariant (the log is corrupt, not the caller wrong).
import type { Claim, ClaimState, SubjectKey } from '../domain/claim';
import type { ClaimId, EventId } from '../domain/ids';
import { asClaimId, asLineageId } from '../domain/ids';
import { transition, TransitionError, type ClaimEventType } from '../domain/transition';
import { valueEquals } from '../domain/value';
import type { Actor, AnyStoredEvent, Evidence, StructureNode } from '../events/types';

export class FoldError extends Error {}

export interface DocRec {
  documentId: string; lineageId: string; version: string; effectiveFrom: string;
  contentHash: string; length: number; eventId: EventId; seq: number;
}
export interface TreeRec {
  treeId: string; documentId: string; version: string; nodes: StructureNode[];
  proposedEventId: EventId; proposedSeq: number; proposer: Actor;
  verifiedEventId?: EventId; verifiedSeq?: number; verifiedBy?: Actor; verifiedEvidence?: Evidence;
}
export interface ProposalRec { eventId: EventId; seq: number; actor: Actor; extractorVersion: string; causationId: EventId | null }
export interface DecisionRec { type: ClaimEventType; eventId: EventId; seq: number; actor: Actor; evidence?: Evidence }
export interface ClaimRec {
  claim: Claim;
  documentId: string; version: string; valueText: string; quote: string; sectionPath: string;
  state: ClaimState;
  proposals: ProposalRec[];
  decisions: DecisionRec[];
  firstSeq: number;
}
export interface PromotionRec { seq: number; extractor: string; version: string; previous: string | null; actor: Actor }
export interface Fold {
  events: AnyStoredEvent[];
  lastSeq: number;
  initialised: boolean;
  docs: Map<string, DocRec>; // key: documentId
  trees: Map<string, TreeRec>; // key: treeId
  claims: Map<string, ClaimRec>;
  promotions: PromotionRec[];
  rejections: AnyStoredEvent[];
}

export const emptyFold = (): Fold => ({
  events: [], lastSeq: 0, initialised: false, docs: new Map(), trees: new Map(), claims: new Map(), promotions: [], rejections: [],
});

export function foldEvents(events: readonly AnyStoredEvent[], opts: { untilSeq?: number } = {}): Fold {
  const f = emptyFold();
  for (const e of events) {
    if (opts.untilSeq !== undefined && e.seq > opts.untilSeq) break;
    applyEvent(f, e);
  }
  return f;
}

export function conflictingVerified(f: Fold, rec: ClaimRec): ClaimRec | undefined {
  for (const o of f.claims.values()) {
    if (o.claim.claimId === rec.claim.claimId) continue;
    if (o.claim.lineageId === rec.claim.lineageId && o.claim.subjectKey === rec.claim.subjectKey &&
        o.state === 'verified' && !valueEquals(o.claim.value, rec.claim.value)) return o;
  }
  return undefined;
}

export function applyEvent(f: Fold, e: AnyStoredEvent): void {
  if (e.seq !== f.lastSeq + 1) throw new FoldError(`log gap or reorder: expected seq ${f.lastSeq + 1}, found ${e.seq}`);
  f.lastSeq = e.seq;
  f.events.push(e);
  switch (e.type) {
    case 'LogInitialised':
      if (f.initialised) throw new FoldError(`seq ${e.seq}: LogInitialised twice`);
      f.initialised = true;
      return;
    case 'DocumentVersionIngested': {
      const p = e.payload;
      f.docs.set(p.documentId, { ...p, eventId: e.eventId, seq: e.seq });
      return;
    }
    case 'ACLRejected':
      f.rejections.push(e);
      return;
    case 'CursorAdvanced':
      return;
    case 'StructureProposed': {
      const p = e.payload;
      f.trees.set(p.treeId, { treeId: p.treeId, documentId: p.documentId, version: p.version, nodes: p.nodes, proposedEventId: e.eventId, proposedSeq: e.seq, proposer: e.actor });
      return;
    }
    case 'StructureVerified': {
      const t = f.trees.get(e.payload.treeId);
      if (!t) throw new FoldError(`seq ${e.seq}: StructureVerified for unknown tree ${e.payload.treeId}`);
      if (t.verifiedEventId) throw new FoldError(`seq ${e.seq}: tree ${t.treeId} already verified`);
      t.verifiedEventId = e.eventId; t.verifiedSeq = e.seq; t.verifiedBy = e.actor; t.verifiedEvidence = e.evidence;
      return;
    }
    case 'ClaimProposed': {
      const p = e.payload;
      const prop: ProposalRec = {
        eventId: e.eventId, seq: e.seq, actor: e.actor, causationId: e.causationId,
        extractorVersion: e.actor.kind === 'agent' ? e.actor.extractorVersion : 'human',
      };
      const existing = f.claims.get(p.claimId);
      if (existing) { existing.proposals.push(prop); return; } // attribution only: no state change
      const spans = p.spans as unknown as Claim['spans'];
      const claim: Claim = {
        claimId: asClaimId(p.claimId), lineageId: asLineageId(p.lineageId), subjectKey: p.subjectKey as SubjectKey,
        value: p.value, spans, state: 'proposed',
      };
      const s = transition(undefined, 'ClaimProposed', { actorKind: e.actor.kind });
      if (s instanceof TransitionError) throw new FoldError(`seq ${e.seq}: ${s.message}`);
      f.claims.set(p.claimId, {
        claim, documentId: p.documentId, version: p.version, valueText: p.valueText, quote: p.quote, sectionPath: p.sectionPath,
        state: s, proposals: [prop], decisions: [], firstSeq: e.seq,
      });
      return;
    }
    case 'ClaimVerified':
    case 'ClaimContested':
    case 'ClaimSuperseded': {
      const id = e.payload.claimId;
      const rec = f.claims.get(id);
      if (!rec) throw new FoldError(`seq ${e.seq}: ${e.type} for unknown claim ${id}`);
      const conflict = e.type === 'ClaimVerified' ? conflictingVerified(f, rec) : undefined;
      const next = transition(rec.state, e.type, { actorKind: e.actor.kind, conflictingVerifiedClaimId: conflict?.claim.claimId });
      if (next instanceof TransitionError) throw new FoldError(`seq ${e.seq}: claim ${id.slice(0, 8)}: ${next.message}`);
      if (e.type === 'ClaimSuperseded') {
        const succ = f.claims.get(e.payload.successor);
        if (!succ || succ.state !== 'verified' || succ.claim.subjectKey !== rec.claim.subjectKey) {
          throw new FoldError(`seq ${e.seq}: successor ${e.payload.successor.slice(0, 8)} must be a verified claim on ${rec.claim.subjectKey}`);
        }
        rec.claim = { ...rec.claim, successor: asClaimId(e.payload.successor) };
      }
      rec.state = next;
      rec.claim = { ...rec.claim, state: next };
      rec.decisions.push({ type: e.type, eventId: e.eventId, seq: e.seq, actor: e.actor, evidence: e.evidence });
      return;
    }
    case 'ExtractorVersionPromoted':
      f.promotions.push({ seq: e.seq, ...e.payload, actor: e.actor });
      return;
  }
}
