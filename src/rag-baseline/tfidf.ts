// TF-IDF stands in for the embedding model: deterministic, offline, computed at index time.
// tf = 1 + ln(count) (sublinear); idf = ln((1 + N) / (1 + df)) + 1 over the N chunks currently indexed;
// vectors are L2-normalised, so the dot product of two vectors is their cosine similarity.

export type SparseVector = Record<string, number>;

const STOPWORDS = new Set(
  ('il lo la i gli le un uno una di a da in con su per tra fra e o ed è del dello della dei degli delle al allo alla ai agli alle ' +
    'dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle che non se si cui l d un\' all ' +
    'dell nell sull anche quando ha').split(' '),
);

/** Lower-cased, apostrophe → space, runs of [a-zàèéìòù0-9], minus Italian stopwords: "dell'organo" → ["organo"]. */
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().replaceAll("'", ' ').match(/[a-zàèéìòù0-9]+/g) ?? [];
  return words.filter((w) => !STOPWORDS.has(w));
}

export function inverseDocumentFrequency(documents: readonly string[][]): SparseVector {
  const df = new Map<string, number>();
  for (const tokens of documents) for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = documents.length;
  const idf: SparseVector = {};
  for (const term of [...df.keys()].sort()) idf[term] = Math.log((1 + n) / (1 + df.get(term)!)) + 1;
  return idf;
}

/** Terms absent from the vocabulary (e.g. a query word no chunk contains) get no dimension. */
export function vectorize(tokens: readonly string[], idf: SparseVector): SparseVector {
  const tf = new Map<string, number>();
  for (const t of tokens) if (t in idf) tf.set(t, (tf.get(t) ?? 0) + 1);
  const weights = [...tf.keys()].sort().map((t) => [t, (1 + Math.log(tf.get(t)!)) * idf[t]!] as const);
  const norm = Math.sqrt(weights.reduce((s, [, w]) => s + w * w, 0)) || 1;
  const vector: SparseVector = {};
  for (const [t, w] of weights) vector[t] = w / norm;
  return vector;
}

export function cosine(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  for (const t in a) if (t in b) dot += a[t]! * b[t]!;
  return dot;
}
