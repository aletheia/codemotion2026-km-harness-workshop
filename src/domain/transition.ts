// The Claim state machine as a pure function: the allowed table is 04-domain-model-reference.md §5.
//
// | From                | To                    | Event                            | Actor                                   |
// | —                   | proposed              | ClaimProposed                    | agent or human (≥ 1 Span)               |
// | proposed            | verified              | ClaimVerified                    | human; import (priors); harness class A |
// | proposed / verified | contested             | ClaimContested                   | harness (conflicting claim referenced)  |
// | contested           | verified / superseded | ClaimVerified / ClaimSuperseded  | human only                              |
// | verified            | superseded            | ClaimSuperseded                  | human; harness reconfirmation-chain     |
//
// The two harness exceptions: harness may verify only with class-A evidence, and may supersede only a
// verified claim with reason 'reconfirmation-chain' (identical-value reconfirmation). Everything else
// that is not in the table is a TransitionError. superseded is terminal; a verified claim is immutable.
import type { ClaimEvent } from '../events/catalogue';
import type { ClaimState } from './claim';
import type { ClaimId } from './ids';

export type TransitionError = { readonly reason: string };

export interface TransitionContext {
  /** A verified, non-superseded claim on the same (lineage, subject key) with a different value. */
  readonly conflictingVerifiedClaimId?: ClaimId;
}

export const isTransitionError = (r: ClaimState | TransitionError): r is TransitionError => typeof r === 'object';

const fail = (reason: string): TransitionError => ({ reason });

export function transition(state: ClaimState | null, event: ClaimEvent, ctx: TransitionContext = {}): ClaimState | TransitionError {
  const actor = event.actor.kind;
  const from = state ?? '—';
  const refuse = (why: string) => fail(`${event.type} by ${actor} from ${from}: ${why}`);

  switch (event.type) {
    case 'ClaimProposed':
      if (state !== null) return refuse('claim already exists');
      if (actor !== 'agent' && actor !== 'human') return refuse('only an agent or a human proposes');
      if (event.payload.spans.length < 1) return refuse('a Claim needs at least one Span');
      return 'proposed';

    case 'ClaimVerified':
      if (state === 'proposed') {
        if (ctx.conflictingVerifiedClaimId) return refuse(`conflicting verified claim ${ctx.conflictingVerifiedClaimId} on the same subject`);
        if (actor === 'human') return event.evidence.kind === 'human' ? 'verified' : refuse('human verification needs a human note');
        if (actor === 'import') return event.evidence.kind === 'import' ? 'verified' : refuse('import verification needs a source record');
        // Harness exception 1: class-A reconfirmation only.
        if (actor === 'harness') return event.evidence.kind === 'class-A' ? 'verified' : refuse('harness verifies only in class A');
        return refuse('agents never verify');
      }
      if (state === 'contested') {
        if (actor !== 'human') return refuse('only a human resolves a contested claim');
        return event.evidence.kind === 'human' ? 'verified' : refuse('human verification needs a human note');
      }
      return refuse(state === 'verified' ? 'a verified claim is immutable' : 'not allowed');

    case 'ClaimContested':
      if (state !== 'proposed' && state !== 'verified') return refuse('only proposed or verified claims can be contested');
      if (actor !== 'harness') return refuse('only the harness contests');
      if (!event.payload.conflictingClaimId) return refuse('conflicting claim reference mandatory');
      if (event.payload.conflictingClaimId === event.payload.claimId) return refuse('a claim cannot conflict with itself');
      return 'contested';

    case 'ClaimSuperseded':
      if (!event.payload.successor) return refuse('successor mandatory');
      if (event.payload.successor === event.payload.claimId) return refuse('a claim cannot supersede itself');
      if (state === 'contested') return actor === 'human' ? 'superseded' : refuse('only a human resolves a contested claim');
      if (state === 'verified') {
        if (actor === 'human') return 'superseded';
        // Harness exception 2: identical-value reconfirmation chain.
        if (actor === 'harness') return event.evidence.reason === 'reconfirmation-chain' ? 'superseded' : refuse('harness supersedes only on a reconfirmation chain');
        return refuse('only a human or the harness supersedes');
      }
      return refuse(state === 'superseded' ? 'superseded is terminal' : 'only verified or contested claims can be superseded');
  }
}
