// npm run compare — the harness on the latest extraction batch: the gate line, then one line per proposal
// with its class, the belief it was compared with and the event it led to.
import { displayValue, shortValue } from '../catalog/normalizer';
import type { NormalizedValue } from '../domain/claim';
import { compareBatch, type ComparedProposal } from '../processes/compare';
import { run } from './cli';

// What each class leads to: the event appended (A, C) or the queue the claim waits in (B, UNEXPECTED).
const ACTION = { A: 'ClaimVerified(harness)', B: 'ReviewQueue', C: 'ClaimContested', UNEXPECTED: 'ReviewQueue (high priority)' } as const;

/** The belief the class was decided against, with its root (A) or its value (C); B and UNEXPECTED say why. */
function reason({ comparison: c }: ComparedProposal): string {
  switch (c.cls) {
    case 'A': return `reconfirms ${c.evidence.belief.label ?? c.evidence.belief.claimId.slice(0, 8)} (${c.evidence.belief.root.kind})`;
    case 'C': return `conflicts ${c.evidence.belief.label ?? c.evidence.belief.claimId.slice(0, 8)} (${displayValue(c.evidence.belief.value)})`;
    case 'B': return c.evidence.reason;
    case 'UNEXPECTED': return c.evidence.reason;
  }
}

/** One proposal per line: label 15 · subject 23 · value 13 · class · reason · → action (widths of the fallback). */
function formatRow(row: ComparedProposal): string {
  const p = row.proposal.payload;
  const cls = row.comparison.cls;
  // TODO(luca): fallback/seg3/compare.txt puts the arrow one column further left on the class-A row than
  // on the B and C rows; reproduced here because the fallback is the acceptance target.
  const reasonWidth = cls === 'A' ? 40 : 41;
  return [
    (p.label ?? p.claimId.slice(0, 8)).padEnd(15),
    p.subjectKey.padEnd(23),
    shortValue(p.normalizedValue as NormalizedValue).padEnd(13),
    `${cls}  `,
    reason(row).padEnd(reasonWidth),
    `→ ${ACTION[cls]}`,
  ].join('');
}

await run('compare', () => {
  const batch = compareBatch();
  if (!batch) throw new Error('no agent proposals in the log (npm run extract:v9)');
  // The gate line is printed even when the gate does not apply: a rule that silently does not apply cannot be audited.
  const gate = batch.gate.kind === 'not-applicable'
    ? `batch gate: not applicable (golden set ${batch.gate.goldenItems} expected items < minimum ${batch.gate.minimum}, illustrative); ` +
      `class-A audit sampling ${Math.round(batch.auditRate * 100)} %`
    : `batch gate: ${batch.gate.kind} (FP ${batch.gate.counts.fp}, FN ${batch.gate.counts.fn}); class-A audit sampling ${Math.round(batch.auditRate * 100)} %`;
  process.stdout.write([
    `compare  batch=${batch.batchId}  proposals=${batch.proposals.length}  beliefs=${batch.beliefs}`,
    gate,
    ...batch.proposals.map(formatRow),
  ].join('\n') + '\n');
});
