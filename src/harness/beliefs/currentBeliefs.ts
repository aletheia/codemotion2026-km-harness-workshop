// CurrentBeliefs (04-domain-model-reference.md §6): a fold over the Claims layer keyed (lineageId, subjectKey).
// A belief is a verified, non-superseded claim, with who verified it and the root of its evidence chain: a
// harness class-A verification is rooted where the reconfirmed belief was rooted (human, import), so the
// consumption policy of segment 6 can ask "is this human-rooted?" of a harness-verified belief.
//
// Invariant: at most one belief per key. Two verified claims may share a key for one event in the log
// (a class-A verification is followed by the supersession of the reconfirmed claim; a human resolution
// verifies the successor, then supersedes the predecessor), so the invariant is checked on the folded
// result, in build(), not after each event.
import type { NormalizedValue, SubjectKey } from '../../domain/claim';
import type { Span } from '../../domain/span';
import type { ActorKind } from '../../events/actor';
import { claimStates } from '../../events/fold';
import { firstProposals, ofType } from '../../events/lookup';
import type { LogEvent } from '../../events/schema';

/** `${lineageId}|${subjectKey}`, e.g. 'cc-art2477|ricavi.limite': one belief per key. */
export type BeliefKey = `${string}|${string}`;

export const beliefKey = (lineageId: string, subjectKey: string): BeliefKey => `${lineageId}|${subjectKey}`;

/** Where an evidence chain can end: a harness verification always points back to one of these. */
export type RootKind = Extract<ActorKind, 'human' | 'import'>;

export interface Belief {
  readonly claimId: string;
  readonly label?: string;
  readonly lineageId: string;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
  readonly proposedEventId: string;
  /** The actor of the last verification; 'harness' for a class-A reconfirmation. */
  readonly verifiedBy: Extract<ActorKind, 'human' | 'harness' | 'import'>;
  readonly verifierId: string;              // 'luca', 'compare'
  readonly verifiedEventId: string;
  /** Who the evidence chain ends at: the kind, the claim and the verification event of the root. */
  readonly root: { readonly kind: RootKind; readonly claimId: string; readonly eventId: string };
}

export class BeliefInvariantViolated extends Error {
  constructor(readonly key: BeliefKey, readonly claimIds: readonly string[]) {
    super(`CurrentBeliefs: two verified non-superseded claims on ${key} (${claimIds.join(', ')}); ` +
      'the comparator is at fault: it must contest a different value and supersede an identical one');
    this.name = 'BeliefInvariantViolated';
  }
}

/** Folds the whole log; throws if a claim event breaks the lifecycle or the one-belief-per-key invariant. */
export function build(events: readonly LogEvent[]): ReadonlyMap<BeliefKey, Belief> {
  const states = claimStates(events);
  // The first proposal of each claim: a re-proposal by a candidate extractor does not change its label or spans.
  const proposals = firstProposals(events);

  // The verification of each verified claim, and the root of its chain (resolved in log order).
  const verifiedBy = new Map<string, Extract<LogEvent, { type: 'ClaimVerified' }>>();
  const roots = new Map<string, Belief['root']>();
  for (const v of ofType(events, 'ClaimVerified')) {
    const id = v.payload.claimId;
    verifiedBy.set(id, v);
    if (v.evidence.kind === 'class-A') {
      // Inherit the root of the reconfirmed belief. It was verified earlier in the log, so its root is
      // already known even though it is superseded by now (clm-eserc2b → clm-eserc2 → human).
      const root = roots.get(v.evidence.reconfirmedBeliefId);
      if (!root) throw new Error(`seq ${v.seq}: class-A verification of ${id} reconfirms ${v.evidence.reconfirmedBeliefId}, which was never verified`);
      roots.set(id, root);
    } else {
      // A human or import verification is its own root.
      roots.set(id, { kind: v.evidence.kind, claimId: id, eventId: v.eventId });
    }
  }

  const beliefs = new Map<BeliefKey, Belief>();
  // Only 'verified' claims are beliefs: superseded ones are history, contested ones await a human.
  for (const [claimId, state] of states) {
    if (state !== 'verified') continue;
    const p = proposals.get(claimId)!;
    const v = verifiedBy.get(claimId)!;
    const key = beliefKey(p.payload.lineageId, p.payload.subjectKey);
    const existing = beliefs.get(key);
    if (existing) throw new BeliefInvariantViolated(key, [existing.claimId, claimId]);
    beliefs.set(key, {
      claimId,
      ...(p.payload.label ? { label: p.payload.label } : {}),
      lineageId: p.payload.lineageId,
      subjectKey: p.payload.subjectKey as SubjectKey,
      value: p.payload.normalizedValue as NormalizedValue,
      spans: p.payload.spans as Span[],
      proposedEventId: p.eventId,
      verifiedBy: v.actor.kind,
      verifierId: v.actor.id,
      verifiedEventId: v.eventId,
      root: roots.get(claimId)!,
    });
  }
  return beliefs;
}
