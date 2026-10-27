import type { Fold } from '../projections/fold';

/** The promoted claims extractor version: the latest ExtractorVersionPromoted in the log. */
export function currentExtractor(f: Fold): string {
  const p = [...f.promotions].reverse().find((x) => x.extractor === 'claims');
  if (!p) throw new Error('no claims extractor promoted yet: run `npm run seg2 -- log-init`');
  return p.version;
}
