// Runtime validation of the envelope and payloads (zod). Pure: no I/O.
import { z } from 'zod';
import { DECISION_TYPES, LAYER_OF, type AnyDraft, type EventType } from './types';

const id16 = z.string().regex(/^[0-9a-f]{16}$/, 'expected 16 hex chars');
const spanZ = z.object({ documentId: z.string(), version: z.string(), start: z.number().int().nonnegative(), end: z.number().int().positive() })
  .refine((s) => s.end > s.start, 'span must be non-empty');
const valueZ = z.discriminatedUnion('type', [
  z.object({ type: z.literal('money'), amount: z.number(), currency: z.literal('EUR') }),
  z.object({ type: z.literal('percent'), value: z.number() }),
  z.object({ type: z.literal('boolean'), value: z.boolean() }),
  z.object({ type: z.literal('enum'), value: z.string() }),
  z.object({ type: z.literal('date'), value: z.string() }),
]);
const nodeZ = z.object({
  path: z.string().min(1), type: z.enum(['article', 'index', 'note']), title: z.string(),
  start: z.number().int().nonnegative(), end: z.number().int().positive(),
});

export const actorZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('human'), id: z.string().min(1) }),
  z.object({ kind: z.literal('agent'), id: z.string().min(1), extractorVersion: z.string(), modelId: z.string(), promptVersion: z.string() }),
  z.object({ kind: z.literal('harness'), id: z.string().min(1), version: z.string() }),
  z.object({ kind: z.literal('import'), id: z.string().min(1) }),
  z.object({ kind: z.literal('process'), id: z.string().min(1) }),
]);

export const evidenceZ = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('human'), note: z.string().optional(),
    reviewedSpans: z.array(z.object({ start: z.number().int(), end: z.number().int() })).optional(),
    handAdded: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('class-A'), comparator: z.string(),
    reconfirmed: z.object({ claimId: id16.optional(), treeId: z.string().optional() }),
    matchedValue: z.string().optional(), auditSampled: z.boolean(),
    gate: z.enum(['not-applicable', 'passed', 'failed']), gateNote: z.string(),
  }),
  z.object({ kind: z.literal('class-C'), beliefClaimId: id16, beliefValue: z.string(), proposedValue: z.string() }),
  z.object({ kind: z.literal('supersession'), supersededBy: id16, reason: z.enum(['reconfirmation-chain', 'human-resolution']) }),
]);

const payloadZ: Record<EventType, z.ZodTypeAny> = {
  LogInitialised: z.object({ logId: z.string(), format: z.string() }),
  DocumentVersionIngested: z.object({
    documentId: z.string(), lineageId: z.string(), version: z.string(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), contentHash: id16, length: z.number().int().positive(), source: z.string(),
  }),
  ACLRejected: z.object({ unitRef: z.string(), upstreamEventId: id16.nullable(), missing: z.array(z.string()), reason: z.string() }),
  CursorAdvanced: z.object({ cursor: z.string(), position: z.number().int().nonnegative() }),
  StructureProposed: z.object({ treeId: z.string(), documentId: z.string(), version: z.string(), nodes: z.array(nodeZ).min(1) }),
  StructureVerified: z.object({ treeId: z.string(), documentId: z.string(), version: z.string() }),
  ClaimProposed: z.object({
    claimId: id16, lineageId: z.string(), documentId: z.string(), version: z.string(),
    subjectKey: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/), valueText: z.string().min(1),
    value: valueZ, spans: z.array(spanZ).min(1), quote: z.string().min(1), sectionPath: z.string(),
  }),
  ClaimVerified: z.object({ claimId: id16 }),
  ClaimContested: z.object({ claimId: id16 }),
  ClaimSuperseded: z.object({ claimId: id16, successor: id16 }),
  ExtractorVersionPromoted: z.object({ extractor: z.string(), version: z.string(), previous: z.string().nullable() }),
};

const envelopeZ = z.object({
  eventId: id16, type: z.string(), layer: z.string(), aggregateId: z.string().min(1), actor: actorZ,
  causationId: id16.nullable(), correlationId: z.string().min(1), payload: z.unknown(), evidence: evidenceZ.optional(),
});

/** Returns null if the draft is valid, else a one-line reason. */
export function validateDraft(d: unknown): string | null {
  const env = envelopeZ.safeParse(d);
  if (!env.success) return `envelope: ${fmt(env.error)}`;
  const type = env.data.type as EventType;
  const pz = payloadZ[type];
  if (!pz) return `unknown event type ${env.data.type}`;
  const p = pz.safeParse(env.data.payload);
  if (!p.success) return `payload of ${type}: ${fmt(p.error)}`;
  if (LAYER_OF[type] !== env.data.layer) return `${type} belongs to layer ${LAYER_OF[type]}, not ${env.data.layer}`;
  const decision = DECISION_TYPES.has(type);
  if (decision && !env.data.evidence) return `${type} is a decision: evidence is required`;
  if (!decision && env.data.evidence) return `${type} is a fact: evidence is forbidden`;
  return null;
}

const fmt = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

export const parseStored = (line: string): unknown => JSON.parse(line);
export type { AnyDraft };
