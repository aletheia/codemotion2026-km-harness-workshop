// Provenance rule: a quote must appear verbatim in the source text, inside the cited span.
// Pure function. The check is ENFORCED where events are written (src/app/propose.ts).
import type { Span } from './span';

export type ProvenanceResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function checkProvenance(documentText: string, span: Span, quote: string): ProvenanceResult {
  if (quote.trim().length === 0) return { ok: false, reason: 'empty quote' };
  if (!(span.start >= 0 && span.end > span.start && span.end <= documentText.length)) {
    return { ok: false, reason: `span [${span.start},${span.end}) is outside the document (length ${documentText.length})` };
  }
  if (!documentText.includes(quote)) {
    return { ok: false, reason: `quote not found verbatim in source document: "${abbreviate(quote)}"` };
  }
  const spanText = documentText.slice(span.start, span.end);
  if (!spanText.includes(quote)) {
    return { ok: false, reason: `quote is in the document but not inside span [${span.start},${span.end}): "${abbreviate(quote)}"` };
  }
  return { ok: true };
}

const abbreviate = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
