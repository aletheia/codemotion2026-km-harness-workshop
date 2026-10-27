// Read-side helpers over a log slice: the few lookups the scripts need, all pure.
import type { LogEvent } from './schema';

type Of<T extends LogEvent['type']> = Extract<LogEvent, { type: T }>;

export const ofType = <T extends LogEvent['type']>(events: readonly LogEvent[], type: T): Of<T>[] =>
  events.filter((e): e is Of<T> => e.type === type);

export const ingestedVersion = (events: readonly LogEvent[], documentId: string, version: string): Of<'DocumentVersionIngested'> | undefined =>
  ofType(events, 'DocumentVersionIngested').find((e) => e.payload.documentId === documentId && e.payload.version === version);

export const proposedTree = (events: readonly LogEvent[], treeId: string): Of<'StructureProposed'> | undefined =>
  ofType(events, 'StructureProposed').find((e) => e.payload.treeId === treeId);

export const verifiedTree = (events: readonly LogEvent[], treeId: string): Of<'StructureVerified'> | undefined =>
  ofType(events, 'StructureVerified').find((e) => e.payload.treeId === treeId);

/** The promoted version of an extractor: the last ExtractorVersionPromoted for it. */
export const promotedVersion = (events: readonly LogEvent[], extractor: string): string | undefined =>
  ofType(events, 'ExtractorVersionPromoted').filter((e) => e.payload.extractor === extractor).at(-1)?.payload.version;

/** Claim id → display label, from the first ClaimProposed of each claim that carries one. */
export function claimLabels(events: readonly LogEvent[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (const e of ofType(events, 'ClaimProposed')) if (e.payload.label && !labels.has(e.payload.claimId)) labels.set(e.payload.claimId, e.payload.label);
  return labels;
}

/** Claim id → its first ClaimProposed: the proposal that defines label, spans and section of the claim. */
export function firstProposals(events: readonly LogEvent[]): ReadonlyMap<string, Of<'ClaimProposed'>> {
  const first = new Map<string, Of<'ClaimProposed'>>();
  for (const e of ofType(events, 'ClaimProposed')) if (!first.has(e.payload.claimId)) first.set(e.payload.claimId, e);
  return first;
}

export const treeIdOf = (version: string): string => `tree-${version}`;
