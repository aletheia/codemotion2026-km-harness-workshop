// Replay of the Claims layer with another extractor version: every StructureVerified in the log is fed
// again through the ACL to that version, on the same units the promoted extractor extracted (v8: c2;
// v9: c2, c3, c5). Nothing in the log is modified: the new ClaimProposed events have their own eventIds
// (the extractor version is part of the id), so they are appended next to the old ones, attributable to
// the new version; replaying the same version twice appends nothing.
import { config } from '../config';
import { readLog, type AppendResult } from '../events/log';
import { ofType, promotedVersion, proposedTree } from '../events/lookup';
import { extractClaimsStep } from '../tools/extract-claims';

export interface ReplayInput {
  readonly verifiedEventId: string;
  readonly version: string;
  readonly sections: readonly string[];
  readonly results: readonly AppendResult[];
}

export function replayClaims(extractorVersion: string, path: string = config.paths.log): { promoted: boolean; inputs: ReplayInput[] } {
  const events = readLog(path);
  const promoted = promotedVersion(events, 'claims');
  const promotedProposals = ofType(events, 'ClaimProposed').filter((e) => e.actor.kind === 'agent' && e.actor.extractorVersion === promoted);

  const inputs: ReplayInput[] = [];
  for (const verified of ofType(events, 'StructureVerified')) {
    const tree = proposedTree(events, verified.payload.treeId);
    if (!tree) continue;
    // The units the promoted extractor read from this tree, in tree order.
    const extracted = new Set(promotedProposals.filter((p) => p.causationId === verified.eventId).map((p) => p.payload.sectionPath));
    const sections = tree.payload.nodes.map((n) => n.path).filter((p) => extracted.has(p));
    if (sections.length === 0) continue;
    const version = tree.payload.version;
    const step = extractClaimsStep(version, sections, { extractorVersion, path, correlationId: `replay-${extractorVersion}-${version}-01` });
    inputs.push({ verifiedEventId: verified.eventId, version, sections, results: step.results });
  }
  return { promoted: extractorVersion === promoted, inputs };
}
