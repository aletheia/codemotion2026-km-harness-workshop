// npm run extract:claims-v8 — the Claims context on a verified tree: ACL → units → extractor (fixture replay)
// → normalize, anchor, label → ClaimProposed. The extractor version defaults to the promoted one.
import { config } from '../config';
import { anchor, structureToClaims, type ClaimsUnit } from '../acl/structureToClaims';
import { sourceToStructure } from '../acl/sourceToStructure';
import { CLAIMS, extractClaims } from '../agents/claims';
import { claimLabel } from '../catalog/labels';
import { normalize } from '../catalog/normalizer';
import { lookupSubject } from '../catalog/subjects';
import { deriveClaimId, type SubjectKey } from '../domain/claim';
import { documentId as asDocumentId, lineageId as asLineageId } from '../domain/ids';
import { deriveEventId } from '../events/eventId';
import { append, readLog, type AppendResult } from '../events/log';
import { ingestedVersion, promotedVersion, proposedTree, treeIdOf, verifiedTree } from '../events/lookup';
import { argValue, run } from './cli';

export class ExtractionRejected extends Error {
  constructor(readonly missingFields: readonly string[]) {
    super(`ACLRejected: malformed tree (${missingFields.join(', ')})`);
    this.name = 'ExtractionRejected';
  }
}

export interface ClaimsStep {
  readonly extractorVersion: string;
  readonly promoted: boolean;
  readonly units: readonly ClaimsUnit[];
  readonly results: readonly AppendResult[];
}

export function extractClaimsStep(
  version: string,
  sections: readonly string[],
  opts: { extractorVersion?: string; path?: string; correlationId?: string } = {},
): ClaimsStep {
  const path = opts.path ?? config.paths.log;
  const events = readLog(path);
  const promotedNow = promotedVersion(events, CLAIMS.extractor);
  const extractorVersion = opts.extractorVersion ?? promotedNow;
  if (!extractorVersion) throw new Error('no promoted claims extractor (npm run log:init)');

  const treeId = treeIdOf(version);
  const verified = verifiedTree(events, treeId);
  const tree = proposedTree(events, treeId);
  if (!verified || !tree) throw new Error(`${treeId} is not verified (npm run review)`);
  const ingested = ingestedVersion(events, tree.payload.documentId, version);
  if (!ingested) throw new Error(`${tree.payload.documentId}@${version} not ingested`);

  const correlationId = opts.correlationId ?? `run-${version}-${sections.join('-')}-01`;
  const { text } = sourceToStructure(ingested);
  const acl = structureToClaims(verified, tree.payload, text, { sections, correlationId });
  if (acl.rejected) {
    append(path, acl.rejected);
    throw new ExtractionRejected(acl.rejected.type === 'ACLRejected' ? acl.rejected.payload.missingFields : []);
  }

  const results: AppendResult[] = [];
  for (const unit of acl.units) {
    const fixture = extractClaims(unit, extractorVersion);
    const actor = { kind: 'agent', id: CLAIMS.actorId, modelId: fixture.modelId, promptVersion: fixture.promptVersion, extractorVersion } as const;
    for (const item of fixture.response.claims) {
      const subjectKey = item.subjectKey as SubjectKey;
      const normalizedValue = normalize(item.value, lookupSubject(subjectKey));
      const claimId = deriveClaimId(asDocumentId(unit.documentId), unit.version, subjectKey, normalizedValue);
      results.push(append(path, {
        eventId: deriveEventId({
          producer: `agent:${CLAIMS.actorId}`, inputArtifactId: unit.causationId, extractorVersion,
          eventType: 'ClaimProposed', aggregateId: claimId,
        }),
        type: 'ClaimProposed',
        layer: 'claims',
        aggregateId: claimId,
        actor,
        causationId: unit.causationId,
        correlationId,
        payload: {
          claimId,
          label: claimLabel(extractorVersion, unit.version, subjectKey, normalizedValue, claimId),
          lineageId: asLineageId(ingested.payload.lineageId),
          subjectKey,
          normalizedValue,
          spans: [anchor(unit, item.span)],
          sectionPath: unit.path,
        },
      }));
    }
  }
  return { extractorVersion, promoted: extractorVersion === promotedNow, units: acl.units, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('extract-claims', () => {
    const argv = process.argv.slice(2);
    const version = argValue(argv, 'version') ?? 'v8';
    const sections = (argValue(argv, 'section') ?? 'c2').split(',');
    const step = extractClaimsStep(version, sections, { extractorVersion: argValue(argv, 'extractor') });
    const units = step.units.length === 1
      ? `units=1  (${step.units[0]!.path}, base offset ${step.units[0]!.baseOffset})`
      : `units=${step.units.length}`;
    process.stdout.write([
      `extract  layer=claims  extractor=${step.extractorVersion}${step.promoted ? ' (promoted)' : ''}  ${units}  (fixture replay)`,
      `proposals: ${step.results.length}`,
    ].join('\n') + '\n');
  });
}
