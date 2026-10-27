import type { EventId } from '../domain/ids';
import type { Actor } from './actor';

// Fact events carry no evidence; decision events must.
export type Layer = 'source' | 'structure' | 'claims' | 'entities' | 'policies' | 'workflow' | 'harness';

export interface Envelope<TType extends string, TPayload> {
  readonly eventId: EventId;                 // deterministic: the idempotency key (eventId.ts)
  readonly seq: number;                      // global, assigned by append
  readonly aggregateVersion: number;         // per aggregateId, assigned by append
  readonly type: TType;
  readonly layer: Layer;
  readonly aggregateId: string;
  readonly actor: Actor;
  readonly causationId?: EventId;            // the event consumed
  readonly correlationId: string;            // the extraction run
  readonly occurredAt: string;               // transaction time (config.occurredAt)
  readonly payload: TPayload;
}

export type FactEvent<T extends string, P> = Envelope<T, P> & { readonly evidence?: never };
export type DecisionEvent<T extends string, P, E> = Envelope<T, P> & { readonly evidence: E };
