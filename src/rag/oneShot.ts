// The one-shot extraction of segment 1: one call, one blob, no structure, no provenance, no versions. Pure.
import { hash16 } from '../domain/ids';

/** Body of the article `artN` (the second heading line "Art. N - ..." up to the next article or the note). Empty if absent. */
export function sectionText(documentText: string, sectionPath: string): string {
  const m = /^art(\d+)$/.exec(sectionPath);
  if (!m) return '';
  const lines = documentText.split('\n');
  const heading = new RegExp(`^Art\\. ${m[1]} - `);
  const idx = lines.map((l, i) => (heading.test(l) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return '';
  const start = idx[idx.length - 1]!; // the first match is the index entry
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^Art\. \d+ - /.test(lines[i]!) || /^Nota informativa/.test(lines[i]!)) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

export const oneShotInputHash = (sectionPath: string, texts: readonly string[]): string => hash16('oneshot-input', sectionPath, ...texts);

export interface OneShotBlob { articolo: string; titolo: string; voci: { copertura: string; tipo: string; valore: string }[] }
