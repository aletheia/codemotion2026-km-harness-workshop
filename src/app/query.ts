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

const aggShort = (a: string): string => a.replace(/^(\w+):([0-9a-f]{16})$/, (_m, k: string, id: string) => `${k}:${id.slice(0, 8)}`);

export interface CatRow { seq: number; type: string; actor: string; aggregate: string; causedBy: number | null; causedByType: string | null }

export function catRows(events: readonly AnyStoredEvent[]): CatRow[] {
  const bySeq = new Map(events.map((e) => [e.eventId, e]));
  return events.map((e) => {
    const c = e.causationId ? bySeq.get(e.causationId) : undefined;
    return { seq: e.seq, type: e.type, actor: `${e.actor.kind}:${e.actor.id}`, aggregate: aggShort(e.aggregateId), causedBy: c?.seq ?? null, causedByType: c?.type ?? null };
  });
}

export function renderCat(rows: readonly CatRow[]): string {
  const head = `${'seq'.padStart(3)} · ${'type'.padEnd(24)} · ${'actor'.padEnd(26)} · ${'aggregate'.padEnd(23)} · caused by`;
  const lines = rows.map((r) => `${String(r.seq).padStart(3)} · ${r.type.padEnd(24)} · ${r.actor.padEnd(26)} · ${r.aggregate.padEnd(23)} · ${r.causedBy === null ? '-' : `${r.causedBy} ${r.causedByType}`}`);
  return [head, ...lines].join('\n');
}

/** The causation chain that ends at `ref`, root first. */
export function causationChain(ref: string): CatRow[] {
  const events = readAll();
  const end = showEvent(ref);
  const byId = new Map(events.map((e) => [e.eventId, e]));
  const chain: AnyStoredEvent[] = [];
  const seen = new Set<string>();
  for (let cur: AnyStoredEvent | undefined = end; cur && !seen.has(cur.eventId); cur = cur.causationId ? byId.get(cur.causationId) : undefined) {
    seen.add(cur.eventId);
    chain.unshift(cur);
  }
  return catRows(events).filter((r) => chain.some((c) => c.seq === r.seq));
}

export function firstSeqOfType(type: string): number {
  const e = readAll().find((x) => x.type === type);
  if (!e) throw new UsageError(`no ${type} event in the log`);
  return e.seq;
}
