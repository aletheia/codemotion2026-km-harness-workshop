// CurrentBeliefs as a stored projection (04-domain-model-reference.md §6): the fold of
// harness/beliefs/currentBeliefs.ts, one row per (lineage, subject key), in catalogue order.
import { SUBJECTS } from '../catalog/subjects';
import type { LogEvent } from '../events/schema';
import { build, type Belief } from '../harness/beliefs/currentBeliefs';

/** Position of a subject in the catalogue; tables list beliefs in this order. */
export const catalogueRank = (subjectKey: string): number => {
  const i = SUBJECTS.findIndex((s) => s.key === subjectKey);
  return i < 0 ? SUBJECTS.length : i;
};

/** Beliefs grouped by lineage, each lineage's rows in catalogue order (unknown subjects last, by key). */
export function currentBeliefs(events: readonly LogEvent[]): Record<string, Belief[]> {
  const byLineage: Record<string, Belief[]> = {};
  for (const b of build(events).values()) (byLineage[b.lineageId] ??= []).push(b);
  for (const rows of Object.values(byLineage)) {
    rows.sort((a, b) => catalogueRank(a.subjectKey) - catalogueRank(b.subjectKey) || a.subjectKey.localeCompare(b.subjectKey));
  }
  return byLineage;
}
