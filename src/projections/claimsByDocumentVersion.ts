// ClaimsByDocumentVersion (04 §6): every claim of each document version with its state, proposers and
// decisions — including the proposed and superseded ones CurrentBeliefs leaves out.
import type { LogEvent } from '../events/schema';
import { claimRecords, type ClaimRecord } from './claims';

/** Key 'cc-art2477@v8' → its claims, in log order. */
export function claimsByDocumentVersion(events: readonly LogEvent[]): Record<string, ClaimRecord[]> {
  const out: Record<string, ClaimRecord[]> = {};
  for (const r of claimRecords(events)) (out[`${r.documentId}@${r.version}`] ??= []).push(r);
  return out;
}
