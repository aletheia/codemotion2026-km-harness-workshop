// Source → Structure ACL (04-domain-model-reference.md §2): accepts DocumentVersionIngested and hands the
// Structure context (document id, version, text). The text is read from fixtures/documents/ and checked
// against the content hash the ingestion recorded, so the structure extractor never reads a different text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { sha256_16 } from '../domain/hash';
import type { LogEvent } from '../events/schema';

export interface ManifestNode {
  readonly path: string;
  readonly type: 'comma' | 'note' | 'index';
  readonly start: number;
  readonly end: number;
}

export interface ManifestEntry {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly act: string;
  readonly chars: number;
  readonly contentHash16: string;
  readonly tree: readonly ManifestNode[];
}

export const documentFile = (documentId: string, version: string): string => `${documentId}-${version}.txt`;

export function manifestEntry(documentId: string, version: string, dir: string = config.paths.documents): ManifestEntry {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Record<string, ManifestEntry>;
  const entry = manifest[documentFile(documentId, version)];
  if (!entry) throw new Error(`no ${documentFile(documentId, version)} in manifest.json`);
  return entry;
}

export const readDocument = (documentId: string, version: string, dir: string = config.paths.documents): string =>
  readFileSync(join(dir, documentFile(documentId, version)), 'utf8');

/** The recorded form of a content hash: 'sha256:' + 16 hex. */
export const contentHashOf = (text: string): string => `sha256:${sha256_16(text)}`;

export interface StructureInput {
  readonly documentId: string;
  readonly version: string;
  readonly text: string;
  readonly causationId: string;
}

export function sourceToStructure(ingested: LogEvent, dir: string = config.paths.documents): StructureInput {
  if (ingested.type !== 'DocumentVersionIngested') throw new Error(`Source → Structure accepts DocumentVersionIngested, got ${ingested.type}`);
  const { documentId, version, contentHash } = ingested.payload;
  const text = readDocument(documentId, version, dir);
  if (contentHashOf(text) !== contentHash) throw new Error(`${documentFile(documentId, version)} changed since ingestion (${contentHash})`);
  return { documentId, version, text, causationId: ingested.eventId };
}
