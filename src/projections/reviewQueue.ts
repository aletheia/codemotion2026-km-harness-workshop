// ReviewQueue (04 §6): the claims still proposed, waiting for a human. Only proposals of the promoted
// extractor or of a human count: a candidate version's proposals (claims@v2 on replay) are not work for
// the reviewer until the version is promoted. A subject the catalogue does not resolve is UNEXPECTED,
// high priority. Rows stay in log order; `agreement` counts the extractors that proposed the same claim.
import { lookupSubject } from '../catalog/subjects';
import { promotedVersion } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { claimRecords } from './claims';

export interface ReviewItem {
  readonly claimId: string;
  readonly label: string;
  readonly subjectKey: string;
  readonly priority: 'high' | 'normal';
  readonly unexpected: boolean;
  readonly agreement: number;
}

export function reviewQueue(events: readonly LogEvent[]): ReviewItem[] {
  const promoted = promotedVersion(events, 'claims');
  return claimRecords(events)
    .filter((r) => r.state === 'proposed' && r.proposers.some((p) => p === promoted || p === 'human'))
    .map((r) => {
      const unexpected = lookupSubject(r.subjectKey) === undefined;
      return { claimId: r.claimId, label: r.label, subjectKey: r.subjectKey, priority: unexpected ? 'high' : 'normal', unexpected, agreement: new Set(r.proposers).size };
    });
}
