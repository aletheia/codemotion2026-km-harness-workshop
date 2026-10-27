// The retrieval baseline's index: one JSON file under out/rag/. A chunk carries id, source_file, text and
// vector — no version, no validity period, no assertion. Deletion is the only way to retire a text.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config';
import { chunkParagraphs, type Chunk } from './chunk';
import { cosine, inverseDocumentFrequency, tokenize, vectorize, type SparseVector } from './tfidf';

export interface IndexedChunk extends Chunk {
  vector: SparseVector;
}

export interface RagIndex {
  name: string;
  idf: SparseVector;
  chunks: IndexedChunk[];
  /** Versions removed with deleteVersion, in order. */
  deleted: string[];
}

export interface Hit {
  score: number;
  chunk: IndexedChunk;
}

/** idf and vectors are computed over exactly the chunks given, in the order given (file, then paragraph). */
export function indexChunks(chunks: readonly Chunk[], name: string = config.rag.indexName, deleted: string[] = []): RagIndex {
  const tokens = chunks.map((c) => tokenize(c.text));
  const idf = inverseDocumentFrequency(tokens);
  return { name, idf, deleted, chunks: chunks.map(({ id, source_file, text }, i) => ({ id, source_file, text, vector: vectorize(tokens[i]!, idf) })) };
}

export function buildIndex(files: readonly { name: string; text: string }[], name: string = config.rag.indexName): RagIndex {
  return indexChunks(files.flatMap((f) => chunkParagraphs(f.name, f.text)), name);
}

/**
 * Cosine against the query vectorised with the index's idf. Ties (scores equal to 12 decimals) are broken
 * by index order, which is version, then paragraph number.
 */
export function query(index: RagIndex, q: string, topK: number): Hit[] {
  const qv = vectorize(tokenize(q), index.idf);
  const rounded = (x: number) => Math.round(x * 1e12);
  return index.chunks
    .map((chunk, i) => ({ score: cosine(qv, chunk.vector), chunk, i }))
    .sort((a, b) => rounded(b.score) - rounded(a.score) || a.i - b.i)
    .slice(0, topK)
    .map(({ score, chunk }) => ({ score, chunk }));
}

/** Removes every chunk of one source file version and re-embeds the rest: idf follows the chunks left. */
export function deleteVersion(index: RagIndex, version: string): { index: RagIndex; removed: number } {
  const kept = index.chunks.filter((c) => !c.source_file.endsWith(`-${version}.txt`));
  return { index: indexChunks(kept, index.name, [...index.deleted, version]), removed: index.chunks.length - kept.length };
}

export function readSourceFiles(dir = config.rag.sourceDir, files = config.rag.sourceFiles): { name: string; text: string }[] {
  return files.map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
}

export function saveIndex(index: RagIndex, path = config.paths.ragIndex): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(index, null, 1) + '\n');
}

export function loadIndex(path = config.paths.ragIndex): RagIndex {
  if (!existsSync(path)) throw new Error(`no index at ${path}: run npm run rag:index first`);
  return JSON.parse(readFileSync(path, 'utf8')) as RagIndex;
}
