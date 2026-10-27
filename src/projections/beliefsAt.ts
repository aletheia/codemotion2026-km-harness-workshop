// BeliefsAtDate (04 §6) — two time axes:
//   valid time (--at <date>)        the beliefs of the document version in force on the date: for each
//                                   subject, the claim of that version that was verified, even if it has
//                                   been superseded since by a later version (the March thresholds on
//                                   2019-04-30). The period is [effectiveFrom, next version's effectiveFrom).
//   transaction time (--seq <n>)    CurrentBeliefs folded over the log up to seq n: what we knew then.
// In the workshop every event is appended on 28 Oct 2026, so only valid time is interesting on stage.
import type { LogEvent } from '../events/schema';
import { build, type Belief, type BeliefKey } from '../harness/beliefs/currentBeliefs';
import { claimRecords, versionValidity, type ClaimRecord, type VersionValidity } from './claims';
import { catalogueRank } from './currentBeliefs';

export interface DatedBelief {
  readonly record: ClaimRecord;
  readonly validity: VersionValidity;
}

export function versionInForce(events: readonly LogEvent[], lineageId: string, date: string): VersionValidity | undefined {
  return versionValidity(events, lineageId).find((v) => v.from <= date && (v.to === undefined || date < v.to));
}

/** Valid time: one belief per subject key of the version in force on `date`, in catalogue order. */
export function beliefsAtDate(events: readonly LogEvent[], lineageId: string, date: string): DatedBelief[] {
  const validity = versionInForce(events, lineageId, date);
  if (!validity) return [];
  const records = claimRecords(events);
  const inVersion = records.filter((r) => r.lineageId === lineageId && r.documentId === validity.documentId && r.version === validity.version);
  const byId = new Map(records.map((r) => [r.claimId, r] as const));
  // Ever verified, and not replaced by a successor within the same version (a correction is not a new regime).
  const believed = inVersion.filter((r) => r.verified && !(r.superseded && byId.get(r.superseded.successor)?.version === r.version));

  const seen = new Set<string>();
  for (const r of believed) {
    if (seen.has(r.subjectKey)) throw new Error(`beliefsAt ${date}: two verified claims on ${r.subjectKey} in ${r.documentId}@${r.version}`);
    seen.add(r.subjectKey);
  }
  // Same order as CurrentBeliefs: catalogue order.
  return believed.sort((a, b) => catalogueRank(a.subjectKey) - catalogueRank(b.subjectKey)).map((record) => ({ record, validity }));
}

/** Transaction time: CurrentBeliefs over the log prefix up to and including `seq`. */
export const beliefsAtSeq = (events: readonly LogEvent[], seq: number): ReadonlyMap<BeliefKey, Belief> =>
  build(events.filter((e) => e.seq <= seq));
