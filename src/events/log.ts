// The log: one append-only JSONL file. append() is the only function that writes to it.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { occurredAt } from '../config';
import { eventSchema, type LogEvent } from './schema';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a producer hands to append(): everything except what the log assigns. */
export type EventDraft = DistributiveOmit<LogEvent, 'seq' | 'aggregateVersion' | 'occurredAt'>;

export class LogInvalid extends Error {
  constructor(readonly line: number, detail: string) {
    super(`log invalid at line ${line}: ${detail}`);
    this.name = 'LogInvalid';
  }
}

export class EventRejected extends Error {
  constructor(readonly eventType: string, detail: string) {
    super(`${eventType} rejected: ${detail}`);
    this.name = 'EventRejected';
  }
}

/** Reads and validates every line; a missing file is an empty log. */
export function readLog(path: string): LogEvent[] {
  if (!existsSync(path)) return [];
  return parseLog(readFileSync(path, 'utf8'));
}

export function parseLog(text: string): LogEvent[] {
  const events: LogEvent[] = [];
  text.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new LogInvalid(i + 1, 'not JSON');
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) throw new LogInvalid(i + 1, summarize(parsed.error));
    const expected = events.length + 1;
    if (parsed.data.seq !== expected) throw new LogInvalid(i + 1, `seq ${parsed.data.seq}, expected ${expected}`);
    events.push(parsed.data);
  });
  return events;
}

export interface AppendResult {
  readonly seq: number;
  readonly duplicate: boolean;
}

/**
 * Idempotent append: a draft whose eventId is already in the log returns the existing seq with
 * duplicate = true and writes nothing; it never throws on a duplicate. A draft that fails its schema
 * throws EventRejected and writes nothing.
 */
export function append(path: string, draft: EventDraft): AppendResult {
  const events = readLog(path);
  const existing = events.find((e) => e.eventId === draft.eventId);
  if (existing) return { seq: existing.seq, duplicate: true };

  const seq = events.length + 1;
  const aggregateVersion = events.filter((e) => e.aggregateId === draft.aggregateId).length + 1;
  const candidate = { ...draft, seq, aggregateVersion, occurredAt: occurredAt(seq) };
  const parsed = eventSchema.safeParse(candidate);
  if (!parsed.success) throw new EventRejected(draft.type, summarize(parsed.error));

  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, serialize(parsed.data) + '\n', 'utf8');
  return { seq, duplicate: false };
}

/** Fixed field order on disk, so two runs write byte-identical lines. */
export function serialize(e: LogEvent): string {
  const { eventId, seq, aggregateVersion, type, layer, aggregateId, actor, causationId, correlationId, occurredAt: at, payload } = e;
  const ordered: Record<string, unknown> = { eventId, seq, aggregateVersion, type, layer, aggregateId, actor };
  if (causationId !== undefined) ordered.causationId = causationId;
  Object.assign(ordered, { correlationId, occurredAt: at, payload });
  if ('evidence' in e && e.evidence !== undefined) ordered.evidence = e.evidence;
  return JSON.stringify(ordered);
}

function summarize(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): string {
  const first = error.issues[0];
  if (!first) return 'invalid';
  const where = first.path.length ? first.path.map(String).join('.') : '(root)';
  return `${where}: ${first.message}`;
}
