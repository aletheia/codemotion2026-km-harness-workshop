// Identities are branded strings; every hash is SHA-256 truncated to 16 hex chars.
// Derivations (also stated in the domain model reference):
//   claimId = hash16(documentId, version, subjectKey, hash16(valueKey))
//   eventId = hash16(producer, inputArtifactId, extractorVersion, eventType, aggregateId)
import { createHash } from 'node:crypto';

export type LineageId = string & { readonly __brand: 'LineageId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type ClaimId = string & { readonly __brand: 'ClaimId' };
export type EventId = string & { readonly __brand: 'EventId' };

export function hash16(...parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex').slice(0, 16);
}

export const asLineageId = (s: string) => s as LineageId;
export const asDocumentId = (s: string) => s as DocumentId;
export const asClaimId = (s: string) => s as ClaimId;
export const asEventId = (s: string) => s as EventId;

export const short = (id: string, n = 8): string => id.slice(0, n);
