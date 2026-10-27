// Naive retrieval baseline for segment 1. Pure.
// "Embedding" here is NOT a neural model: it is a hashed bag of word and character-trigram features,
// weighted by TF-IDF computed over the indexed chunks, compared by cosine similarity.
// Scores are computed numbers, reproducible from the text alone. A chunk carries a text and an id.
// It has no field for edition, effective date or span: that absence is the point of segment 1.
import { hash16 } from '../domain/ids';

export const DIM = 1024;

export interface Chunk { chunkId: string; text: string }
export interface ScoredChunk extends Chunk { score: number }

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words = (s: string): string[] => stripAccents(s.toLowerCase()).split(/[^a-z0-9]+/).filter((w) => w.length > 0);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Feature strings of a text: each word, and every character trigram of each padded word. */
export function features(text: string): string[] {
  const out: string[] = [];
  for (const w of words(text)) {
    out.push(`w:${w}`);
    const p = `^${w}$`;
    for (let i = 0; i + 3 <= p.length; i++) out.push(`t:${p.slice(i, i + 3)}`);
  }
  return out;
}

/** Splits a document into one chunk per non-trivial line. chunkId depends on position, so equal lines in two editions stay distinct. */
export function chunkDocument(edition: string, text: string, minLength = 12): Chunk[] {
  const out: Chunk[] = [];
  text.split('\n').forEach((raw, i) => {
    const t = raw.trim();
    if (t.length >= minLength) out.push({ chunkId: hash16('chunk', edition, String(i), t), text: t });
  });
  return out;
}

function counts(text: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const f of features(text)) {
    const b = fnv1a(f) % DIM;
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

export function idf(chunks: readonly Chunk[]): Float64Array {
  const df = new Float64Array(DIM);
  for (const c of chunks) for (const b of counts(c.text).keys()) df[b]! += 1;
  const n = chunks.length;
  const out = new Float64Array(DIM);
  for (let b = 0; b < DIM; b++) out[b] = Math.log((1 + n) / (1 + df[b]!)) + 1;
  return out;
}

function vector(text: string, weights: Float64Array): Float64Array {
  const v = new Float64Array(DIM);
  for (const [b, c] of counts(text)) v[b] = (1 + Math.log(c)) * weights[b]!;
  let norm = 0;
  for (let b = 0; b < DIM; b++) norm += v[b]! * v[b]!;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let b = 0; b < DIM; b++) v[b]! /= norm;
  return v;
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/** Top `k` chunks whose cosine score is at least `minScore`, ties broken by chunkId. */
export function search(chunks: readonly Chunk[], query: string, k: number, minScore: number): ScoredChunk[] {
  if (chunks.length === 0) return [];
  const w = idf(chunks);
  const q = vector(query, w);
  const scored = chunks.map((c) => {
    const v = vector(c.text, w);
    let dot = 0;
    for (let b = 0; b < DIM; b++) dot += q[b]! * v[b]!;
    return { ...c, score: round4(dot) };
  });
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, k);
}
