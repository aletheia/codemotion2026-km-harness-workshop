// The Claims layer subset of the catalogue as static types (04 §7); the runtime schemas of every
// event type are in schema.ts.
import type { ClaimId, LineageId } from '../domain/ids';
import type { NormalizedValue, SubjectKey } from '../domain/claim';
import type { Span } from '../domain/span';
import type { DecisionEvent, FactEvent } from './envelope';

export type ClaimProposed = FactEvent<'ClaimProposed', {
  claimId: ClaimId;
  label?: string;
  lineageId: LineageId;
  subjectKey: SubjectKey;
  normalizedValue: NormalizedValue;
  spans: readonly [Span, ...Span[]];
  sectionPath: string;
}>;

export type ClaimVerified = DecisionEvent<'ClaimVerified', { claimId: ClaimId },
  | { kind: 'human';   note: string; checkedSpan?: Span }
  | { kind: 'class-A'; reconfirmedBeliefId: ClaimId; beliefEventId: string; batchId: string;
      probeResult: 'passed' | 'not-applicable'; auditSampled: boolean }
  | { kind: 'import';  sourceRecord: string }>;

export type ClaimContested = DecisionEvent<'ClaimContested', { claimId: ClaimId; conflictingClaimId: ClaimId },
  { dimension: 'same-subject-different-value'; values: [NormalizedValue, NormalizedValue]; spans: [Span, Span] }>;

export type ClaimSuperseded = DecisionEvent<'ClaimSuperseded', { claimId: ClaimId; successor: ClaimId },
  { reason: 'human-resolution' | 'reconfirmation-chain'; note?: string; validUntil?: string }>;

export type ClaimEvent = ClaimProposed | ClaimVerified | ClaimContested | ClaimSuperseded;

export const CLAIM_EVENT_TYPES: ReadonlySet<string> = new Set(['ClaimProposed', 'ClaimVerified', 'ClaimContested', 'ClaimSuperseded']);
