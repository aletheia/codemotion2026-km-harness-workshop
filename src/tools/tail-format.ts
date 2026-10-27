// The tail line (AGENTS.md §10):
//   NNNN · Type · actor.kind(actor.id) · layer · label · ← ev-NNNN  evidence: …
// `★` replaces `·` after the seq on decision events; evidence is summarised in ≤ 60 characters.
// Display ids (§13): events are ev-<seq, 4 digits>; the causation column shows the ev- of the cause.
import type { NormalizedValue } from '../domain/claim';
import { shortValue } from '../catalog/normalizer';
import type { Actor } from '../events/actor';
import { isDecision, type LogEvent } from '../events/schema';

const WIDTH = { type: 25, actor: 19, layer: 9, label: 13 } as const;
const CAUSE_WIDTH = ' ← ev-0000'.length;
export const EVIDENCE_MAX = 60;

export const displaySeq = (seq: number): string => String(seq).padStart(4, '0');
export const displayEventId = (seq: number): string => `ev-${displaySeq(seq)}`;

export function displayActor(actor: Actor): string {
  return actor.kind === 'agent' ? `agent(${actor.extractorVersion})` : `${actor.kind}(${actor.id})`;
}

/** Claim proposals carry a label in the payload; later events on the claim reuse it via labelOf; any other event is shown by its aggregate id. */
export function displayLabel(e: LogEvent, labelOf?: (aggregateId: string) => string | undefined): string {
  const payload = e.payload as { label?: unknown };
  return typeof payload.label === 'string' ? payload.label : labelOf?.(e.aggregateId) ?? e.aggregateId;
}

/** Records the label a ClaimProposed carries, keyed by its claim id (= aggregate id). */
export function rememberLabel(labels: Map<string, string>, e: LogEvent): void {
  if (e.type === 'ClaimProposed' && e.payload.label) labels.set(e.aggregateId, e.payload.label);
}

export function truncate(text: string, max = EVIDENCE_MAX): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** Evidence in ≤ 60 characters; ids inside it are shown as labels and ev-NNNN when opts can resolve them. */
export function evidenceSummary(e: LogEvent, opts: FormatOptions = {}): string | undefined {
  if (!('evidence' in e) || e.evidence === undefined) return undefined;
  const max = opts.evidenceMax ?? EVIDENCE_MAX;
  // Ids inside evidence are hashes; on screen they become display ids (§13), or 8 hex when unresolvable.
  const label = (claimId: string) => opts.labelOf?.(claimId) ?? claimId.slice(0, 8);
  const ev = (eventId: string) => {
    const seq = opts.seqOf?.(eventId);
    return seq === undefined ? eventId.slice(0, 8) : displayEventId(seq);
  };

  // Decisions whose evidence needs the payload or a lookup are summarised per event type; the rest fall
  // through to the summary by evidence kind below.
  switch (e.type) {
    case 'StructureVerified':
      if (e.evidence.kind === 'class-A') return truncate(`class A, same paths/types as ${e.evidence.reconfirmedTreeId} (${ev(e.evidence.reconfirmedEventId)})`, max);
      break;
    case 'ClaimVerified':
      if (e.evidence.kind === 'class-A') return truncate(`A: belief ${label(e.evidence.reconfirmedBeliefId)} (${ev(e.evidence.beliefEventId)}) · ${e.evidence.batchId}`, max);
      break;
    case 'ClaimContested': {
      // values = [belief, proposal], so the old value reads first.
      const [was, now] = e.evidence.values as [NormalizedValue, NormalizedValue];
      return truncate(`C: conflicts ${label(e.payload.conflictingClaimId)} (${shortValue(was)} ≠ ${shortValue(now)})`, max);
    }
    case 'ClaimSuperseded':
      if (e.evidence.reason === 'reconfirmation-chain') return truncate(`reconfirmation-chain → ${label(e.payload.successor)}`, max);
      return truncate(`successor ${label(e.payload.successor)}` + (e.evidence.validUntil ? `; valid until ${e.evidence.validUntil}` : ''), max);
    case 'EntityResolved':
      if (e.evidence.kind === 'catalogue-lookup') return truncate(`catalogue "${e.evidence.mention}" → ${e.evidence.catalogueEntry}`, max);
      break;
    case 'PolicyVerified':
      if (e.evidence.kind === 'policy-review') {
        const { condition, effect, exception } = e.evidence;
        return truncate(`cond = ${condition}; effect = ${effect}` + (exception ? `; exc = ${exception}` : ''), max);
      }
      break;
    case 'WorkflowStepVerified':
      return truncate(`test input ${e.evidence.input} → ${typeof e.evidence.output === 'string' ? e.evidence.output : JSON.stringify(e.evidence.output)}`, max);
  }

  const evidence = e.evidence as Record<string, unknown>;
  switch (evidence.kind) {
    case 'bootstrap': return truncate(String(evidence.note), max);
    case 'human': {
      // A tree check shows what was checked; a claim check shows the note and the span read.
      if (Array.isArray(evidence.covers)) return truncate(`${String(evidence.nodesChecked)}/${String(evidence.nodesTotal)} nodes, intervals cover ${evidence.covers[0]}..${evidence.covers[1]}`, max);
      const span = evidence.checkedSpan as { start: number; end: number } | undefined;
      return truncate(`note "${String(evidence.note)}"` + (span ? `; span [${span.start},${span.end})` : ''), max);
    }
    case 'import': return truncate(`import: ${String(evidence.sourceRecord)}`, max);
    default: {
      const { kind, ...rest } = evidence;
      const body = Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ');
      return truncate(kind === undefined ? body : `${String(kind)}: ${body}`, max);
    }
  }
}

export interface FormatOptions {
  /** Resolves a causation eventId to its seq; unknown causes are shown by their first 8 hex chars. */
  readonly seqOf?: (eventId: string) => number | undefined;
  /** Resolves a claim id to the label of its proposal. */
  readonly labelOf?: (aggregateId: string) => string | undefined;
  /** Replaces the seq column (layers-4-6 prints `—` for events that are not in the log). */
  readonly seqLabel?: string;
  /** Shows a causation the log cannot resolve (layers-4-6: a cause inside the excerpt is shown as `(Type)`). */
  readonly causeOf?: (eventId: string) => string | undefined;
  /** Overrides the 60-character evidence limit (layers-4-6 prints the excerpt's evidence in full). */
  readonly evidenceMax?: number;
}

export function formatTailLine(e: LogEvent, opts: FormatOptions = {}): string {
  const seq = opts.seqLabel ?? displaySeq(e.seq);
  const marker = isDecision(e) ? '★' : '·';
  let line = [
    `${seq} ${marker} ${e.type.padEnd(WIDTH.type)}`,
    displayActor(e.actor).padEnd(WIDTH.actor),
    e.layer.padEnd(WIDTH.layer),
    displayLabel(e, opts.labelOf).padEnd(WIDTH.label),
  ].join(' · ') + ' ·';

  let cause = '';
  if (e.causationId) {
    const causeSeq = opts.seqOf?.(e.causationId);
    cause = ` ← ${causeSeq === undefined ? opts.causeOf?.(e.causationId) ?? e.causationId.slice(0, 8) : displayEventId(causeSeq)}`;
  }
  line += cause;

  const evidence = evidenceSummary(e, opts);
  if (evidence !== undefined) line += ' '.repeat(Math.max(0, CAUSE_WIDTH - cause.length)) + `  evidence: ${evidence}`;
  return line;
}

/** Formats a whole log; causation ids and claim labels resolve against the events given. */
export function formatLog(events: readonly LogEvent[]): string[] {
  const seqById = new Map(events.map((e) => [e.eventId, e.seq] as const));
  const labels = new Map<string, string>();
  for (const e of events) rememberLabel(labels, e);
  return events.map((e) => formatTailLine(e, { seqOf: (id) => seqById.get(id), labelOf: (id) => labels.get(id) }));
}
