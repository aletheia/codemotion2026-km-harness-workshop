// Read-side helpers: tail, show.
import { readAll } from '../adapters/eventLog';
import { short } from '../domain/ids';
import type { AnyStoredEvent } from '../events/types';
import { Rejection, UsageError } from './errors';

export function summarize(e: AnyStoredEvent): string {
  const actor = `${e.actor.kind}:${e.actor.id}`;
  let what = '';
  switch (e.type) {
    case 'ClaimProposed': what = `${e.payload.subjectKey} = ${e.payload.valueText} [${e.payload.spans[0]!.start},${e.payload.spans[0]!.end})`; break;
    case 'ClaimVerified': case 'ClaimContested': what = `claim ${short(e.payload.claimId)}`; break;
    case 'ClaimSuperseded': what = `claim ${short(e.payload.claimId)} -> ${short(e.payload.successor)}`; break;
    case 'DocumentVersionIngested': what = `${e.payload.documentId} (${e.payload.version}, from ${e.payload.effectiveFrom})`; break;
    case 'StructureProposed': what = `${e.payload.treeId}: ${e.payload.nodes.length} nodes`; break;
    case 'StructureVerified': what = e.payload.treeId; break;
    case 'ExtractorVersionPromoted': what = `${e.payload.extractor}: ${e.payload.previous ?? '-'} -> ${e.payload.version}`; break;
    case 'ACLRejected': what = `${e.payload.unitRef}: ${e.payload.reason}`; break;
    default: what = '';
  }
  return `${String(e.seq).padStart(3)}  ${e.type.padEnd(24)} ${actor.padEnd(26)} ${what}`.trimEnd();
}

export function tail(n: number | 'all') {
  const events = readAll();
  const slice = n === 'all' ? events : events.slice(-n);
  return { total: events.length, events: slice };
}

export function showEvent(ref: string): AnyStoredEvent {
  const events = readAll();
  if (events.length === 0) throw new Rejection('the log is empty');
  if (ref === 'last') return events[events.length - 1]!;
  if (/^\d+$/.test(ref)) {
    const e = events.find((x) => x.seq === Number(ref));
    if (!e) throw new UsageError(`no event with seq ${ref}`);
    return e;
  }
  const hits = events.filter((x) => x.eventId.startsWith(ref));
  if (hits.length !== 1) throw new UsageError(hits.length === 0 ? `no event ${ref}` : `event prefix ${ref} is ambiguous`);
  return hits[0]!;
}
