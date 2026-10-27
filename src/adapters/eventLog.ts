// The event log adapter. `append` is the ONLY function that adds events.
// Enforced by test/append-only.test.ts: no other module may call a file-write API on events/.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { eventsDir, eventsFile } from './paths';
import { place } from '../events/build';
import { validateDraft } from '../events/schema';
import type { AnyDraft, AnyStoredEvent } from '../events/types';

export interface AppendResult { seq: number; deduplicated: boolean; event: AnyStoredEvent }

export function readAll(): AnyStoredEvent[] {
  const file = eventsFile();
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  return lines.map((l, i) => {
    const e = JSON.parse(l) as AnyStoredEvent;
    const bad = validateDraft(e);
    if (bad) throw new Error(`events.jsonl line ${i + 1}: ${bad}`);
    if (e.seq !== i + 1) throw new Error(`events.jsonl line ${i + 1}: seq ${e.seq} out of order`);
    return e;
  });
}

/** Append one event. Idempotent: a duplicate eventId returns the existing seq and writes nothing. */
export function append(draft: AnyDraft): AppendResult {
  const existing = readAll();
  const dup = existing.find((e) => e.eventId === draft.eventId);
  if (dup) return { seq: dup.seq, deduplicated: true, event: dup };
  const aggVersion = existing.filter((e) => e.aggregateId === draft.aggregateId).length + 1;
  const stored = place(draft, existing.length + 1, aggVersion) as AnyStoredEvent;
  mkdirSync(eventsDir(), { recursive: true });
  appendFileSync(eventsFile(), `${JSON.stringify(stored)}\n`, { flag: 'a' });
  return { seq: stored.seq, deduplicated: false, event: stored };
}

/** Demo reset: delete the log file. Not an event write; it removes the whole log. */
export function resetLog(): boolean {
  const had = existsSync(eventsFile());
  rmSync(eventsFile(), { force: true });
  return had;
}
