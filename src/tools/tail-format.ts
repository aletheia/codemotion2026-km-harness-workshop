// The tail line (AGENTS.md §10):
//   NNNN · Type · actor.kind(actor.id) · layer · label · ← ev-NNNN  evidence: …
// `★` replaces `·` after the seq on decision events; evidence is summarised in ≤ 60 characters.
// Display ids (§13): events are ev-<seq, 4 digits>; the causation column shows the ev- of the cause.
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

/** Claim proposals carry a label in the payload; every other event is shown by its aggregate id. */
export function displayLabel(e: LogEvent): string {
  const payload = e.payload as { label?: unknown };
  return typeof payload.label === 'string' ? payload.label : e.aggregateId;
}

export function truncate(text: string, max = EVIDENCE_MAX): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

export function evidenceSummary(e: LogEvent): string | undefined {
  if (!('evidence' in e) || e.evidence === undefined) return undefined;
  const ev = e.evidence as Record<string, unknown>;
  switch (ev.kind) {
    case 'bootstrap': return truncate(String(ev.note));
    case 'human': return truncate(`note "${String(ev.note)}"`);
    case 'import': return truncate(`import: ${String(ev.sourceRecord)}`);
    default: {
      const { kind, ...rest } = ev;
      const body = Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ');
      return truncate(kind === undefined ? body : `${String(kind)}: ${body}`);
    }
  }
}

export interface FormatOptions {
  /** Resolves a causation eventId to its seq; unknown causes are shown by their first 8 hex chars. */
  readonly seqOf?: (eventId: string) => number | undefined;
  /** Replaces the seq column (layers-4-6 prints `—` for events that are not in the log). */
  readonly seqLabel?: string;
}

export function formatTailLine(e: LogEvent, opts: FormatOptions = {}): string {
  const seq = opts.seqLabel ?? displaySeq(e.seq);
  const marker = isDecision(e) ? '★' : '·';
  let line = [
    `${seq} ${marker} ${e.type.padEnd(WIDTH.type)}`,
    displayActor(e.actor).padEnd(WIDTH.actor),
    e.layer.padEnd(WIDTH.layer),
    displayLabel(e).padEnd(WIDTH.label),
  ].join(' · ') + ' ·';

  let cause = '';
  if (e.causationId) {
    const causeSeq = opts.seqOf?.(e.causationId);
    cause = ` ← ${causeSeq === undefined ? e.causationId.slice(0, 8) : displayEventId(causeSeq)}`;
  }
  line += cause;

  const evidence = evidenceSummary(e);
  if (evidence !== undefined) line += ' '.repeat(Math.max(0, CAUSE_WIDTH - cause.length)) + `  evidence: ${evidence}`;
  return line;
}

/** Formats a whole log; causation ids resolve against the events given. */
export function formatLog(events: readonly LogEvent[]): string[] {
  const seqById = new Map(events.map((e) => [e.eventId, e.seq] as const));
  return events.map((e) => formatTailLine(e, { seqOf: (id) => seqById.get(id) }));
}
