// Identities are branded strings; all hashes are SHA-256 truncated to 16 hex chars (see hash.ts).
export type LineageId = string & { readonly __brand: 'LineageId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type ClaimId = string & { readonly __brand: 'ClaimId' };
export type EventId = string & { readonly __brand: 'EventId' };

export const lineageId = (s: string): LineageId => s as LineageId;
export const documentId = (s: string): DocumentId => s as DocumentId;
export const claimId = (s: string): ClaimId => s as ClaimId;
export const eventId = (s: string): EventId => s as EventId;
