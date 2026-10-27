import { buildEvent } from '../events/build';
import { documentText, loadRecording } from '../adapters/documents';
import { lookupRecording, structureInputHash, type StructureOut, MissingRecordingError } from '../agents/replay';
import { commit } from './commit';
import { Rejection, UsageError } from './errors';
import { loadFold, requireInitialised } from './context';
import { agentActor, humanActor } from './actors';
import { asEventId } from '../domain/ids';
import type { Fold, TreeRec } from '../projections/fold';

export const treeIdOf = (documentId: string) => `tree-${documentId}`;

export function extractStructure(documentId: string) {
  const f = loadFold();
  requireInitialised(f);
  const doc = f.docs.get(documentId);
  if (!doc) throw new Rejection(`document ${documentId} is not ingested`);
  if (f.trees.has(treeIdOf(documentId))) throw new Rejection(`structure of ${documentId} was already proposed`);
  const rec = loadRecording<StructureOut>('structure@v1');
  let hit;
  try {
    hit = lookupRecording(rec, structureInputHash(documentId, doc.version, documentText(documentId)));
  } catch (e) {
    if (e instanceof MissingRecordingError) throw new Rejection(e.message);
    throw e;
  }
  const draft = buildEvent({
    type: 'StructureProposed', aggregateId: treeIdOf(documentId), actor: agentActor(rec.extractor, rec.modelId, rec.promptVersion),
    inputArtifactId: doc.eventId, causationId: asEventId(doc.eventId), correlationId: `structure-${doc.version}`,
    payload: { treeId: treeIdOf(documentId), documentId: doc.documentId as never, version: doc.version, nodes: hit.output.nodes },
  });
  const [r] = commit([draft]);
  return { treeId: treeIdOf(documentId), nodes: hit.output.nodes.length, event: r, extractor: rec.extractor };
}

export function treeSummary(t: TreeRec) {
  const count = (type: string) => t.nodes.filter((n) => n.type === type).length;
  return { treeId: t.treeId, documentId: t.documentId, version: t.version, articles: count('article'), index: count('index'), notes: count('note'), verified: Boolean(t.verifiedEventId) };
}

export function verifyStructure(documentId: string, note: string) {
  const f: Fold = loadFold();
  const t = f.trees.get(treeIdOf(documentId));
  if (!t) throw new UsageError(`no structure proposed for ${documentId}`);
  if (t.verifiedEventId) throw new Rejection(`structure of ${documentId} is already verified`);
  const draft = buildEvent({
    type: 'StructureVerified', aggregateId: t.treeId, actor: humanActor(), inputArtifactId: t.proposedEventId,
    causationId: t.proposedEventId, correlationId: `review-structure-${t.version}`,
    payload: { treeId: t.treeId, documentId: t.documentId as never, version: t.version },
    evidence: { kind: 'human', note },
  });
  const [r] = commit([draft]);
  return { treeId: t.treeId, event: r };
}
