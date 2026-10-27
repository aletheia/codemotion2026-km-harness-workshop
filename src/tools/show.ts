// npm run show -- --event <ref>  (show:ricavi-v8 = --event clm-ricavi2m) — one event as JSON, top to bottom.
// <ref>: a seq (7), a display id (ev-0007), 'last', an eventId hash, or a claim label (its ClaimProposed).
// The eventId is the one hash on screen (the idempotency key); the causation and the aggregate are shown by
// display id and label, and the claim id is not repeated inside the payload.
import { config } from '../config';
import { readLog } from '../events/log';
import { claimLabels } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { argValue, run } from './cli';
import { displayEventId } from './tail-format';

export function resolveRef(events: readonly LogEvent[], ref: string): LogEvent | undefined {
  if (ref === 'last') return events.at(-1);
  const seq = /^(?:ev-)?(\d+)$/u.exec(ref)?.[1];
  if (seq !== undefined && !/^[0-9a-f]{16}$/u.test(ref)) return events.find((e) => e.seq === Number(seq));
  return events.find((e) => e.eventId === ref)
    ?? events.find((e) => e.type === 'ClaimProposed' && e.payload.label === ref)
    ?? events.find((e) => e.aggregateId === ref);
}

const inline = (v: unknown): string => {
  if (Array.isArray(v)) return v.length === 0 ? '[]' : `[ ${v.map(inline).join(', ')} ]`;
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v);
    return entries.length === 0 ? '{}' : `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`;
  }
  return JSON.stringify(v);
};

const block = (obj: Record<string, unknown>): string => {
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  return `{\n${entries.map(([k, v]) => `    ${JSON.stringify(k)}: ${inline(v)}`).join(',\n')}\n  }`;
};

const ACTOR_INDENT = ' '.repeat('  "actor": { '.length);

/** Agent actors wrap after the id; the model id is a placeholder because fixtures are authored, not recorded. */
function actorField(actor: LogEvent['actor']): string {
  if (actor.kind !== 'agent') return inline(actor);
  const { kind, id, modelId, ...rest } = actor;
  const tail = inline({ modelId: `${modelId} (illustrative; the fixture records the real id)`, ...rest }).slice(2);
  return `{ ${inline({ kind, id }).slice(2, -2)},\n${ACTOR_INDENT}${tail}`;
}

export function formatShow(e: LogEvent, events: readonly LogEvent[]): string {
  const seqById = new Map(events.map((x) => [x.eventId, x.seq] as const));
  const labels = claimLabels(events);
  const { label: _label, ...payload } = e.payload as Record<string, unknown>;
  if (payload.claimId === e.aggregateId) delete payload.claimId;

  const fields: [string, string][] = [
    ['eventId', JSON.stringify(e.eventId)],
    ['seq', String(e.seq)],
    ['aggregateVersion', String(e.aggregateVersion)],
    ['type', JSON.stringify(e.type)],
    ['layer', JSON.stringify(e.layer)],
    ['aggregateId', JSON.stringify(labels.get(e.aggregateId) ?? e.aggregateId)],
    ['actor', actorField(e.actor)],
  ];
  if (e.causationId) {
    const cause = seqById.get(e.causationId);
    fields.push(['causationId', JSON.stringify(cause === undefined ? e.causationId : displayEventId(cause))]);
  }
  fields.push(['correlationId', JSON.stringify(e.correlationId)], ['occurredAt', JSON.stringify(e.occurredAt)], ['payload', block(payload)]);
  if ('evidence' in e && e.evidence !== undefined) fields.push(['evidence', block(e.evidence as Record<string, unknown>)]);

  return `{\n${fields.map(([k, v]) => `  ${JSON.stringify(k)}: ${v}`).join(',\n')}\n}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('show', () => {
    const ref = argValue(process.argv.slice(2), 'event') ?? 'last';
    const events = readLog(config.paths.log);
    const e = resolveRef(events, ref);
    if (!e) throw new Error(`no event ${ref}`);
    process.stdout.write(formatShow(e, events) + '\n');
  });
}
