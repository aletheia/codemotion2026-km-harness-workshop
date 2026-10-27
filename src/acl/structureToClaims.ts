// Structure → Claims ACL, the reference ACL (04-domain-model-reference.md §2):
//   filter       only StructureVerified; anything else yields no unit
//   translate    one extraction unit per node of type `comma` (never `note` or `index`):
//                (documentId, version, path, text, base offset, section type)
//   stamp        causation = the StructureVerified event
//   reject       a malformed tree becomes an ACLRejected draft (never a throw), so the log records why
//                nothing was extracted
// Section-local spans returned by an extractor become absolute by adding the unit's base offset (anchor).
import { z } from 'zod';
import { documentId as asDocumentId } from '../domain/ids';
import { toAbsolute, type Span } from '../domain/span';
import { deriveEventId } from '../events/eventId';
import type { EventDraft } from '../events/log';
import type { LogEvent } from '../events/schema';

export interface ClaimsUnit {
  readonly documentId: string;
  readonly version: string;
  readonly path: string;
  readonly text: string;
  readonly baseOffset: number;
  readonly sectionType: 'comma';
  readonly causationId: string;              // the StructureVerified event
}

/** The tree as the ACL receives it: not trusted, validated here. */
export interface TreeInput {
  readonly treeId: string;
  readonly documentId: string;
  readonly version: string;
  readonly nodes: readonly unknown[];
}

export type AclResult =
  | { readonly units: readonly ClaimsUnit[]; readonly rejected?: undefined }
  | { readonly units: readonly []; readonly rejected: EventDraft };

const NODE_FIELDS = ['path', 'type', 'start', 'end'] as const;

const nodeSchema = z.object({
  path: z.string().min(1),
  type: z.enum(['comma', 'note', 'index']),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
});

/** Field paths a node is missing or has malformed, e.g. 'nodes[3].start'. */
function malformedFields(nodes: readonly unknown[], textLength: number): string[] {
  if (nodes.length === 0) return ['nodes'];
  return nodes.flatMap((raw, i) => {
    const parsed = nodeSchema.safeParse(raw);
    if (!parsed.success) {
      const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')));
      return NODE_FIELDS.filter((f) => bad.has(f)).map((f) => `nodes[${i}].${f}`);
    }
    const { start, end } = parsed.data;
    return end <= start || end > textLength ? [`nodes[${i}].end`] : [];
  });
}

export function structureToClaims(
  verified: LogEvent,
  tree: TreeInput,
  text: string,
  opts: { sections?: readonly string[]; correlationId: string },
): AclResult {
  if (verified.type !== 'StructureVerified' || verified.payload.treeId !== tree.treeId) return { units: [] };

  const missingFields = malformedFields(tree.nodes, text.length);
  if (missingFields.length > 0) {
    return {
      units: [],
      rejected: {
        eventId: deriveEventId({
          producer: 'process:acl', inputArtifactId: verified.eventId, extractorVersion: null,
          eventType: 'ACLRejected', aggregateId: tree.treeId,
        }),
        type: 'ACLRejected',
        layer: 'claims',
        aggregateId: tree.treeId,
        actor: { kind: 'process', id: 'acl' },
        causationId: verified.eventId,
        correlationId: opts.correlationId,
        payload: { upstreamEventId: verified.eventId, missingFields },
      },
    };
  }

  const nodes = tree.nodes.map((n) => nodeSchema.parse(n));
  const units = nodes
    .filter((n) => n.type === 'comma')
    .filter((n) => opts.sections === undefined || opts.sections.includes(n.path))
    .map((n): ClaimsUnit => ({
      documentId: tree.documentId,
      version: tree.version,
      path: n.path,
      text: text.slice(n.start, n.end),
      baseOffset: n.start,
      sectionType: 'comma',
      causationId: verified.eventId,
    }));
  return { units };
}

/** Section-local [start, end) → absolute document Span. */
export const anchor = (unit: Pick<ClaimsUnit, 'documentId' | 'version' | 'baseOffset'>, local: { start: number; end: number }): Span =>
  toAbsolute(local, unit.baseOffset, asDocumentId(unit.documentId), unit.version);
