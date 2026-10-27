// The belief table shared by projections:build and beliefs: indent 2 · subject 23 · value 15 · label 14 ·
// actor · ev 10 · rest. The actor column is 13 wide, or one more than its longest entry
// ('harness(compare) ' when a harness-verified belief is in the table). Lines carry no trailing spaces.
import { tableValue } from '../catalog/normalizer';
import type { NormalizedValue } from '../domain/claim';

export interface BeliefRow {
  readonly subjectKey: string;
  readonly value: NormalizedValue;
  readonly label: string;
  readonly actor: string;                    // 'human(luca)'
  readonly ev: string;                       // 'ev-0030'
  readonly rest?: string;
}

export function formatBeliefRows(rows: readonly BeliefRow[]): string[] {
  const actorWidth = Math.max(13, ...rows.map((r) => r.actor.length + 1));
  return rows.map((r) =>
    ('  ' + r.subjectKey.padEnd(23) + tableValue(r.value).padEnd(15) + r.label.padEnd(14) + r.actor.padEnd(actorWidth) + r.ev.padEnd(10) + (r.rest ?? '')).trimEnd());
}
