import type { ClaimId, DocumentId, LineageId } from './ids';
import { hash16 } from './ids';
import type { Span } from './span';
import { valueHash, type NormalizedValue } from './value';

export type ClaimState = 'proposed' | 'verified' | 'contested' | 'superseded';
export type SubjectKey = `${string}.${string}`;

export interface Claim {
  readonly claimId: ClaimId;
  readonly lineageId: LineageId;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly [Span, ...Span[]]; // "at least one Span" is the type, not a check
  readonly state: ClaimState;
  readonly successor?: ClaimId;
}

export function makeClaimId(documentId: DocumentId, version: string, subjectKey: SubjectKey, value: NormalizedValue): ClaimId {
  return hash16(documentId, version, subjectKey, valueHash(value)) as ClaimId;
}

export const isSubjectKey = (s: string): s is SubjectKey => /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(s);
