// npm run ingest:v8 (ingest:v9) — DocumentVersionIngested for one version of art. 2477, checked against manifest.json.
import { config } from '../config';
import { contentHashOf, manifestEntry, readDocument } from '../acl/sourceToStructure';
import { deriveEventId } from '../events/eventId';
import { append, type AppendResult } from '../events/log';
import { argValue, run } from './cli';

export function ingestStep(version: string, path: string = config.paths.log): { fields: string[]; result: AppendResult } {
  const { lineageId, atto, article } = config.source;
  const documentId = lineageId;
  const text = readDocument(documentId, version);
  const entry = manifestEntry(documentId, version);
  const contentHash = contentHashOf(text);
  if (contentHash !== `sha256:${entry.contentHash16}` || text.length !== entry.chars) {
    throw new Error(`${documentId}-${version}.txt does not match manifest.json (${contentHash}, ${text.length} chars)`);
  }

  const aggregateId = `${documentId}@${version}`;
  const result = append(path, {
    eventId: deriveEventId({
      producer: 'process:ingest', inputArtifactId: contentHash, extractorVersion: null,
      eventType: 'DocumentVersionIngested', aggregateId,
    }),
    type: 'DocumentVersionIngested',
    layer: 'source',
    aggregateId,
    actor: { kind: 'process', id: 'ingest' },
    correlationId: `ingest-${version}`,
    payload: {
      lineageId, documentId, version, contentHash,
      effectiveFrom: entry.effectiveFrom,
      ...(entry.effectiveTo ? { effectiveTo: entry.effectiveTo } : {}),
      kind: 'consolidated-text',
      length: text.length,
      sourceReference: `Normattiva atto ${atto}, art. ${article}, art.versione ${entry.version}`,
    },
  });

  const fields = [
    `lineage=${lineageId}`, `documentId=${documentId}`, `version=${version}`, `hash=${contentHash.slice(0, 'sha256:'.length + 8)}…`,
    `effectiveFrom=${entry.effectiveFrom}`, ...(entry.effectiveTo ? [`effectiveTo=${entry.effectiveTo}`] : []), `length=${text.length}`,
  ];
  return { fields, result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('ingest', () => {
    const { fields } = ingestStep(argValue(process.argv.slice(2), 'version') ?? 'v8');
    process.stdout.write(`ingest  ${fields.join('  ')}\n`);
  });
}
