import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveClaimId } from '../src/domain/claim';
import { documentId, lineageId, type ClaimId } from '../src/domain/ids';
import type { Span } from '../src/domain/span';
import type { Actor } from '../src/events/actor';
import type { ClaimContested, ClaimEvent, ClaimProposed, ClaimSuperseded, ClaimVerified } from '../src/events/catalogue';
import { deriveEventId, producerOf } from '../src/events/eventId';

export const tmpLog = (): string => join(mkdtempSync(join(tmpdir(), 'dnk-')), 'out', 'events.jsonl');

export const actors = {
  agent: { kind: 'agent', id: 'claims-extractor', modelId: 'claude-test', promptVersion: 'p3', extractorVersion: 'claims@v1' },
  human: { kind: 'human', id: 'luca' },
  harness: { kind: 'harness', id: 'compare', rule: 'class-A' },
  import: { kind: 'import', id: 'register', source: 'compliance-register.csv' },
  process: { kind: 'process', id: 'acl' },
} as const satisfies Record<Actor['kind'], Actor>;

export const span: Span = { documentId: documentId('cc-art2477'), version: 'v8', start: 1067, end: 1126 };
export const CLAIM = deriveClaimId(documentId('cc-art2477'), 'v8', 'ricavi.limite', { type: 'money', amount: 2_000_000, currency: 'EUR' });
export const OTHER = deriveClaimId(documentId('cc-art2477'), 'v9', 'ricavi.limite', { type: 'money', amount: 4_000_000, currency: 'EUR' });

function envelope<T extends string>(type: T, actor: Actor, aggregateId: string) {
  return {
    eventId: deriveEventId({ producer: producerOf(actor), inputArtifactId: 'test', extractorVersion: null, eventType: type, aggregateId }),
    seq: 1,
    aggregateVersion: 1,
    type,
    layer: 'claims' as const,
    aggregateId,
    actor,
    correlationId: 'test',
    occurredAt: '2026-10-28T13:37:01Z',
  };
}

export function proposed(actor: Actor, spans: readonly Span[] = [span]): ClaimProposed {
  return {
    ...envelope('ClaimProposed', actor, CLAIM),
    payload: {
      claimId: CLAIM, lineageId: lineageId('cc-art2477'), subjectKey: 'ricavi.limite',
      normalizedValue: { type: 'money', amount: 2_000_000, currency: 'EUR' },
      spans: spans as [Span, ...Span[]], sectionPath: 'c2',
    },
  };
}

export function verified(actor: Actor, evidence: ClaimVerified['evidence']): ClaimVerified {
  return { ...envelope('ClaimVerified', actor, CLAIM), payload: { claimId: CLAIM }, evidence };
}

export function contested(actor: Actor, conflictingClaimId: ClaimId = OTHER): ClaimContested {
  return {
    ...envelope('ClaimContested', actor, CLAIM),
    payload: { claimId: CLAIM, conflictingClaimId },
    evidence: {
      dimension: 'same-subject-different-value',
      values: [{ type: 'money', amount: 2_000_000, currency: 'EUR' }, { type: 'money', amount: 4_000_000, currency: 'EUR' }],
      spans: [span, { ...span, version: 'v9' }],
    },
  };
}

export function superseded(actor: Actor, reason: ClaimSuperseded['evidence']['reason'], successor: ClaimId = OTHER): ClaimSuperseded {
  return { ...envelope('ClaimSuperseded', actor, CLAIM), payload: { claimId: CLAIM, successor }, evidence: { reason } };
}

export const humanNote = { kind: 'human', note: 'ok' } as const;
export const classA = { kind: 'class-A', reconfirmedBeliefId: OTHER, batchId: 'btc-v9-01', probeResult: 'not-applicable' } as const;
export const importRecord = { kind: 'import', sourceRecord: 'register row 4' } as const;

export type { ClaimEvent };
