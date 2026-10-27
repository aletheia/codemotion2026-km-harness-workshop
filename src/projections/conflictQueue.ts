// ConflictQueue (04 §6): the open contested claims, each with the belief it conflicts with. Empty once
// the reviewer has resolved every conflict (end of segment 3).
import type { LogEvent } from '../events/schema';
import { claimRecords } from './claims';

export interface Conflict {
  readonly claimId: string;
  readonly label: string;
  readonly subjectKey: string;
  readonly conflictingClaimId: string;
  readonly contestedAt: number;              // seq of the ClaimContested
}

export function conflictQueue(events: readonly LogEvent[]): Conflict[] {
  return claimRecords(events)
    .filter((r) => r.state === 'contested')
    .map((r) => ({ claimId: r.claimId, label: r.label, subjectKey: r.subjectKey, conflictingClaimId: r.contested!.conflictingClaimId, contestedAt: r.contested!.seq }));
}
