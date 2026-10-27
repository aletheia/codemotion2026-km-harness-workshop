import { config } from '../config';
import { diffDocument, extractorsFor, type DiffRow } from '../projections/diff';
import { beliefsHash, currentBeliefs } from '../projections/views';
import { loadFold } from './context';
import { Rejection } from './errors';
import { currentExtractor } from './extractors';

export function projectionsDiff(opts: { from?: string; to?: string; doc?: string }) {
  const f = loadFold();
  const from = opts.from ?? currentExtractor(f);
  const docs = [...f.docs.values()].sort((a, b) => a.seq - b.seq).map((d) => d.documentId).filter((d) => !opts.doc || d === opts.doc);
  if (docs.length === 0) throw new Rejection(opts.doc ? `document ${opts.doc} is not ingested` : 'no document ingested yet');
  const candidates = [...new Set(docs.flatMap((d) => extractorsFor(f, d)))].filter((x) => x !== from);
  const to = opts.to ?? candidates[candidates.length - 1];
  if (!to) throw new Rejection(`no candidate extractor version has proposed anything yet (promoted: ${from}); run: npm run replay -- --extractor claims@v2`);
  const documents = docs.map((documentId) => ({ documentId, sectionPath: config.sectionPath, rows: diffDocument(f, documentId, from, to) }));
  const promoted = f.promotions.filter((p) => p.extractor === 'claims').map((p) => p.version);
  return {
    promoted: currentExtractor(f), from, to, toIsPromoted: promoted.includes(to), documents,
    currentBeliefs: currentBeliefs(f).size, beliefsHash: beliefsHash(f),
  };
}
export type DiffResult = ReturnType<typeof projectionsDiff>;

const cell = (cs: DiffRow['from']): string => (cs.length ? cs.map((c) => `${c.valueText} [${c.start},${c.end})`).join(' / ') : '-');

export function renderDiff(r: DiffResult): string {
  const out: string[] = [`${r.from}${r.from === r.promoted ? ' (promoted)' : ''}  vs  ${r.to}${r.toIsPromoted ? ' (promoted)' : ' (candidate)'}`];
  for (const d of r.documents) {
    out.push('', `${d.documentId} ${d.sectionPath}: proposals by extractor version (absolute spans)`);
    const w1 = Math.max(18, ...d.rows.map((x) => cell(x.from).length));
    const w2 = Math.max(18, ...d.rows.map((x) => cell(x.to).length));
    out.push(`  ${'subject'.padEnd(20)} ${r.from.padEnd(w1)}  ${r.to.padEnd(w2)}  difference`);
    for (const x of d.rows) out.push(`  ${x.subjectKey.padEnd(20)} ${cell(x.from).padEnd(w1)}  ${cell(x.to).padEnd(w2)}  ${x.status}`);
  }
  out.push('', `CurrentBeliefs: ${r.currentBeliefs} beliefs, hash ${r.beliefsHash}; it is built from verified claims only, so ${r.to} changes it only after ExtractorVersionPromoted.`);
  return out.join('\n');
}
