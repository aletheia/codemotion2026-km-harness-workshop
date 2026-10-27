import { hashTuple, sha256_16 } from './hash';
import type { ClaimId, DocumentId, LineageId } from './ids';
import type { Span } from './span';

export type ClaimState = 'proposed' | 'verified' | 'contested' | 'superseded';
export type SubjectKey = `${string}.${string}`;          // 'attivo.limite', 'ricavi.limite', 'esercizi.consecutivi'

export type NormalizedValue =
  | { readonly type: 'money'; readonly amount: number; readonly currency: 'EUR' }
  | { readonly type: 'integer'; readonly value: number; readonly unit?: 'years' | 'days' | 'count' }
  | { readonly type: 'percent'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'enum'; readonly value: string }
  | { readonly type: 'date'; readonly value: string }
  | { readonly type: 'reference'; readonly lineageId: LineageId };   // 'limiti.riferimento' → art. 2435-bis (v7 only)

export interface Claim {                     // aggregate root
  readonly claimId: ClaimId;                 // hash(documentId, version, subjectKey, hash(normalizedValue))
  readonly lineageId: LineageId;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly [Span, ...Span[]];   // the invariant "≥ 1 Span" is the type, not a check
  readonly state: ClaimState;
  readonly successor?: ClaimId;              // mandatory when state === 'superseded' (enforced by transition)
}

/** Canonical encoding of a normalized value: fixed key order, so equal values hash equally. */
export function canonicalValue(v: NormalizedValue): string {
  switch (v.type) {
    case 'money': return JSON.stringify([v.type, v.amount, v.currency]);
    case 'integer': return JSON.stringify([v.type, v.value, v.unit ?? null]);
    case 'reference': return JSON.stringify([v.type, v.lineageId]);
    default: return JSON.stringify([v.type, v.value]);
  }
}

export function sameValue(a: NormalizedValue, b: NormalizedValue): boolean {
  return canonicalValue(a) === canonicalValue(b);
}

/** claimId = SHA-256 (16 hex) of (documentId, version, subjectKey, SHA-256 (16 hex) of the canonical normalized value). */
export function deriveClaimId(documentId: DocumentId, version: string, subjectKey: SubjectKey, value: NormalizedValue): ClaimId {
  return hashTuple([documentId, version, subjectKey, sha256_16(canonicalValue(value))]) as ClaimId;
}
