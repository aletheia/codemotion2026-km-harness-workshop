// npm run drift:v1-v2 — two extractor versions on the same golden set, per item; then the noise the new
// version introduces, provenance drift, the four promotion criteria and what happened: promoted
// (ExtractorVersionPromoted appended) or not (nothing appended).
import { readDocument } from '../acl/sourceToStructure';
import { displayValue, droppedMultiplier, shortValue } from '../catalog/normalizer';
import { lookupSubject } from '../catalog/subjects';
import type { DriftRow } from '../harness/eval/drift';
import type { Criterion } from '../harness/eval/promotion';
import { config } from '../config';
import { runDrift, type NoiseItem } from '../processes/eval';
import { argValue, run } from './cli';
import { displayEventId } from './tail-format';

const OUTCOME = { correct: 'correct', 'wrong-value': 'wrong value', 'wrong-provenance': 'wrong provenance', missing: 'missing' } as const;
const tag = (v: string) => v.split('@')[1] ?? v;

/** What went wrong in the new version on a regressed row, and why the row matters. */
function regressionNote(r: DriftRow, to: string): string {
  const { b } = r;
  let what = 'missing';
  if (b.proposal && r.v2 === 'wrong-value') {
    const span = b.expected.spans[0]!;
    const diagnosis = droppedMultiplier(b.expected.value, b.proposal.value, readDocument(span.documentId, span.version).slice(span.start, span.end));
    what = displayValue(b.proposal.value) + (diagnosis ? ` — ${diagnosis}` : '');
  } else if (r.v2 === 'wrong-provenance') {
    what = `IoU ${b.iou!.toFixed(2)}`;
  }
  const cls = lookupSubject(r.subjectKey)?.cls ?? 'unknown';
  return `(${tag(to)}: ${what}; class ${cls}${r.critical ? ' → critical subset' : ''})`;
}

function noiseText(n: NoiseItem): string {
  const notes = [
    ...(n.statedElsewhere ? ['true in the article'] : []),
    ...(n.notInUnit ? [`not in unit ${n.sectionPath}`] : []),
    ...(n.noExpectedItem ? ['no expected item'] : []),
  ];
  return `${n.proposal.subjectKey} ${shortValue(n.proposal.value)}` + (notes.length ? ` (${notes.join(', ')})` : '');
}

await run('drift', () => {
  const argv = process.argv.slice(2);
  const from = argValue(argv, 'from') ?? 'claims@v1';
  const to = argValue(argv, 'to') ?? 'claims@v2';
  const d = runDrift(from, to, argValue(argv, 'golden'));
  const [a, b] = [tag(from), tag(to)];
  const cfg = config.promotion;

  const row = (r: DriftRow) =>
    r.subjectKey.padEnd(28) + OUTCOME[r.v1].padEnd(14) + OUTCOME[r.v2].padEnd(14) + (r.cell === 'regression' ? `REGRESSION   ${regressionNote(r, to)}` : r.cell);

  const verdict = (c: Criterion, failed: string) => (c.holds ? 'ok' : `FAIL (${failed})`);
  const [c1, c2, c3, c4] = d.promotion.criteria as [Criterion, Criterion, Criterion, Criterion];
  const criteria = [
    `1. P ≥ ${cfg.precisionThreshold.toFixed(2)} → ${verdict(c1, c1.value.toFixed(2))}`,
    `2. R(${b}) ≥ R(${a}) − ${cfg.recallEpsilon.toFixed(2)} → ${verdict(c2, c2.value.toFixed(2))}`,
    `3. critical regressions = 0 → ${verdict(c3, d.promotion.criticalRegressions.join(', '))}`,
    `4. wrong-provenance ≤ ${Math.round(cfg.maxWrongProvenanceRate * 100)} % → ${verdict(c4, `${Math.round(c4.value * 100)} %`)}`,
  ];

  process.stdout.write([
    `drift  from=${from}  to=${to}  golden=${d.golden.version}  per item`,
    'expected'.padEnd(28) + a.padEnd(14) + b.padEnd(14) + 'cell',
    ...d.rows.map(row),
    `noise introduced by ${b}: ${d.noise.length ? d.noise.map(noiseText).join('; ') : 'none'}`,
    `provenance drift: ${d.provenance.length ? d.provenance.map((r) => r.subjectKey).join(', ') : 'none'}`,
    `promotion criteria (illustrative): ${criteria.join('   ')}`,
    d.result
      ? `→ promoted; ExtractorVersionPromoted ${displayEventId(d.result.seq)}`
      : `→ not promoted; no ExtractorVersionPromoted; ${b} proposals stay proposed, excluded from reconfirmation`,
  ].join('\n') + '\n');
});
