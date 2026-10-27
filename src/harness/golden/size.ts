// How large a layer's golden set is, which is all the cold-start gate needs (05-harness-design.md §1, §5):
// the human-actor verifications of the layer up to untilSeq. Harness- and import-actor decisions are
// excluded (circular). Claims: one expected item per human-verified claim. Structure: one item per
// human-verified tree. The full query (items, expected claims, prompt-example exclusion) is golden/query.ts.
import type { LogEvent } from '../../events/schema';

const VERIFIED: Readonly<Record<'claims' | 'structure', LogEvent['type']>> = { claims: 'ClaimVerified', structure: 'StructureVerified' };

/** 4 for claims and 1 for structure after segment 2; the cold-start gate compares it with the probe minimum. */
export function goldenSize(events: readonly LogEvent[], layer: 'claims' | 'structure', untilSeq: number = Infinity): number {
  return events.filter((e) => e.seq <= untilSeq && e.type === VERIFIED[layer] && e.actor.kind === 'human').length;
}
