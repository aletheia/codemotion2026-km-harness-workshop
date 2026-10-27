// npm run golden:claims-until-seg2 | golden:claims — the golden set as a query over the log.
// Header (cut-off, what was excluded), then one block per input with its expected claims in text order.
// A set past a named cut-off is printed against it: an input whose expected claims are unchanged since
// the previous named set shows "N as above".
import { config } from '../config';
import { tableValue } from '../catalog/normalizer';
import { readLog } from '../events/log';
import type { LogEvent } from '../events/schema';
import { expectedCount, previousCutoff, type ExpectedClaim, type GoldenItem, type GoldenSet } from '../harness/golden/query';
import { claimsGolden } from '../processes/eval';
import { argValue, run } from './cli';
import { displayEventId } from './tail-format';

const INPUT_WIDTH = 33;
const PER_LINE = 3;

const expectedText = (x: ExpectedClaim) => `${x.subjectKey} ${tableValue(x.value)} [${x.spans[0]!.start},${x.spans[0]!.end})`;

/** Balanced lines of at most PER_LINE claims: 4 → 2 + 2, 3 → 3. */
function chunks<T>(xs: readonly T[]): T[][] {
  const lines = Math.ceil(xs.length / PER_LINE);
  const size = Math.ceil(xs.length / lines);
  return Array.from({ length: lines }, (_, i) => xs.slice(i * size, (i + 1) * size));
}

function format(set: GoldenSet, events: readonly LogEvent[], previous?: GoldenSet): string[] {
  const seqOf = new Map(events.map((e) => [e.eventId, e.seq] as const));
  const ev = (id: string) => displayEventId(seqOf.get(id)!);
  const listed = (ids: readonly string[]) => `${ids.length}${ids.length ? ` (${ids.map(ev).join(', ')})` : ''}`;
  const { harness, import: imported, promptExamples } = set.excluded;
  const out = [
    `golden  layer=${set.layer}  until=seq ${set.untilSeq}  actors=human only  ` +
      `excluded: harness-verified ${listed(harness)}, import-verified ${listed(imported)}, prompt examples ${promptExamples.length}`,
    `inputs: ${set.items.length} · expected items: ${expectedCount(set)}   (golden set ${set.version})`,
  ];
  const sameAsBefore = (item: GoldenItem<ExpectedClaim>) => {
    const before = previous?.items.find((i) => i.inputArtifactId === item.inputArtifactId);
    return before !== undefined && before.expected.map((x) => x.claimId).join() === item.expected.map((x) => x.claimId).join();
  };

  for (const item of set.items) {
    const head = `  input ${ev(item.input.structureEventId)} (${item.input.treeId} / ${item.input.sectionPath})`.padEnd(INPUT_WIDTH) + 'expected: ';
    if (sameAsBefore(item)) {
      out.push(`${head}${item.expected.length} as above`);
      continue;
    }
    const inTextOrder = [...item.expected].sort((a, b) => a.spans[0]!.start - b.spans[0]!.start);
    chunks(inTextOrder).forEach((line, i) => out.push((i === 0 ? head : ' '.repeat(head.length)) + line.map(expectedText).join(' · ')));
    const resolved = item.expected.flatMap((x) => (x.resolvedEventId ? [x.resolvedEventId] : []));
    if (resolved.length) out.push(' '.repeat(INPUT_WIDTH) + `← human resolutions of ClaimContested ${resolved.map(ev).join(', ')}`);
  }
  return out;
}

await run('golden', () => {
  const argv = process.argv.slice(2);
  const layer = argValue(argv, 'layer') ?? 'claims';
  if (layer !== 'claims') throw new Error(`golden: layer ${layer} is not queried in the workshop (claims only)`);
  const events = readLog(config.paths.log);
  const set = claimsGolden(events, argValue(argv, 'until'));
  const before = previousCutoff(set.untilSeq);
  const previous = before === undefined ? undefined : claimsGolden(events, String(before));
  process.stdout.write(format(set, events, previous).join('\n') + '\n');
});
