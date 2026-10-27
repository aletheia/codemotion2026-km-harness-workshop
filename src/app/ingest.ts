import { buildEvent } from '../events/build';
import { config } from '../config';
import { contentHash, documentText, editionInfo, listEditions } from '../adapters/documents';
import { asDocumentId, asLineageId } from '../domain/ids';
import { commit } from './commit';
import { Rejection, UsageError } from './errors';
import { loadFold, requireInitialised } from './context';
import { processActor } from './actors';

export function ingest(edition: string) {
  const info = editionInfo(edition);
  if (!info) throw new UsageError(`unknown edition "${edition}" (available: ${listEditions().join(', ')})`);
  const f = loadFold();
  requireInitialised(f);
  const text = documentText(info.documentId);
  const hash = contentHash(text);
  for (const d of f.docs.values()) {
    if (d.documentId !== info.documentId && d.lineageId === config.lineageId && d.contentHash === hash) {
      throw new Rejection(`identical content already ingested as ${d.documentId}`);
    }
  }
  const draft = buildEvent({
    type: 'DocumentVersionIngested', aggregateId: `doc:${info.documentId}`, actor: processActor('ingest'), inputArtifactId: hash,
    causationId: null, correlationId: `ingest-${edition}`,
    payload: {
      documentId: asDocumentId(info.documentId), lineageId: asLineageId(config.lineageId), version: edition,
      effectiveFrom: info.effectiveFrom, contentHash: hash, length: text.length, source: `fixtures/documents/${info.file}`,
    },
  });
  const [r] = commit([draft]);
  return { documentId: info.documentId, version: edition, effectiveFrom: info.effectiveFrom, length: text.length, contentHash: hash, event: r };
}
