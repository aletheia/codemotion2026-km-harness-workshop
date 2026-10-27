// npm run layers-4-6 — the hand-authored Entities / Policies / Workflow excerpt (00-running-example.md §9)
// printed through the tail formatter with seq `—`. It is never appended to the log: the lines are drafts,
// validated against the event schemas with placeholder log fields. A cause in the log is shown as ev-NNNN,
// a cause inside the excerpt as (Type).
import { readFileSync } from 'node:fs';
import { config } from '../config';
import { readLog } from '../events/log';
import { eventSchema, type LogEvent } from '../events/schema';
import { run } from './cli';
import { formatTailLine } from './tail-format';

export const EXCERPT = 'fixtures/layers-4-6/excerpt.jsonl';

export function readExcerpt(path: string = EXCERPT): LogEvent[] {
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((line, i) => {
    // Placeholder log fields only to reuse the schemas; they are never shown (seq prints as —).
    const parsed = eventSchema.safeParse({ ...JSON.parse(line), seq: i + 1, aggregateVersion: 1, occurredAt: config.clock.base });
    if (!parsed.success) throw new Error(`${path} line ${i + 1}: ${parsed.error.issues[0]?.message}`);
    return parsed.data;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('layers-4-6', () => {
    const excerpt = readExcerpt();
    // ev-NNNN for causes in the live log (the first entity is caused by ev-0030), (Type) for causes in the excerpt.
    const inLog = new Map(readLog(config.paths.log).map((e) => [e.eventId, e.seq] as const));
    const inExcerpt = new Map(excerpt.map((e) => [e.eventId, e.type] as const));
    // TODO(luca): AGENTS.md §10 caps evidence at 60 characters; fallback/seg3/layers-4-6.txt prints the
    // policy and workflow evidence in full. The excerpt follows the fallback.
    const lines = excerpt.map((e) => formatTailLine(e, {
      seqLabel: '—'.padEnd(4),
      seqOf: (id) => inLog.get(id),
      causeOf: (id) => (inExcerpt.has(id) ? `(${inExcerpt.get(id)})` : undefined),
      evidenceMax: Infinity,
    }));
    process.stdout.write(lines.join('\n') + '\n');
  });
}
