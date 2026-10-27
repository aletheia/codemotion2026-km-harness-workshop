// Timeline (04 §6): per claim, the state after each of its events, with transaction time (seq, occurredAt)
// and the valid-time period of its document version.
import { claimStates, isClaimEvent } from '../events/fold';
import type { LogEvent } from '../events/schema';
import { claimRecords, versionValidity } from './claims';

export interface TimelineEntry {
  readonly seq: number;
  readonly occurredAt: string;
  readonly type: string;
  readonly actor: string;
  readonly state: string;
}

export interface ClaimTimeline {
  readonly label: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly entries: readonly TimelineEntry[];
}

export function timeline(events: readonly LogEvent[]): Record<string, ClaimTimeline> {
  const out: Record<string, ClaimTimeline> = {};
  for (const r of claimRecords(events)) {
    const v = versionValidity(events, r.lineageId).find((x) => x.documentId === r.documentId && x.version === r.version);
    out[r.claimId] = { label: r.label, ...(v ? { validFrom: v.from } : {}), ...(v?.to ? { validTo: v.to } : {}), entries: [] };
  }
  // The state after each event = claimStates folded up to that event (prefix fold, small log).
  events.forEach((e, i) => {
    if (!isClaimEvent(e)) return;
    const id = (e.payload as { claimId: string }).claimId;
    const state = claimStates(events.slice(0, i + 1)).get(id as never)!;
    (out[id]!.entries as TimelineEntry[]).push({ seq: e.seq, occurredAt: e.occurredAt, type: e.type, actor: `${e.actor.kind}(${e.actor.id})`, state });
  });
  return out;
}
