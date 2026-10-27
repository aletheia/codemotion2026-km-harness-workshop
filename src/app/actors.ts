import { config } from '../config';
import type { Actor } from '../events/types';

export const processActor = (id: string): Actor => ({ kind: 'process', id });
export const humanActor = (id: string = config.humanReviewerId): Actor => ({ kind: 'human', id });
export const harnessActor: Actor = { kind: 'harness', id: 'comparator', version: 'cmp1' };
export const agentActor = (extractorVersion: string, modelId: string, promptVersion: string): Actor => ({
  kind: 'agent', id: extractorVersion.split('@')[0] === 'structure' ? 'structure-extractor' : 'claims-extractor',
  extractorVersion, modelId, promptVersion,
});
