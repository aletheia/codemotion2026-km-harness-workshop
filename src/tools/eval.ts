// npm run eval:claims-v1 | eval:claims-v2-summary — an extractor version on a golden set, per pair
// (or --summary: the counts only, next to the promoted version's), then the EvalCompleted it appended.
// TODO(luca): fallback/seg5/eval-*.txt end with the "→ EvalCompleted ev-NNNN" line and carry no tail line
// for it, so the dry-run composer (phase F2) must not append the raw tail line after this script.
import { config } from '../config';
import { shortValue } from '../catalog/normalizer';
import type { NormalizedValue } from '../domain/claim';
import type { Span } from '../domain/span';
import type { EvalProposal } from '../harness/eval/align';
import type { AlignedPair } from '../harness/eval/evaluate';
import type { Metrics } from '../harness/eval/metrics';
import { expectedCount } from '../harness/golden/query';
import { runEval } from '../processes/eval';
import { argValue, hasFlag, run } from './cli';
import { displayEventId } from './tail-format';

const OUTCOME = { correct: 'correct', 'wrong-value': 'wrong value', 'wrong-provenance': 'wrong provenance' } as const;
const COUNTS = { correct: 'TP', 'wrong-value': 'FP + FN', 'wrong-provenance': 'FP + FN' } as const;

const tag = (v: string) => v.split('@')[1] ?? v;
const value = (v: NormalizedValue) => (v.type === 'enum' ? `"${v.value}"` : shortValue(v));
const interval = (s: { start: number; end: number }) => `[${s.start},${s.end})`;
/** Padded to width, with at least one space after a cell that fills it. */
const cell = (text: string, width: number) => (text.length < width ? text.padEnd(width) : `${text} `);

const totals = (m: Metrics) => `TP ${m.tp}  FP ${m.fp}  FN ${m.fn}   precision ${m.precision.toFixed(2)}   recall ${m.recall.toFixed(2)}`;

await run('eval', () => {
  const argv = process.argv.slice(2);
  const extractorVersion = argValue(argv, 'extractor') ?? 'claims@v1';
  const { golden, evaluation, result, previous } = runEval(extractorVersion, argValue(argv, 'golden'));
  const appended = `→ EvalCompleted ${displayEventId(result.seq)}`;

  if (hasFlag(argv, 'summary')) {
    const prev = previous ? `     (${tag(previous.extractorVersion)}: ${previous.metrics.precision.toFixed(2)} / ${previous.metrics.recall.toFixed(2)})` : '';
    process.stdout.write([`eval  extractor=${extractorVersion}  golden=${golden.version}  --summary`, totals(evaluation.metrics) + prev, appended].join('\n') + '\n');
    return;
  }

  // Spans: absolute, then section-local (absolute − the section's base offset).
  const base = new Map(golden.items.map((i) => [i.inputArtifactId, i.input.baseOffset] as const));
  const sections = [...new Set(golden.items.map((i) => i.input.sectionPath))];
  const spans = (s: readonly Span[], input: string) => `${interval(s[0]!)} ${interval({ start: s[0]!.start - base.get(input)!, end: s[0]!.end - base.get(input)! })}`;
  const claim = (key: string, v: NormalizedValue, s: readonly Span[], input: string) => `${key} ${value(v)} ${spans(s, input)}`;

  // TODO(luca): fallback/seg5/eval-v1.txt pads the expected column to 46 on the header and the "—" row and
  // to 47 on the other rows; reproduced because the fallback is the acceptance target.
  const pairRow = (p: AlignedPair) => [
    cell(claim(p.expected.subjectKey, p.expected.value, p.expected.spans, p.inputArtifactId), 47),
    cell(p.proposal ? claim(p.proposal.subjectKey, p.proposal.value, p.proposal.spans, p.inputArtifactId) : '—', 46),
    cell(p.iou !== undefined ? p.iou.toFixed(2) : '—', 7),
    cell(p.outcome ? OUTCOME[p.outcome] : 'missing', 17),
    p.outcome ? COUNTS[p.outcome] : 'FN',
  ].join('');
  // An unpaired proposal shows its absolute span only: with the local one it would not fit the column.
  const unpairedRow = (p: EvalProposal) =>
    [cell('—', 46), cell(`${p.subjectKey} ${value(p.value)} ${interval(p.spans[0]!)}`, 46), cell('—', 7), cell('unexpected', 17), 'FP'].join('');

  process.stdout.write([
    `eval  extractor=${extractorVersion}  golden=${golden.version} (until seq ${golden.untilSeq}, ${expectedCount(golden)} expected)  ` +
      `theta_iou=${config.eval.iouThreshold.toFixed(2)} (illustrative)   spans: absolute [${sections.length === 1 ? sections[0] : 'section'}-local]`,
    'expected'.padEnd(46) + `proposal (${tag(extractorVersion)})`.padEnd(47) + 'IoU'.padEnd(7) + 'outcome'.padEnd(17) + 'counts',
    ...evaluation.pairs.map(pairRow),
    ...evaluation.unpaired.map(unpairedRow),
    totals(evaluation.metrics),
    appended,
  ].join('\n') + '\n');
});
