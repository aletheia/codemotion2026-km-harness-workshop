// The single choke point for writing events. Every command that changes the log goes through
// `commit`, which checks (in order): schema, who-may-emit, layer contract, provenance, id derivation,
// state machine (by folding), and the CurrentBeliefs invariant; and only then calls `append`.
// Rejections are thrown BEFORE anything is written, so a batch is all-or-nothing.
import { append, readAll } from '../adapters/eventLog';
import { documentText } from '../adapters/documents';
import { checkMayEmit } from '../domain/policy';
import { checkProvenance } from '../domain/provenance';
import { checkStructure } from '../domain/structure';
import { makeClaimId, type SubjectKey } from '../domain/claim';
import { normalize, NormalizationError, valueEquals } from '../domain/value';
import { validateDraft } from '../events/schema';
import { place } from '../events/build';
import { REQUIRED_CAUSATION, type AnyDraft, type AnyStoredEvent } from '../events/types';
import { applyEvent, emptyFold, FoldError, type Fold } from '../projections/fold';
import { currentBeliefs, BeliefInvariantError } from '../projections/views';
import { Rejection } from './errors';
import type { ClaimId, DocumentId } from '../domain/ids';

const NEEDS_CAUSATION = new Set(['StructureVerified', 'ClaimVerified', 'ClaimContested', 'ClaimSuperseded']);

export interface CommitOutcome { seq: number; eventId: string; type: string; deduplicated: boolean }

export function commit(drafts: readonly AnyDraft[]): CommitOutcome[] {
  const existing = readAll();
  const work: Fold = emptyFold();
  for (const e of existing) applyEvent(work, e);
  const byId = new Map<string, AnyStoredEvent>(existing.map((e) => [e.eventId, e]));
  const toWrite: AnyDraft[] = [];

  for (const d of drafts) {
    if (byId.has(d.eventId)) continue; // idempotent replay of an identical event: nothing to check or write
    reject(validateDraft(d));
    reject(checkMayEmit(d.type, d.actor.kind, d.evidence?.kind));
    checkContract(d, byId);
    checkContent(d);
    const stored = place(d, work.lastSeq + 1, work.events.filter((e) => e.aggregateId === d.aggregateId).length + 1) as AnyStoredEvent;
    try {
      applyEvent(work, stored);
    } catch (e) {
      if (e instanceof FoldError) throw new Rejection(e.message);
      throw e;
    }
    byId.set(stored.eventId, stored);
    toWrite.push(d);
  }

  try {
    currentBeliefs(work);
  } catch (e) {
    if (e instanceof BeliefInvariantError) throw new Rejection(e.message);
    throw e;
  }

  const results: CommitOutcome[] = [];
  const written = new Set(toWrite.map((d) => d.eventId));
  for (const d of drafts) {
    if (written.has(d.eventId)) {
      const r = append(d);
      results.push({ seq: r.seq, eventId: d.eventId, type: d.type, deduplicated: r.deduplicated });
    } else {
      const prior = byId.get(d.eventId)!;
      results.push({ seq: prior.seq, eventId: d.eventId, type: d.type, deduplicated: true });
    }
  }
  return results;
}

function reject(reason: string | null): void {
  if (reason) throw new Rejection(reason);
}

function checkContract(d: AnyDraft, byId: Map<string, AnyStoredEvent>): void {
  const need = REQUIRED_CAUSATION[d.type];
  if (NEEDS_CAUSATION.has(d.type) && !d.causationId) throw new Rejection(`${d.type} needs a causationId`);
  if (d.causationId) {
    const c = byId.get(d.causationId);
    if (!c) throw new Rejection(`${d.type}: causation ${d.causationId} is not in the log`);
    if (need && c.type !== need) throw new Rejection(`${d.type}: causation must be a ${need} event, got ${c.type} (layer contract)`);
    if (d.type === 'ClaimProposed' && c.type === 'StructureVerified') {
      const doc = `${(c.payload as { documentId: string }).documentId}@${(c.payload as { version: string }).version}`;
      const mine = `${d.payload.documentId}@${d.payload.version}`;
      if (doc !== mine) throw new Rejection(`ClaimProposed for ${mine} caused by StructureVerified of ${doc}`);
    }
  } else if (need) {
    throw new Rejection(`${d.type} needs a ${need} as causation (layer contract)`);
  }
}

/** Content checks that need the source text. Provenance lives here, so no path can skip it. */
function checkContent(d: AnyDraft): void {
  if (d.type === 'StructureProposed') {
    const text = documentText(d.payload.documentId);
    reject(checkStructure(d.payload.nodes, text.length));
  }
  if (d.type !== 'ClaimProposed') return;
  const p = d.payload;
  const text = documentText(p.documentId);
  let value;
  try {
    value = normalize(p.valueText);
  } catch (e) {
    if (e instanceof NormalizationError) throw new Rejection(e.message);
    throw e;
  }
  if (!valueEquals(value, p.value)) throw new Rejection(`payload value does not match valueText "${p.valueText}"`);
  const expected: ClaimId = makeClaimId(p.documentId as DocumentId, p.version, p.subjectKey as SubjectKey, value);
  if (expected !== p.claimId) throw new Rejection(`claimId ${p.claimId} is not the derived id ${expected}`);
  for (const span of p.spans) {
    if (span.documentId !== p.documentId || span.version !== p.version) throw new Rejection('span belongs to a different document version');
    const r = checkProvenance(text, span, p.quote);
    if (!r.ok) throw new Rejection(`provenance: ${r.reason}`);
  }
}
