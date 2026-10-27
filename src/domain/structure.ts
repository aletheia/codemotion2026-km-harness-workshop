// Structure invariants. Pure.
import type { StructureNode } from '../events/types';

/** Returns null when the nodes tile [0, docLength) without gaps or overlaps and paths are unique. */
export function checkStructure(nodes: readonly StructureNode[], docLength: number): string | null {
  if (nodes.length === 0) return 'structure has no nodes';
  const sorted = [...nodes].sort((a, b) => a.start - b.start);
  const paths = new Set<string>();
  let cursor = 0;
  for (const n of sorted) {
    if (paths.has(n.path)) return `duplicate section path ${n.path}`;
    paths.add(n.path);
    if (n.end <= n.start) return `section ${n.path} is empty`;
    if (n.start !== cursor) return `section ${n.path} starts at ${n.start}, expected ${cursor} (gap or overlap)`;
    cursor = n.end;
  }
  return cursor === docLength ? null : `sections end at ${cursor}, document length is ${docLength}`;
}
