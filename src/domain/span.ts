import type { DocumentId } from './ids';

// Half-open [start, end), absolute document coordinates (JavaScript string indices); never exists outside a Claim.
export interface Span {
  readonly documentId: DocumentId;
  readonly version: string;
  readonly start: number;                    // inclusive
  readonly end: number;                      // exclusive
}

/** Extractors return section-local spans; the Claims context adds the unit's base offset. */
export function toAbsolute(local: { start: number; end: number }, base: number, documentId: DocumentId, version: string): Span {
  return { documentId, version, start: local.start + base, end: local.end + base };
}

export function spanLength(span: Pick<Span, 'start' | 'end'>): number {
  return Math.max(0, span.end - span.start);
}

/** Intersection over union of two half-open intervals; 0 when they belong to different document versions. */
export function iou(a: Span, b: Span): number {
  if (a.documentId !== b.documentId || a.version !== b.version) return 0;
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = spanLength(a) + spanLength(b) - inter;
  return union === 0 ? 0 : inter / union;
}
