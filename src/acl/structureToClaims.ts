// Anti-corruption layer Structure -> Claims. Pure.
// The Claims context sees only a ClaimsExtractionUnit; it never sees structure types.
// Section-local spans are converted to absolute coordinates HERE (baseOffset), not by the extractor.
import type { DocumentId, EventId } from '../domain/ids';
import type { StructureNode } from '../events/types';

export interface ClaimsExtractionUnit {
  unitId: string;
  documentId: DocumentId;
  version: string;
  sectionPath: string;
  baseOffset: number;
  length: number;
  text: string;
  /** The StructureVerified event this unit derives from (causation of every ClaimProposed). */
  causationId: EventId;
}

export type AclResult =
  | { ok: true; unit: ClaimsExtractionUnit }
  | { ok: false; missing: string[]; reason: string };

export function buildUnit(args: {
  documentId: DocumentId;
  version: string;
  documentText: string;
  nodes: readonly StructureNode[];
  sectionPath: string;
  structureVerifiedEventId: EventId | null;
}): AclResult {
  if (!args.structureVerifiedEventId) {
    return { ok: false, missing: ['StructureVerified'], reason: `structure of ${args.documentId}@${args.version} is not verified; claims extraction refused` };
  }
  const node = args.nodes.find((n) => n.path === args.sectionPath);
  if (!node) return { ok: false, missing: ['section'], reason: `section ${args.sectionPath} not found in verified structure` };
  if (node.type !== 'article') return { ok: false, missing: ['section.type=article'], reason: `section ${args.sectionPath} is a ${node.type}, not an article` };
  return {
    ok: true,
    unit: {
      unitId: `${args.documentId}:${node.path}`,
      documentId: args.documentId,
      version: args.version,
      sectionPath: node.path,
      baseOffset: node.start,
      length: node.end - node.start,
      text: args.documentText.slice(node.start, node.end),
      causationId: args.structureVerifiedEventId,
    },
  };
}
