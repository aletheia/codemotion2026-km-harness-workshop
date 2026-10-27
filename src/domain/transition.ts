// Claim state machine. Pure. Returns the next state or a TransitionError.
import type { ClaimState } from './claim';
import type { ClaimId } from './ids';
import type { EvActorKind } from './policy';

export class TransitionError {
  constructor(public readonly message: string) {}
}

export interface TransitionCtx {
  actorKind: EvActorKind;
  /** A verified, non-superseded claim with a DIFFERENT value on the same (lineage, subjectKey). */
  conflictingVerifiedClaimId?: ClaimId;
}

export type ClaimEventType = 'ClaimProposed' | 'ClaimVerified' | 'ClaimContested' | 'ClaimSuperseded';

export function transition(state: ClaimState | undefined, type: ClaimEventType, ctx: TransitionCtx): ClaimState | TransitionError {
  const bad = (why: string) => new TransitionError(`${type} not allowed from ${state ?? 'nothing'}: ${why}`);
  switch (type) {
    case 'ClaimProposed':
      return state === undefined ? 'proposed' : bad('claim already exists');
    case 'ClaimVerified':
      if (state === 'proposed') {
        return ctx.conflictingVerifiedClaimId
          ? bad(`a verified claim with a different value exists (${ctx.conflictingVerifiedClaimId.slice(0, 8)}); contest first`)
          : 'verified';
      }
      return state === 'contested' ? 'verified' : bad('only proposed or contested claims can be verified');
    case 'ClaimContested':
      if (state === 'proposed') return 'contested';
      if (state === 'verified' && ctx.actorKind === 'human') return 'contested';
      return bad('only proposed claims (or verified ones, by a human) can be contested');
    case 'ClaimSuperseded':
      return state === 'verified' || state === 'contested' ? 'superseded' : bad('only verified or contested claims can be superseded');
  }
}
