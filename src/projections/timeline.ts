// Timeline (04 §6): per claim, the state after each of its events, with transaction time (seq, occurredAt)
// and the valid-time period of its document version. Each claim also carries what a consumer needs to cite it
// without going back to the log or to the document: subject, value, evidence span and its quoted text, and on
// each decision the claim it links to (successor, conflicting claim, reconfirmed belief).
//
// The quote is resolved when the projection is built, from the source text whose content hash the
// DocumentVersionIngested event recorded; a text that no longer matches its hash is an error, not a quote.
import { contentHashOf, readDocument } from '../acl/sourceToStructure';
import type { NormalizedValue } from '../domain/claim';
import type { Span } from '../domain/span';
import { claimStates, isClaimEvent } from '../events/fold';
import { ofType } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { claimRecords, versionValidity } from './claims';

export interface TimelineEntry {
  readonly seq: number;
  readonly occurredAt: string;
  readonly type: string;
  readonly actor: string;
  readonly state: string;
  readonly successor?: string;               // ClaimSuperseded: the claim that replaced this one
  readonly conflictingClaimId?: string;      // ClaimContested: the belief it conflicts with
  readonly reconfirmed?: string;             // class-A ClaimVerified: the belief it reconfirms
}

export interface ClaimTimeline {
  readonly label: string;
  readonly lineageId: string;
  readonly documentId: string;
  readonly version: string;
  readonly subjectKey: string;
  readonly value: NormalizedValue;
  readonly span: Span;
  readonly quote: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly entries: readonly TimelineEntry[];
}

/** The text under a span; (documentId, version) → full text of that version. */
export type SourceText = (documentId: string, version: string) => string;

/** Reads the ingested text and checks it against the content hash the log recorded for it. */
export function verifiedSource(events: readonly LogEvent[], read: SourceText = readDocument): SourceText {
  const cache = new Map<string, string>();
  return (documentId, version) => {
    const key = `${documentId}@${version}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const ingested = ofType(events, 'DocumentVersionIngested').find((e) => e.payload.documentId === documentId && e.payload.version === version);
    if (!ingested) throw new Error(`Timeline: ${key} was never ingested`);
    const text = read(documentId, version);
    if (contentHashOf(text) !== ingested.payload.contentHash) {
      throw new Error(`Timeline: ${key} does not match the content hash ingested at seq ${ingested.seq}`);
    }
    cache.set(key, text);
    return text;
  };
}

function links(e: LogEvent): Pick<TimelineEntry, 'successor' | 'conflictingClaimId' | 'reconfirmed'> {
  switch (e.type) {
    case 'ClaimSuperseded': return { successor: e.payload.successor };
    case 'ClaimContested': return { conflictingClaimId: e.payload.conflictingClaimId };
    case 'ClaimVerified': return e.evidence.kind === 'class-A' ? { reconfirmed: e.evidence.reconfirmedBeliefId } : {};
    default: return {};
  }
}

export function timeline(events: readonly LogEvent[], source: SourceText = verifiedSource(events)): Record<string, ClaimTimeline> {
  const out: Record<string, ClaimTimeline> = {};
  for (const r of claimRecords(events)) {
    const v = versionValidity(events, r.lineageId).find((x) => x.documentId === r.documentId && x.version === r.version);
    const span = r.spans[0]!;
    out[r.claimId] = {
      label: r.label, lineageId: r.lineageId, documentId: r.documentId, version: r.version,
      subjectKey: r.subjectKey, value: r.value, span, quote: source(span.documentId, span.version).slice(span.start, span.end),
      ...(v ? { validFrom: v.from } : {}), ...(v?.to ? { validTo: v.to } : {}), entries: [],
    };
  }
  // The state after each event = claimStates folded up to that event (prefix fold, small log).
  events.forEach((e, i) => {
    if (!isClaimEvent(e)) return;
    const id = (e.payload as { claimId: string }).claimId;
    const state = claimStates(events.slice(0, i + 1)).get(id as never)!;
    (out[id]!.entries as TimelineEntry[]).push({ seq: e.seq, occurredAt: e.occurredAt, type: e.type, actor: `${e.actor.kind}(${e.actor.id})`, state, ...links(e) });
  });
  return out;
}
