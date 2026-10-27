// npm run replay:claims-v2 — the Claims layer replayed with a candidate extractor version.
// Prints the inputs, the counts, then the appended events through the tail formatter: the first five in
// full, the rest one line per input, so the output stays one screenful.
// TODO(luca): fallback/seg4/replay-claims-v2.txt shows the collapsed tail, so this script prints its own
// tail lines; the dry-run composer (phase F2) must not append the 11 raw tail lines after it.
import { config } from '../config';
import { readLog } from '../events/log';
import { replayClaims } from '../processes/replay';
import { argValue, run } from './cli';
import { displayEventId, formatLog, formatTailRange } from './tail-format';

const SHOWN = 5;
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

await run('replay', () => {
  const extractorVersion = argValue(process.argv.slice(2), 'extractor') ?? 'claims@v2';
  const path = config.paths.log;
  const before = readLog(path).length;
  const { promoted, inputs } = replayClaims(extractorVersion, path);
  const events = readLog(path);
  const seqOf = new Map(events.map((e) => [e.eventId, e.seq] as const));

  const where = (i: (typeof inputs)[number], sep: string) => (i.sections.length === 1 ? `${i.version}${sep}${i.sections[0]}` : i.version);
  const appended = inputs.flatMap((i) => i.results).filter((r) => !r.duplicate).length;
  const total = inputs.reduce((n, i) => n + i.results.length, 0);
  const out = [
    `replay  extractor=${extractorVersion} (${promoted ? 'promoted' : 'candidate'})  inputs: StructureVerified ` +
      inputs.map((i) => `${displayEventId(seqOf.get(i.verifiedEventId)!)} (${i.version}: ${i.sections.join(', ')})`).join(', ') +
      '  (fixture replay)',
    `proposals: ${inputs.map((i) => `${i.results.length} (${where(i, '/')})`).join(' + ')} = ${appended} appended, ${total - appended} duplicates`,
  ];

  // Tail of the appended events: the first SHOWN lines in full, then one range line per remaining input.
  // The label column is as wide as the longest label shown, so the causation column stays aligned.
  const fresh = events.slice(before);
  const labelWidth = Math.max(0, ...fresh.slice(0, SHOWN).map((e) => (e.payload as { label?: string }).label?.length ?? 0));
  const lines = formatLog(events, { labelWidth });
  out.push(...lines.slice(before, before + SHOWN));
  for (const input of inputs) {
    const rest = fresh.slice(SHOWN).filter((e) => e.causationId === input.verifiedEventId);
    if (rest.length === 0) continue;
    const what = `(${input.version}: ${input.sections.join(', ')} — ${WORDS[rest.length] ?? rest.length} proposals)`;
    out.push(rest.length === 1 ? lines[rest[0]!.seq - 1]! : formatTailRange(rest[0]!.seq, rest.at(-1)!.seq, rest[0]!, what));
  }
  process.stdout.write(out.join('\n') + '\n');
});
