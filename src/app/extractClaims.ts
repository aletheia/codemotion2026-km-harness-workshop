// "Run the claims extractor" = replay the recorded response for this unit (no model is called).
import { loadRecording } from '../adapters/documents';
import { claimsInputHash, lookupRecording, MissingRecordingError, type ClaimDraftOut } from '../agents/replay';
import { loadFold } from './context';
import { Rejection } from './errors';
import { agentActor } from './actors';
import { proposeClaims, unitFor } from './propose';
import { currentExtractor } from './extractors';


export function extractClaims(documentId: string, sectionPath: string, extractor?: string) {
  const f = loadFold();
  const version = extractor ?? currentExtractor(f);
  const unit = unitFor(f, documentId, sectionPath, { recordRejection: true });
  const rec = loadRecording<{ claims: ClaimDraftOut[] }>(version);
  let hit;
  try {
    hit = lookupRecording(rec, claimsInputHash(unit.documentId, unit.version, unit.sectionPath, unit.text));
  } catch (e) {
    if (e instanceof MissingRecordingError) throw new Rejection(e.message);
    throw e;
  }
  const actor = agentActor(rec.extractor, rec.modelId, rec.promptVersion);
  const res = proposeClaims(unit, actor, hit.output.claims.map((c) => ({ subjectKey: c.subjectKey, valueText: c.valueText, quote: c.quote, span: c.span })));
  return { extractor: rec.extractor, ...res };
}
