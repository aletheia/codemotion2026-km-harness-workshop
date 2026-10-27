// State is a fold of the log. Projections (phase D) are built on these two functions.
import type { ClaimId } from '../domain/ids';
import type { ClaimState } from '../domain/claim';
import { transition, isTransitionError } from '../domain/transition';
import { CLAIM_EVENT_TYPES, type ClaimEvent } from './catalogue';
import type { LogEvent } from './schema';

export function fold<S>(events: readonly LogEvent[], initial: S, step: (state: S, event: LogEvent) => S): S {
  let state = initial;
  for (const e of events) state = step(state, e);
  return state;
}

export const isClaimEvent = (e: LogEvent): boolean => CLAIM_EVENT_TYPES.has(e.type);

/** Claim id → state, replaying every Claims-layer event through transition(); throws on an illegal step. */
export function claimStates(events: readonly LogEvent[]): ReadonlyMap<ClaimId, ClaimState> {
  return fold(events, new Map<ClaimId, ClaimState>(), (states, e) => {
    if (!isClaimEvent(e)) return states;
    const ev = e as unknown as ClaimEvent;     // schema-validated by readLog; ids are branded here
    const id = ev.payload.claimId;
    const next = transition(states.get(id) ?? null, ev);
    if (isTransitionError(next)) throw new Error(`seq ${e.seq}: ${next.reason}`);
    states.set(id, next);
    return states;
  });
}
