// Proposing claims. Agents and humans both end up in `commit`, where provenance is enforced;
// this module only builds events.
import { buildEvent } from '../events/build';
import { documentText } from '../adapters/documents';
import { buildUnit, type ClaimsExtractionUnit } from '../acl/structureToClaims';
import { makeClaimId, isSubjectKey, type SubjectKey } from '../domain/claim';
import { asDocumentId, asEventId, asLineageId } from '../domain/ids';
import { localToAbsolute, type LocalSpan } from '../domain/span';
import { normalize, NormalizationError } from '../domain/value';
import type { Actor, AnyDraft } from '../events/types';
import { config } from '../config';
import { commit, type CommitOutcome } from './commit';
import { Rejection, UsageError } from './errors';
import { requireInitialised } from './context';
import { processActor } from './actors';
import type { Fold } from '../projections/fold';
import { treeIdOf } from './structure';

export interface ClaimInput { subjectKey: string; valueText: string; quote: string; span: LocalSpan }

/** Returns the extraction unit, or records an ACLRejected fact and rejects. */
export function unitFor(f: Fold, documentId: string, sectionPath: string, opts: { recordRejection: boolean }): ClaimsExtractionUnit {
  requireInitialised(f);
  const doc = f.docs.get(documentId);
  if (!doc) throw new Rejection(`document ${documentId} is not ingested`);
  const tree = f.trees.get(treeIdOf(documentId));
  const acl = buildUnit({
    documentId: asDocumentId(documentId), version: doc.version, documentText: documentText(documentId),
    nodes: tree?.nodes ?? [], sectionPath, structureVerifiedEventId: tree?.verifiedEventId ?? null,
  });
  if (acl.ok) return acl.unit;
  if (opts.recordRejection && tree) {
    const draft = buildEvent({
      type: 'ACLRejected', aggregateId: `acl:${documentId}:${sectionPath}`, actor: processActor('acl-structure-claims'),
      inputArtifactId: tree.proposedEventId, causationId: asEventId(tree.proposedEventId), correlationId: `acl-${doc.version}`,
      payload: { unitRef: `${documentId}:${sectionPath}`, upstreamEventId: asEventId(tree.proposedEventId), missing: acl.missing, reason: acl.reason },
    });
    commit([draft]);
  }
  throw new Rejection(acl.reason);
}

export function claimDraft(unit: ClaimsExtractionUnit, actor: Actor, correlation: string, c: ClaimInput) {
  if (!isSubjectKey(c.subjectKey)) throw new Rejection(`bad subject key "${c.subjectKey}" (expected <topic>.<attribute>)`);
  let value;
  try {
    value = normalize(c.valueText);
  } catch (e) {
    if (e instanceof NormalizationError) throw new Rejection(e.message);
    throw e;
  }
  const span = localToAbsolute(c.span, unit.baseOffset, unit.documentId, unit.version);
  if (c.span.start < 0 || c.span.end > unit.length) throw new Rejection(`span [${c.span.start},${c.span.end}) is outside section ${unit.sectionPath} (length ${unit.length})`);
  const claimId = makeClaimId(unit.documentId, unit.version, c.subjectKey as SubjectKey, value);
  return buildEvent({
    type: 'ClaimProposed', aggregateId: `claim:${claimId}`, actor, inputArtifactId: unit.causationId,
    causationId: unit.causationId, correlationId: correlation,
    payload: {
      claimId, lineageId: asLineageId(config.lineageId), documentId: unit.documentId, version: unit.version,
      subjectKey: c.subjectKey as SubjectKey, valueText: c.valueText, value, spans: [span], quote: c.quote, sectionPath: unit.sectionPath,
    },
  });
}

export interface ProposeResult { unit: string; proposed: { claimId: string; subjectKey: string; valueText: string; seq: number; deduplicated: boolean }[] }

/** All-or-nothing: one bad quote rejects the whole batch and nothing is written. */
export function proposeClaims(unit: ClaimsExtractionUnit, actor: Actor, inputs: readonly ClaimInput[]): ProposeResult {
  if (inputs.length === 0) throw new UsageError('no claims to propose');
  const correlation = `${actor.kind === 'agent' ? actor.extractorVersion : actor.id}:${unit.unitId}`;
  const drafts: AnyDraft[] = inputs.map((c) => claimDraft(unit, actor, correlation, c));
  const out: CommitOutcome[] = commit(drafts);
  return {
    unit: unit.unitId,
    proposed: out.map((o, i) => ({
      claimId: (drafts[i]!.payload as { claimId: string }).claimId, subjectKey: inputs[i]!.subjectKey, valueText: inputs[i]!.valueText,
      seq: o.seq, deduplicated: o.deduplicated,
    })),
  };
}
