// Segment 1 baseline: a chunk index over both editions, with no version or date on the chunks.
// The index lives in the state directory (not the event log; nothing here is a claim).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentText, editionInfo, listEditions, loadRecording } from '../adapters/documents';
import { writeTextFile } from '../adapters/files';
import { stateDir } from '../adapters/paths';
import { MissingRecordingError, lookupRecording } from '../agents/replay';
import { config } from '../config';
import { chunkDocument, search, type Chunk } from '../rag/retriever';
import { oneShotInputHash, sectionText, type OneShotBlob } from '../rag/oneShot';
import { Rejection, UsageError } from './errors';

interface IndexFile {
  format: 'rag-index/1';
  chunks: Chunk[]; // what the retriever sees: id and text only
  ledger: Record<string, string>; // chunkId -> edition. Bookkeeping for deletion; never shown with a result.
}
const indexPath = () => join(stateDir(), 'rag-index.json');

function load(): IndexFile {
  if (existsSync(indexPath())) return JSON.parse(readFileSync(indexPath(), 'utf8')) as IndexFile;
  return buildIndex();
}
function save(i: IndexFile): void { writeTextFile(indexPath(), `${JSON.stringify(i, null, 1)}\n`); }

export function buildIndex(): IndexFile {
  const idx: IndexFile = { format: 'rag-index/1', chunks: [], ledger: {} };
  for (const edition of listEditions()) {
    const info = editionInfo(edition)!;
    for (const c of chunkDocument(edition, documentText(info.documentId))) {
      idx.chunks.push(c);
      idx.ledger[c.chunkId] = edition;
    }
  }
  save(idx);
  return idx;
}

const editionsIn = (i: IndexFile): string[] => [...new Set(Object.values(i.ledger))].sort();

export function ragQuery(q: string) {
  if (!q.trim()) throw new UsageError('missing --q');
  const i = load();
  const hits = search(i.chunks, q, config.rag.topK, config.rag.minScore);
  return {
    query: q,
    indexedChunks: i.chunks.length,
    minScore: config.rag.minScore,
    resultFields: ['rank', 'chunkId', 'score', 'text'], // no edition, no effective date, no span
    results: hits.map((h, n) => ({ rank: n + 1, chunkId: h.chunkId, score: h.score, text: h.text })),
  };
}

export function ragDelete(edition: string) {
  const i = load();
  if (!editionsIn(i).includes(edition)) throw new Rejection(`edition ${edition} is not in the index (indexed: ${editionsIn(i).join(', ') || 'none'})`);
  const gone = new Set(Object.entries(i.ledger).filter(([, e]) => e === edition).map(([id]) => id));
  const next: IndexFile = { ...i, chunks: i.chunks.filter((c) => !gone.has(c.chunkId)), ledger: Object.fromEntries(Object.entries(i.ledger).filter(([id]) => !gone.has(id))) };
  save(next);
  return { deletedEdition: edition, chunksRemoved: gone.size, chunksLeft: next.chunks.length };
}

export function ragExtract(sectionPath: string) {
  const i = load();
  const editions = editionsIn(i);
  const texts = editions.map((e) => sectionText(documentText(editionInfo(e)!.documentId), sectionPath));
  if (texts.every((t) => t === '')) throw new Rejection(`section ${sectionPath} not found in the indexed editions`);
  const rec = loadRecording<OneShotBlob>('oneshot@v1');
  try {
    const hit = lookupRecording(rec, oneShotInputHash(sectionPath, texts));
    return { extractor: rec.extractor, modelId: rec.modelId, promptVersion: rec.promptVersion, section: sectionPath, editionsInIndex: editions.length, blob: hit.output };
  } catch (e) {
    if (e instanceof MissingRecordingError) throw new Rejection(e.message);
    throw e;
  }
}
