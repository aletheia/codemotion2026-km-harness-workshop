// "Replay with another extractor version": re-run the recorded responses of `extractor` over every ingested
// document whose structure is verified. Appends ClaimProposed events only; nothing in the log changes.
import { config } from '../config';
import { beliefsHash } from '../projections/views';
import { extractClaims } from './extractClaims';
import { loadFold } from './context';
import { Rejection } from './errors';

export function replayWithExtractor(extractor: string, section: string = config.sectionPath) {
  const before = loadFold();
  const docs = [...before.docs.values()].sort((a, b) => a.seq - b.seq);
  if (docs.length === 0) throw new Rejection('no document ingested yet');
  const hashBefore = beliefsHash(before);
  const results = docs.map((d) => {
    const r = extractClaims(d.documentId, section, extractor);
    return { documentId: d.documentId, extractor: r.extractor, proposed: r.proposed };
  });
  const after = loadFold();
  const newClaims = [...after.claims.keys()].filter((id) => !before.claims.has(id)).length;
  const hashAfter = beliefsHash(after);
  const earlierLinesUnchanged = before.events.every((e, i) => JSON.stringify(e) === JSON.stringify(after.events[i]));
  return {
    extractor, appended: after.events.length - before.events.length, linesBefore: before.events.length, linesAfter: after.events.length,
    perDocument: results.map((r) => ({ documentId: r.documentId, proposals: r.proposed.length, deduplicated: r.proposed.filter((p) => p.deduplicated).length })),
    newClaims, beliefsHashBefore: hashBefore, beliefsHashAfter: hashAfter, currentBeliefsUnchanged: hashBefore === hashAfter, earlierLinesUnchanged,
  };
}
