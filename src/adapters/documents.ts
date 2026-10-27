// Fixture loaders: documents, recorded extractor responses, scripts. Read-only.
import { existsSync, readFileSync } from 'node:fs';
import { hash16 } from '../domain/ids';
import { repoPath } from './paths';
import type { RecordingFile } from '../agents/replay';

export interface EditionInfo { edition: string; documentId: string; file: string; effectiveFrom: string }
interface Manifest {
  lineageId: string;
  editions: Record<string, { documentId: string; file: string; effectiveFrom: string }>;
}

export const readJson = <T>(rel: string): T => JSON.parse(readFileSync(repoPath(rel), 'utf8')) as T;
export const loadManifest = (): Manifest => readJson<Manifest>('fixtures/documents/manifest.json');

export function editionInfo(edition: string): EditionInfo | undefined {
  const m = loadManifest().editions[edition];
  return m ? { edition, ...m } : undefined;
}
export function editionByDocumentId(documentId: string): EditionInfo | undefined {
  const m = loadManifest();
  for (const [edition, e] of Object.entries(m.editions)) if (e.documentId === documentId) return { edition, ...e };
  return undefined;
}
export const listEditions = (): string[] => Object.keys(loadManifest().editions);

export function documentText(documentId: string): string {
  const info = editionByDocumentId(documentId);
  if (!info) throw new Error(`unknown document ${documentId}`);
  return readFileSync(repoPath('fixtures/documents', info.file), 'utf8');
}
export const contentHash = (text: string): string => hash16('content', text);

export function loadRecording<O>(extractor: string): RecordingFile<O> {
  const rel = `fixtures/llm/${extractor}.json`;
  if (!existsSync(repoPath(rel))) throw new Error(`no recordings for extractor ${extractor} (expected ${rel})`);
  return readJson<RecordingFile<O>>(rel);
}
