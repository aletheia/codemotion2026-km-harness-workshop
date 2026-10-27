// Span: half-open [start, end) in ABSOLUTE document coordinates. Never exists outside a Claim.
import type { DocumentId } from './ids';

export interface Span {
  readonly documentId: DocumentId;
  readonly version: string;
  readonly start: number; // inclusive
  readonly end: number; // exclusive
}

/** Section-local interval, produced by an extractor; exists only transiently in the Claims context. */
export interface LocalSpan {
  readonly start: number;
  readonly end: number;
}

export function localToAbsolute(local: LocalSpan, baseOffset: number, documentId: DocumentId, version: string): Span {
  return { documentId, version, start: local.start + baseOffset, end: local.end + baseOffset };
}

export function absoluteToLocal(span: { start: number; end: number }, baseOffset: number): LocalSpan {
  return { start: span.start - baseOffset, end: span.end - baseOffset };
}

export function length(s: { start: number; end: number }): number {
  return s.end - s.start;
}

/** Intersection over union of half-open intervals; 0 when documents/versions differ. */
export function iou(a: Span, b: Span): number {
  if (a.documentId !== b.documentId || a.version !== b.version) return 0;
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = length(a) + length(b) - inter;
  return union <= 0 ? 0 : inter / union;
}

export const fmtSpan = (s: { start: number; end: number }): string => `[${s.start},${s.end})`;
