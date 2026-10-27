// Event envelope and payloads. Pure types: no I/O.
import type { ClaimId, DocumentId, EventId, LineageId } from '../domain/ids';
import type { ClaimState, SubjectKey } from '../domain/claim';
import type { NormalizedValue } from '../domain/value';
import type { Span } from '../domain/span';

export type Layer = 'source' | 'structure' | 'claims' | 'entities' | 'policies' | 'workflow' | 'harness';
export type ActorKind = 'human' | 'agent' | 'harness' | 'import' | 'process';

export type Actor =
  | { kind: 'human'; id: string }
  | { kind: 'agent'; id: string; extractorVersion: string; modelId: string; promptVersion: string }
  | { kind: 'harness'; id: string; version: string }
  | { kind: 'import'; id: string }
  | { kind: 'process'; id: string };

export type SectionType = 'article' | 'index' | 'note';
export interface StructureNode {
  path: string; // e.g. "art12", "index", "note"
  type: SectionType;
  title: string;
  start: number; // absolute, inclusive
  end: number; // absolute, exclusive
}

export interface ReviewedSpan { start: number; end: number }

export type Evidence =
  | { kind: 'human'; note?: string; reviewedSpans?: ReviewedSpan[]; handAdded?: boolean }
  | {
      kind: 'class-A';
      comparator: string;
      reconfirmed: { claimId?: ClaimId; treeId?: string };
      matchedValue?: string;
      auditSampled: boolean;
      gate: 'not-applicable' | 'passed' | 'failed';
      gateNote: string;
    }
  | { kind: 'class-C'; beliefClaimId: ClaimId; beliefValue: string; proposedValue: string }
  | { kind: 'supersession'; supersededBy: ClaimId; reason: 'reconfirmation-chain' | 'human-resolution' };

export interface PayloadMap {
  LogInitialised: { logId: string; format: string };
  DocumentVersionIngested: {
    documentId: DocumentId;
    lineageId: LineageId;
    version: string;
    effectiveFrom: string; // YYYY-MM-DD
    contentHash: string;
    length: number;
    source: string;
  };
  ACLRejected: { unitRef: string; upstreamEventId: EventId | null; missing: string[]; reason: string };
  CursorAdvanced: { cursor: string; position: number };
  StructureProposed: { treeId: string; documentId: DocumentId; version: string; nodes: StructureNode[] };
  StructureVerified: { treeId: string; documentId: DocumentId; version: string };
  ClaimProposed: {
    claimId: ClaimId;
    lineageId: LineageId;
    documentId: DocumentId;
    version: string;
    subjectKey: SubjectKey;
    valueText: string;
    value: NormalizedValue;
    spans: Span[];
    quote: string;
    sectionPath: string;
  };
  ClaimVerified: { claimId: ClaimId };
  ClaimContested: { claimId: ClaimId };
  ClaimSuperseded: { claimId: ClaimId; successor: ClaimId };
  ExtractorVersionPromoted: { extractor: string; version: string; previous: string | null };
}

export type EventType = keyof PayloadMap;

export interface EventDraft<T extends EventType = EventType> {
  eventId: EventId;
  type: T;
  layer: Layer;
  aggregateId: string;
  actor: Actor;
  causationId: EventId | null;
  correlationId: string;
  payload: PayloadMap[T];
  evidence?: Evidence;
}

export type StoredEvent<T extends EventType = EventType> = EventDraft<T> & {
  seq: number;
  aggregateVersion: number;
  occurredAt: string;
};
export type AnyStoredEvent = { [T in EventType]: StoredEvent<T> }[EventType];
export type AnyDraft = { [T in EventType]: EventDraft<T> }[EventType];

/** Decisions carry evidence; facts never do. */
export const DECISION_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  'StructureVerified', 'ClaimVerified', 'ClaimContested', 'ClaimSuperseded', 'ExtractorVersionPromoted',
]);
export const isDecision = (t: EventType): boolean => DECISION_TYPES.has(t);

export const LAYER_OF: Record<EventType, Layer> = {
  LogInitialised: 'harness',
  DocumentVersionIngested: 'source',
  ACLRejected: 'harness',
  CursorAdvanced: 'harness',
  StructureProposed: 'structure',
  StructureVerified: 'structure',
  ClaimProposed: 'claims',
  ClaimVerified: 'claims',
  ClaimContested: 'claims',
  ClaimSuperseded: 'claims',
  ExtractorVersionPromoted: 'harness',
};

/** Layer contract: a *Proposed event's causation must be a *Verified event of the previous layer. */
export const REQUIRED_CAUSATION: Partial<Record<EventType, EventType>> = {
  ClaimProposed: 'StructureVerified',
  StructureProposed: 'DocumentVersionIngested', // a source fact is the "verified" input of the first layer
};

export type { ClaimState };
