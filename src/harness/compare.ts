// The three-class comparator. Deterministic, no model. Pure.
//   UNEXPECTED: subject not in the catalogue (high-priority queue).  B: no belief.  A: equal value.  C: different value.
//   Within the SAME document version a class-A match also needs span IoU >= theta (provenance must agree).
import { iou, type Span } from '../domain/span';
import { valueEquals, type NormalizedValue } from '../domain/value';
import type { StructureNode } from '../events/types';

export type ComparatorClass = 'A' | 'B' | 'C' | 'UNEXPECTED';
export interface Subject { subjectKey: string; value: NormalizedValue; span: Span }
export interface BeliefView { claimId: string; value: NormalizedValue; span: Span }
export interface Classification { cls: ComparatorClass; reason: string }

export function classify(p: Subject, belief: BeliefView | undefined, inCatalogue: boolean, thetaIoU: number): Classification {
  if (!inCatalogue) return { cls: 'UNEXPECTED', reason: `subject ${p.subjectKey} is not in the catalogue` };
  if (!belief) return { cls: 'B', reason: 'no current belief for this subject' };
  if (!valueEquals(p.value, belief.value)) return { cls: 'C', reason: 'value differs from the current belief' };
  const sameVersion = p.span.documentId === belief.span.documentId && p.span.version === belief.span.version;
  if (sameVersion && iou(p.span, belief.span) < thetaIoU) return { cls: 'B', reason: `same value but span IoU below ${thetaIoU} within one document version` };
  return { cls: 'A', reason: 'same value as the current belief' };
}

/** Section tree shape: paths, types and titles in order. Offsets belong to the document version and are not compared. */
export const treeShape = (nodes: readonly StructureNode[]): string => nodes.map((n) => `${n.path}|${n.type}|${n.title}`).join('\n');
export const sameTreeShape = (a: readonly StructureNode[], b: readonly StructureNode[]): boolean => treeShape(a) === treeShape(b);

/**
 * Deterministic audit sampling of class-A reconfirmations: the same claim id gives the same answer.
 * rate 1 samples everything (cold start).
 */
export function auditSampled(claimIdHex: string, rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const bucket = parseInt(claimIdHex.slice(0, 6), 16) % 1000;
  return bucket < rate * 1000;
}
