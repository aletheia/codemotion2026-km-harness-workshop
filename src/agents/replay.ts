// Deterministic extractor "agents": recorded responses keyed by (extractor, input hash).
// Pure: this module cannot construct decision events (see test/agents-no-decisions.test.ts).
// If no recording exists for the input, it fails loudly instead of inventing output.
import { hash16 } from '../domain/ids';

export interface RecordedResponse<O> {
  inputHash: string;
  note?: string;
  output: O;
}
export interface RecordingFile<O> {
  extractor: string; // e.g. "claims@v1"
  modelId: string; // "fixture-replay": there is no model behind these responses
  promptVersion: string;
  /** Golden item ids that appear as examples in this extractor's prompt: subtracted from its probes and evals. */
  promptExampleIds?: string[];
  responses: RecordedResponse<O>[];
}

export class MissingRecordingError extends Error {}

export function lookupRecording<O>(file: RecordingFile<O>, inputHash: string): RecordedResponse<O> {
  const hit = file.responses.find((r) => r.inputHash === inputHash);
  if (!hit) throw new MissingRecordingError(`no recorded response for ${file.extractor} on input ${inputHash} (fixtures/llm); refusing to invent one`);
  return hit;
}

export const claimsInputHash = (documentId: string, version: string, sectionPath: string, text: string) =>
  hash16('claims-input', documentId, version, sectionPath, text);
export const structureInputHash = (documentId: string, version: string, text: string) =>
  hash16('structure-input', documentId, version, text);

export interface ClaimDraftOut {
  subjectKey: string;
  valueText: string;
  quote: string;
  span: { start: number; end: number }; // section-local, as an extractor sees it
}
export interface StructureOut { nodes: { path: string; type: 'article' | 'index' | 'note'; title: string; start: number; end: number }[] }
