// The three-class comparator (05-harness-design.md §6). Pure and deterministic:
//   1. resolve the lineage (carried by the proposal)
//   2. canonicalize the subject through the catalogue — unresolved = UNEXPECTED (high-priority human queue)
//   3. look up (lineage, subject) in CurrentBeliefs
//   4. absent = B (novelty, stays proposed); equal value = A (reconfirmation); different value = C (conflict)
//   5. in class A within the same document version, also require span IoU ≥ θ (else B: a human looks)
// Policies and Workflow never take the class-A path: an A there is downgraded to B (hard-coded).
import type { Subject } from '../../catalog/subjects';
import { sameValue, type NormalizedValue, type SubjectKey } from '../../domain/claim';
import { iou, type Span } from '../../domain/span';
import { beliefKey, type Belief, type BeliefKey } from '../beliefs/currentBeliefs';

export type ComparatorClass = 'A' | 'B' | 'C' | 'UNEXPECTED';

/** The subject catalogue as the comparator needs it: canonical key → subject, undefined when unresolved. */
export interface Catalog {
  lookup(subjectKey: string): Subject | undefined;
}

/** A proposed claim, reduced to what the comparison reads. */
export interface Proposal {
  readonly claimId: string;
  readonly lineageId: string;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
}

/** The class with its evidence: the belief compared against (A, C, and B on a span or layer downgrade). */
export type Comparison =
  | { readonly cls: 'A'; readonly evidence: { readonly belief: Belief; readonly iou?: number } }
  | { readonly cls: 'B'; readonly evidence: { readonly reason: 'no belief' | 'span below threshold' | 'layer never class A'; readonly belief?: Belief } }
  | { readonly cls: 'C'; readonly evidence: { readonly belief: Belief; readonly values: readonly [NormalizedValue, NormalizedValue] } }
  | { readonly cls: 'UNEXPECTED'; readonly evidence: { readonly reason: 'subject not in catalogue'; readonly subjectKey: string } };

export interface CompareOptions {
  readonly thetaIoU: number;
  /** The layer of the proposal; Policies and Workflow are always B or C. */
  readonly layer?: 'claims' | 'policies' | 'workflow';
}

const NEVER_CLASS_A: ReadonlySet<string> = new Set(['policies', 'workflow']);

export function compare(proposal: Proposal, beliefs: ReadonlyMap<BeliefKey, Belief>, catalog: Catalog, opts: CompareOptions): Comparison {
  const subject = catalog.lookup(proposal.subjectKey);
  if (!subject) return { cls: 'UNEXPECTED', evidence: { reason: 'subject not in catalogue', subjectKey: proposal.subjectKey } };

  // Look up by the catalogue's canonical key, not the raw one the extractor returned.
  const belief = beliefs.get(beliefKey(proposal.lineageId, subject.key));
  if (!belief) return { cls: 'B', evidence: { reason: 'no belief' } };
  if (!sameValue(proposal.value, belief.value)) return { cls: 'C', evidence: { belief, values: [belief.value, proposal.value] } };

  // Same value from here on.
  if (NEVER_CLASS_A.has(opts.layer ?? 'claims')) return { cls: 'B', evidence: { reason: 'layer never class A', belief } };
  // Across versions offsets differ by construction (v9 c2 starts at 737, v8 c2 at 720): compare spans only
  // when the proposal and the belief point into the same document version.
  const sameVersion = belief.spans.some((b) => proposal.spans.some((p) => p.documentId === b.documentId && p.version === b.version));
  if (!sameVersion) return { cls: 'A', evidence: { belief } };
  const best = Math.max(...proposal.spans.flatMap((p) => belief.spans.map((b) => iou(p, b))));
  return best >= opts.thetaIoU ? { cls: 'A', evidence: { belief, iou: best } } : { cls: 'B', evidence: { reason: 'span below threshold', belief } };
}

// ---------------------------------------------------------------- structure
// Structure reconfirmation: a proposed tree with the same node paths and types, in the same order, as a
// verified tree of the same lineage is class A. Across versions only paths and types are compared: the
// offsets differ by construction (v9 is 21 characters longer than v8).

export interface TreeShape {
  readonly treeId: string;
  readonly nodes: readonly { readonly path: string; readonly type: string }[];
}

/** Same node count, and node by node the same path and type in the same order; intervals are ignored. */
export const sameShape = (a: TreeShape, b: TreeShape): boolean =>
  a.nodes.length === b.nodes.length && a.nodes.every((n, i) => n.path === b.nodes[i]!.path && n.type === b.nodes[i]!.type);

/** The first verified tree the proposal reconfirms (class A), or undefined (the tree goes to the human). */
export function compareStructure<T extends TreeShape>(proposal: TreeShape, verified: readonly T[]): T | undefined {
  return verified.find((v) => v.treeId !== proposal.treeId && sameShape(proposal, v));
}
