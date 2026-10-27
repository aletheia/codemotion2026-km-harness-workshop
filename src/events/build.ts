// Pure event construction: ids are derived, never random.
import { hash16, asEventId, type EventId } from '../domain/ids';
import { config } from '../config';
import { LAYER_OF, type Actor, type Evidence, type EventDraft, type EventType, type PayloadMap, type StoredEvent } from './types';

export interface BuildInput<T extends EventType> {
  type: T;
  aggregateId: string;
  actor: Actor;
  /** Id of the artifact this event derives from (document, unit, previous event...). */
  inputArtifactId: string;
  causationId: EventId | null;
  correlationId: string;
  payload: PayloadMap[T];
  evidence?: Evidence;
}

/** producer = actor.id; extractorVersion = agent version, harness version, or "-". */
export function actorVersion(a: Actor): string {
  return a.kind === 'agent' ? a.extractorVersion : a.kind === 'harness' ? a.version : '-';
}

export function deriveEventId(producer: string, inputArtifactId: string, extractorVersion: string, type: string, aggregateId: string): EventId {
  return asEventId(hash16(producer, inputArtifactId, extractorVersion, type, aggregateId));
}

export function buildEvent<T extends EventType>(i: BuildInput<T>): EventDraft<T> {
  const draft: EventDraft<T> = {
    eventId: deriveEventId(i.actor.id, i.inputArtifactId, actorVersion(i.actor), i.type, i.aggregateId),
    type: i.type,
    layer: LAYER_OF[i.type],
    aggregateId: i.aggregateId,
    actor: i.actor,
    causationId: i.causationId,
    correlationId: i.correlationId,
    payload: i.payload,
  };
  if (i.evidence) draft.evidence = i.evidence;
  return draft;
}

/** Logical clock: deterministic, so two runs produce byte-identical logs. */
export function logicalTime(seq: number): string {
  return new Date(Date.parse(config.clockBase) + seq * 1000).toISOString().replace('.000Z', 'Z');
}

export function place<T extends EventType>(d: EventDraft<T>, seq: number, aggregateVersion: number): StoredEvent<T> {
  return { ...d, seq, aggregateVersion, occurredAt: logicalTime(seq) };
}
