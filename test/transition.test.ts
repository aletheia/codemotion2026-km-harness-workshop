import { describe, expect, it } from 'vitest';
import type { ClaimState } from '../src/domain/claim';
import { isTransitionError, transition } from '../src/domain/transition';
import {
  actors, CLAIM, classA, contested, humanNote, importRecord, OTHER, proposed, superseded, verified, type ClaimEvent,
} from './helpers';

const STATES: readonly (ClaimState | null)[] = [null, 'proposed', 'verified', 'contested', 'superseded'];

// Every (event type × actor × evidence) shape the matrix exercises. Shapes that the zod schema would
// already refuse (agent verify, human contest) are still fed to transition(): it must refuse them too.
const EVENTS: Record<string, ClaimEvent> = {
  'propose/agent': proposed(actors.agent),
  'propose/human': proposed(actors.human),
  'propose/harness': proposed(actors.harness),
  'propose/import': proposed(actors.import),
  'propose/process': proposed(actors.process),
  'verify/human': verified(actors.human, humanNote),
  'verify/human-with-classA': verified(actors.human, classA),
  'verify/harness-classA': verified(actors.harness, classA),
  'verify/harness-note': verified(actors.harness, humanNote),
  'verify/import': verified(actors.import, importRecord),
  'verify/import-note': verified(actors.import, humanNote),
  'verify/agent': verified(actors.agent, humanNote),
  'contest/harness': contested(actors.harness),
  'contest/human': contested(actors.human),
  'contest/agent': contested(actors.agent),
  'supersede/human': superseded(actors.human, 'human-resolution'),
  'supersede/harness-chain': superseded(actors.harness, 'reconfirmation-chain'),
  'supersede/harness-resolution': superseded(actors.harness, 'human-resolution'),
  'supersede/agent': superseded(actors.agent, 'human-resolution'),
  'supersede/import': superseded(actors.import, 'human-resolution'),
};

// The whole allowed table of 04 §5, including the two harness exceptions. Everything else is forbidden.
const ALLOWED: Record<string, ClaimState> = {
  '—|propose/agent': 'proposed',
  '—|propose/human': 'proposed',
  // Re-proposal of an existing claim (another extractor, same claim id): agreement, state unchanged.
  ...Object.fromEntries((['proposed', 'verified', 'contested', 'superseded'] as const).flatMap((s) =>
    (['agent', 'human'] as const).map((a) => [`${s}|propose/${a}`, s]))),
  'proposed|verify/human': 'verified',
  'proposed|verify/import': 'verified',
  'proposed|verify/harness-classA': 'verified',            // harness exception 1: class A
  'proposed|contest/harness': 'contested',
  'verified|contest/harness': 'contested',
  'contested|verify/human': 'verified',
  'contested|supersede/human': 'superseded',
  'verified|supersede/human': 'superseded',
  'verified|supersede/harness-chain': 'superseded',         // harness exception 2: reconfirmation chain
};

const cases = STATES.flatMap((state) => Object.keys(EVENTS).map((name) => ({ state, name, key: `${state ?? '—'}|${name}` })));

describe('transition(): the full state × event matrix', () => {
  it('the matrix covers every allowed entry', () => {
    const keys = new Set(cases.map((c) => c.key));
    for (const k of Object.keys(ALLOWED)) expect(keys.has(k)).toBe(true);
  });

  for (const { state, name, key } of cases) {
    const expected = ALLOWED[key];
    it(`${key} → ${expected ?? 'forbidden'}`, () => {
      const result = transition(state, EVENTS[name]!);
      if (expected) expect(result).toBe(expected);
      else expect(isTransitionError(result), JSON.stringify(result)).toBe(true);
    });
  }
});

describe('transition(): requirements beyond actor and state', () => {
  it('a proposal without a Span is refused', () => {
    expect(isTransitionError(transition(null, proposed(actors.agent, [])))).toBe(true);
  });

  it('no verify while a conflicting verified belief exists on the same subject', () => {
    for (const ev of [verified(actors.human, humanNote), verified(actors.harness, classA), verified(actors.import, importRecord)]) {
      const r = transition('proposed', ev, { conflictingVerifiedClaimId: OTHER });
      expect(isTransitionError(r)).toBe(true);
    }
  });

  it('a human resolving a contested claim may verify it even though the conflicting belief exists', () => {
    expect(transition('contested', verified(actors.human, humanNote), { conflictingVerifiedClaimId: OTHER })).toBe('verified');
  });

  it('successor is mandatory and may not be the claim itself', () => {
    expect(isTransitionError(transition('verified', superseded(actors.human, 'human-resolution', '' as never)))).toBe(true);
    expect(isTransitionError(transition('verified', superseded(actors.human, 'human-resolution', CLAIM)))).toBe(true);
    expect(isTransitionError(transition('contested', superseded(actors.human, 'human-resolution', CLAIM)))).toBe(true);
  });

  it('contest needs a conflicting claim other than itself', () => {
    expect(isTransitionError(transition('proposed', contested(actors.harness, CLAIM)))).toBe(true);
    expect(isTransitionError(transition('proposed', contested(actors.harness, '' as never)))).toBe(true);
  });

  it('errors name the event, the actor and the state', () => {
    const r = transition('verified', verified(actors.human, humanNote));
    expect(r).toEqual({ reason: 'ClaimVerified by human from verified: a verified claim is immutable' });
  });
});
