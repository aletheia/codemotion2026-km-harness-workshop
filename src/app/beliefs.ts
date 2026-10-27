// beliefs: CurrentBeliefs, or the beliefs about the edition in force on a date.
//   --at DATE  is VALID time (which edition applied on DATE, from its effective date)
//   --seq N    is TRANSACTION time (fold the log only up to event N)
import { editionInForce, beliefJson, beliefsAtDate, currentBeliefs } from '../projections/views';
import { config } from '../config';
import { loadFold } from './context';
import { UsageError } from './errors';

export function queryBeliefs(opts: { at?: string; seq?: number }) {
  if (opts.at !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opts.at)) throw new UsageError(`--at expects YYYY-MM-DD, got "${opts.at}"`);
  if (opts.seq !== undefined && (!Number.isInteger(opts.seq) || opts.seq < 1)) throw new UsageError('--seq expects a positive event number');
  const f = loadFold(opts.seq !== undefined ? { untilSeq: opts.seq } : {});
  const base = { transactionTime: { throughSeq: f.lastSeq }, timeAxis: opts.at ? 'valid' : 'current' };
  if (opts.at) {
    const r = beliefsAtDate(f, config.lineageId, opts.at);
    const doc = r.documentId ? f.docs.get(r.documentId) : undefined;
    return {
      ...base, at: opts.at, documentId: r.documentId ?? null, edition: doc?.version ?? null, effectiveFrom: doc?.effectiveFrom ?? null,
      beliefs: r.beliefs.map((b) => ({ ...beliefJson(b), stateNow: b.rec.state, asOf: 'verified' })),
    };
  }
  const beliefs = [...currentBeliefs(f).values()].map(beliefJson).sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  return { ...base, at: null, documentId: null, edition: editionInForce(f, config.lineageId, '9999-12-31') ?? null, effectiveFrom: null, beliefs };
}

export type BeliefsResult = ReturnType<typeof queryBeliefs>;

export function renderBeliefs(r: BeliefsResult): string {
  const head = r.at
    ? `beliefs on ${r.at} (valid time): edition ${r.documentId ?? 'none'}${r.effectiveFrom ? ` in force from ${r.effectiveFrom}` : ''}; log read through seq ${r.transactionTime.throughSeq}`
    : `CurrentBeliefs (log read through seq ${r.transactionTime.throughSeq})`;
  if (r.beliefs.length === 0) return `${head}\n  (none)`;
  const rows = r.beliefs.map((b) => `  ${b.subjectKey.padEnd(22)} ${b.value.padEnd(14)} ${b.document.padEnd(12)} [${b.span.start},${b.span.end})  verified by ${b.verifiedBy} (seq ${b.verifiedSeq}, root ${b.root})`);
  return [head, ...rows].join('\n');
}
