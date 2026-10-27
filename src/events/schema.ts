// Zod schemas for every event type of 04-domain-model-reference.md §4, split into the fact family
// (evidence forbidden) and the decision family (evidence required). The actor field of each event
// admits only the producer kinds of the catalogue, so e.g. an agent-actor ClaimVerified fails to parse.
import { z } from 'zod';
import type { ActorKind } from './actor';

const hex16 = z.string().regex(/^[0-9a-f]{16}$/, 'expected 16 hex chars');
const nonEmpty = z.string().min(1);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const isoTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, 'expected ISO UTC timestamp');
const subjectKey = z.string().regex(/^[^.\s]+\.[^.\s]+$/, 'expected subject.quantity');

export const layerSchema = z.enum(['source', 'structure', 'claims', 'entities', 'policies', 'workflow', 'harness']);

export const spanSchema = z
  .strictObject({
    documentId: nonEmpty,
    version: nonEmpty,
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
  })
  .refine((s) => s.end > s.start, 'span must be half-open [start, end) with end > start');

export const normalizedValueSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('money'), amount: z.number(), currency: z.literal('EUR') }),
  z.strictObject({ type: z.literal('integer'), value: z.int(), unit: z.enum(['years', 'days', 'count']).optional() }),
  z.strictObject({ type: z.literal('percent'), value: z.number() }),
  z.strictObject({ type: z.literal('boolean'), value: z.boolean() }),
  z.strictObject({ type: z.literal('enum'), value: nonEmpty }),
  z.strictObject({ type: z.literal('date'), value: isoDate }),
  z.strictObject({ type: z.literal('reference'), lineageId: nonEmpty }),
]);

const actorSchemas = {
  human: z.strictObject({ kind: z.literal('human'), id: nonEmpty, note: z.string().optional() }),
  agent: z.strictObject({
    kind: z.literal('agent'),
    id: nonEmpty,
    modelId: nonEmpty,
    promptVersion: nonEmpty,
    extractorVersion: nonEmpty,
  }),
  harness: z.strictObject({ kind: z.literal('harness'), id: nonEmpty, rule: z.enum(['class-A', 'contest', 'eval', 'gate', 'bootstrap', 'catalogue']) }),
  import: z.strictObject({ kind: z.literal('import'), id: nonEmpty, source: nonEmpty }),
  process: z.strictObject({ kind: z.literal('process'), id: z.enum(['ingest', 'log-init', 'acl', 'cursor']) }),
} as const;

export const actorSchema = z.discriminatedUnion('kind', Object.values(actorSchemas) as [
  (typeof actorSchemas)['human'], (typeof actorSchemas)['agent'], (typeof actorSchemas)['harness'],
  (typeof actorSchemas)['import'], (typeof actorSchemas)['process'],
]);

function actorOf<K extends ActorKind>(...kinds: K[]) {
  const members = kinds.map((k) => actorSchemas[k]);
  return members.length === 1 ? members[0]! : z.discriminatedUnion('kind', members as [typeof members[number], ...typeof members[number][]]);
}

const envelopeShape = {
  eventId: hex16,
  seq: z.int().positive(),
  aggregateVersion: z.int().positive(),
  aggregateId: nonEmpty,
  causationId: hex16.optional(),
  correlationId: nonEmpty,
  occurredAt: isoTimestamp,
};

type LayerName = z.infer<typeof layerSchema>;

function fact<T extends string, A extends z.ZodType, P extends z.ZodType>(type: T, layer: LayerName | 'any', actor: A, payload: P) {
  return z.strictObject({
    ...envelopeShape,
    type: z.literal(type),
    layer: layer === 'any' ? layerSchema : z.literal(layer),
    actor,
    payload,
    evidence: z.never({ error: `${type} is a fact event: evidence is forbidden` }).optional(),
  });
}

function decision<T extends string, A extends z.ZodType, P extends z.ZodType, E extends z.ZodType>(
  type: T, layer: LayerName, actor: A, payload: P, evidence: E,
) {
  return z.strictObject({
    ...envelopeShape,
    type: z.literal(type),
    layer: z.literal(layer),
    actor,
    payload,
    evidence: evidence,
  });
}

// Evidence for decisions whose details are fixed in later phases: always required, always a non-empty kind.
const evidenceWith = <K extends string, S extends z.ZodRawShape = {}>(kind: K, shape?: S) =>
  z.strictObject({ kind: z.literal(kind), ...(shape ?? ({} as S)) });
const humanNote = evidenceWith('human', { note: nonEmpty });

const sectionNodeSchema = z.strictObject({
  path: nonEmpty,
  type: z.enum(['comma', 'note', 'index']),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
});

// ---------------------------------------------------------------- source
export const LogInitialised = fact('LogInitialised', 'source', actorOf('process'),
  z.strictObject({ logId: nonEmpty, format: nonEmpty, createdAt: isoTimestamp }));

export const DocumentVersionIngested = fact('DocumentVersionIngested', 'source', actorOf('process', 'import'),
  z.strictObject({
    lineageId: nonEmpty,
    documentId: nonEmpty,
    version: nonEmpty,
    contentHash: nonEmpty,
    effectiveFrom: isoDate,
    effectiveTo: isoDate.optional(),
    kind: z.enum(['consolidated-text', 'amending-act', 'system-of-record']),
    length: z.int().nonnegative(),
    sourceReference: nonEmpty,             // Normattiva atto and art.versione
  }));

// ---------------------------------------------------------------- structure
export const StructureProposed = fact('StructureProposed', 'structure', actorOf('agent'),
  z.strictObject({ treeId: nonEmpty, documentId: nonEmpty, version: nonEmpty, nodes: z.array(sectionNodeSchema).min(1) }));

// The human check of a tree records what was checked: nodes reviewed / total and the interval the nodes cover.
const treeCheck = { nodesChecked: z.int().nonnegative(), nodesTotal: z.int().positive(), covers: z.tuple([z.int().nonnegative(), z.int().nonnegative()]) };

export const StructureVerified = decision('StructureVerified', 'structure', actorOf('human', 'harness'),
  z.strictObject({ treeId: nonEmpty }),
  z.discriminatedUnion('kind', [
    evidenceWith('human', { note: nonEmpty, ...treeCheck }),
    // reconfirmedEventId: the StructureVerified of the reconfirmed tree (the tail shows it as ev-NNNN).
    evidenceWith('class-A', { reconfirmedTreeId: nonEmpty, reconfirmedEventId: hex16, probeResult: z.enum(['passed', 'not-applicable']) }),
  ]));

// ---------------------------------------------------------------- claims
// TODO(luca): 04 §7 nests the claim as payload.claim; 03 (show:ricavi-v8) prints a flat payload with
// normalizedValue and sectionPath. 03 wins for output format, so the payload is flat.
export const ClaimProposed = fact('ClaimProposed', 'claims', actorOf('agent', 'human'),
  z.strictObject({
    claimId: hex16,
    label: nonEmpty.optional(),
    lineageId: nonEmpty,
    subjectKey,
    normalizedValue: normalizedValueSchema,
    spans: z.array(spanSchema).min(1, 'a Claim has at least one Span'),
    sectionPath: nonEmpty,
  }));

// checkedSpan: the span the reviewer read when verifying an agent proposal (absent on the reviewer's own claims).
export const ClaimVerified = decision('ClaimVerified', 'claims', actorOf('human', 'harness', 'import'),
  z.strictObject({ claimId: hex16 }),
  z.discriminatedUnion('kind', [
    evidenceWith('human', { note: nonEmpty, checkedSpan: spanSchema.optional() }),
    // beliefEventId: the decision that made the reconfirmed belief verified; auditSampled: picked for human audit.
    evidenceWith('class-A', {
      reconfirmedBeliefId: hex16, beliefEventId: hex16, batchId: nonEmpty,
      probeResult: z.enum(['passed', 'not-applicable']), auditSampled: z.boolean(),
    }),
    evidenceWith('import', { sourceRecord: nonEmpty }),
  ]));

export const ClaimContested = decision('ClaimContested', 'claims', actorOf('harness'),
  z.strictObject({ claimId: hex16, conflictingClaimId: hex16 }),
  z.strictObject({
    dimension: z.literal('same-subject-different-value'),
    values: z.tuple([normalizedValueSchema, normalizedValueSchema]),
    spans: z.tuple([spanSchema, spanSchema]),
  }));

export const ClaimSuperseded = decision('ClaimSuperseded', 'claims', actorOf('human', 'harness'),
  z.strictObject({ claimId: hex16, successor: hex16 }),
  // validUntil: the valid-time end of the superseded claim (the successor's effectiveFrom), on a human resolution.
  z.strictObject({ reason: z.enum(['human-resolution', 'reconfirmation-chain']), note: z.string().optional(), validUntil: isoDate.optional() }));

// ---------------------------------------------------------------- entities
export const EntityProposed = fact('EntityProposed', 'entities', actorOf('agent'),
  z.strictObject({ mention: nonEmpty, span: spanSchema, claimId: hex16, candidateEntityId: nonEmpty }));

export const EntityResolved = decision('EntityResolved', 'entities', actorOf('human', 'harness'),
  z.strictObject({ claimId: hex16, entityId: nonEmpty }),
  z.discriminatedUnion('kind', [humanNote, evidenceWith('catalogue-lookup', { mention: nonEmpty, catalogueEntry: nonEmpty })]));

export const EntityMerged = decision('EntityMerged', 'entities', actorOf('human'),
  z.strictObject({ survivingId: nonEmpty, mergedIds: z.array(nonEmpty).min(1) }),
  humanNote);

// ---------------------------------------------------------------- policies
const applicabilitySchema = z.strictObject({ lineageId: nonEmpty, effectiveFrom: isoDate, effectiveTo: isoDate.optional() });

export const PolicyProposed = fact('PolicyProposed', 'policies', actorOf('agent'),
  z.strictObject({
    policyId: nonEmpty,
    condition: z.unknown(),
    effect: z.unknown(),
    exception: z.unknown().optional(),
    claimIds: z.array(hex16).min(1),
    applicability: applicabilitySchema,
  }));

// The reviewer of a policy checks the triple: the evidence restates condition, effect and exception as read.
export const PolicyVerified = decision('PolicyVerified', 'policies', actorOf('human'),
  z.strictObject({ policyId: nonEmpty }),
  z.discriminatedUnion('kind', [humanNote, evidenceWith('policy-review', { condition: nonEmpty, effect: nonEmpty, exception: nonEmpty.optional() })]));

export const PolicyContested = decision('PolicyContested', 'policies', actorOf('harness'),
  z.strictObject({ policyId: nonEmpty, conflictingPolicyId: nonEmpty }),
  evidenceWith('conflict', { note: nonEmpty }));

export const PolicySuperseded = decision('PolicySuperseded', 'policies', actorOf('human'),
  z.strictObject({ policyId: nonEmpty, successor: nonEmpty }), humanNote);

// ---------------------------------------------------------------- workflow
export const WorkflowStepProposed = fact('WorkflowStepProposed', 'workflow', actorOf('agent'),
  z.strictObject({
    stepId: nonEmpty,
    workflowId: nonEmpty,
    position: z.int().nonnegative(),
    preconditions: z.array(nonEmpty),
    effects: z.array(nonEmpty),
    inputs: z.array(nonEmpty),
    outputs: z.array(nonEmpty),
  }));

const goldenTestOutput = evidenceWith('golden-test', { input: nonEmpty, output: z.unknown(), note: z.string().optional() });

export const WorkflowStepVerified = decision('WorkflowStepVerified', 'workflow', actorOf('human'),
  z.strictObject({ stepId: nonEmpty }), goldenTestOutput);

export const WorkflowStepSuperseded = decision('WorkflowStepSuperseded', 'workflow', actorOf('human'),
  z.strictObject({ stepId: nonEmpty, successor: nonEmpty }), goldenTestOutput);

// ---------------------------------------------------------------- any layer
export const ACLRejected = fact('ACLRejected', 'any', actorOf('process'),
  z.strictObject({ upstreamEventId: hex16, missingFields: z.array(nonEmpty).min(1) }));

// Kept in the catalogue but never emitted in the workshop flow (it would shift every seq).
export const CursorAdvanced = fact('CursorAdvanced', 'any', actorOf('agent', 'process'),
  z.strictObject({ extractor: nonEmpty, lastConsumedSeq: z.int().nonnegative() }));

// ---------------------------------------------------------------- harness
const ratio = z.number().min(0).max(1);

export const EvalCompleted = decision('EvalCompleted', 'harness', actorOf('harness'),
  z.strictObject({
    extractorVersion: nonEmpty,
    goldenSetVersion: nonEmpty,
    tp: z.int().nonnegative(),
    fp: z.int().nonnegative(),
    fn: z.int().nonnegative(),
    precision: ratio,
    recall: ratio,
    items: z.array(z.strictObject({ subjectKey, outcome: nonEmpty, iou: ratio.optional() })),
  }),
  evidenceWith('golden-query', { layer: layerSchema, untilSeq: z.int().positive() }));

const criterionSchema = z.strictObject({ id: z.int().min(1).max(4), value: z.number(), threshold: z.number(), holds: z.boolean() });

export const ExtractorVersionPromoted = decision('ExtractorVersionPromoted', 'harness', actorOf('harness', 'human'),
  z.strictObject({ extractor: nonEmpty, version: nonEmpty, previous: nonEmpty.nullable() }),
  z.discriminatedUnion('kind', [
    evidenceWith('bootstrap', { note: nonEmpty }),
    evidenceWith('criteria', { criteria: z.array(criterionSchema).length(4) }),
  ]));

export const BatchRejected = decision('BatchRejected', 'harness', actorOf('harness'),
  z.strictObject({ batchId: nonEmpty }),
  z.strictObject({
    probeItems: z.int().nonnegative(),
    fp: z.int().nonnegative(),
    fn: z.int().nonnegative(),
    criticalErrors: z.array(subjectKey),
  }));

// ---------------------------------------------------------------- families
export const factSchemas = [
  LogInitialised, DocumentVersionIngested, StructureProposed, ClaimProposed, EntityProposed,
  PolicyProposed, WorkflowStepProposed, ACLRejected, CursorAdvanced,
] as const;

export const decisionSchemas = [
  StructureVerified, ClaimVerified, ClaimContested, ClaimSuperseded, EntityResolved, EntityMerged,
  PolicyVerified, PolicyContested, PolicySuperseded, WorkflowStepVerified, WorkflowStepSuperseded,
  EvalCompleted, ExtractorVersionPromoted, BatchRejected,
] as const;

export const eventSchema = z.discriminatedUnion('type', [...factSchemas, ...decisionSchemas]);

export type LogEvent = z.infer<typeof eventSchema>;
export type EventType = LogEvent['type'];

export const FACT_TYPES: ReadonlySet<string> = new Set(factSchemas.map((s) => s.shape.type.value));
export const DECISION_TYPES: ReadonlySet<string> = new Set(decisionSchemas.map((s) => s.shape.type.value));

export const isDecision = (e: Pick<LogEvent, 'type'>): boolean => DECISION_TYPES.has(e.type);
