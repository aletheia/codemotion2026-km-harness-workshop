import { hashTuple } from '../domain/hash';
import type { EventId } from '../domain/ids';
import type { Actor } from './actor';

export interface EventIdInput {
  readonly producer: string;                 // `${actor.kind}:${actor.id}`, e.g. 'agent:claims-extractor'
  readonly inputArtifactId: string;          // what the producer consumed: an event id, a document version, 'log'
  readonly extractorVersion: string | null;  // 'claims@v1' for agents; null for every other producer
  readonly eventType: string;
  readonly aggregateId: string;
}

/**
 * eventId = first 16 hex chars of SHA-256 over the JSON array
 *   [producer, inputArtifactId, extractorVersion, eventType, aggregateId].
 * Same producer + same input + same extractor version + same type on the same aggregate = same id,
 * so re-running a step appends nothing: the eventId is the idempotency key of append().
 */
export function deriveEventId(input: EventIdInput): EventId {
  return hashTuple([input.producer, input.inputArtifactId, input.extractorVersion, input.eventType, input.aggregateId]) as EventId;
}

export const producerOf = (actor: Actor): string => `${actor.kind}:${actor.id}`;
