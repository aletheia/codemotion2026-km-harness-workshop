// The comparator, applied to the log: reconfirm a structure (class A) and classify pending claim proposals.
// The harness emits decisions ONLY in class A (verify + supersede) and class C (contest); class B and
// UNEXPECTED emit nothing: they wait for a human. Every decision carries evidence that is already in the log.
import { buildEvent } from '../events/build';
import { asClaimId, asEventId } from '../domain/ids';
import { formatValue } from '../domain/value';
import { catalogHas } from '../catalog/catalog';
import { config } from '../config';
import { auditSampled, classify, sameTreeShape, type ComparatorClass } from '../harness/compare';
import { batchGate, gateLine, type GateResult } from '../harness/eval/batchGate';
import { goldenClaims, goldenStructure } from '../harness/golden';
import { currentBeliefs } from '../projections/views';
import type { AnyDraft } from '../events/types';
import { commit } from './commit';
import { loadFold, requireInitialised } from './context';
import { Rejection } from './errors';
import { harnessActor } from './actors';
import { lastEventId } from './review';
import { treeIdOf } from './structure';

function gateFor(layerItems: number): GateResult {
  const g = batchGate(layerItems, undefined);
  return g;
}

export function reconfirmStructure(documentId: string) {
  const f = loadFold();
  requireInitialised(f);
  const tree = f.trees.get(treeIdOf(documentId));
  if (!tree) throw new Rejection(`no structure proposed for ${documentId}`);
  if (tree.verifiedEventId) return { documentId, status: 'already-verified' as const };
  const doc = f.docs.get(documentId)!;
  const prior = [...f.trees.values()]
    .filter((t) => t.verifiedEventId && t.treeId !== tree.treeId && f.docs.get(t.documentId)?.lineageId === doc.lineageId)
    .sort((a, b) => (b.verifiedSeq ?? 0) - (a.verifiedSeq ?? 0))[0];
  if (!prior) return { documentId, status: 'queued' as const, reason: 'no verified tree of this lineage to compare with' };
  if (!sameTreeShape(tree.nodes, prior.nodes)) return { documentId, status: 'queued' as const, reason: `tree shape differs from ${prior.treeId}` };
  const gate = gateFor(goldenStructure(f, undefined).length);
  if (gate.kind !== 'not-applicable') throw new Rejection('structure batch gate with probes is not implemented in this checkout');
  const draft = buildEvent({
    type: 'StructureVerified', aggregateId: tree.treeId, actor: harnessActor, inputArtifactId: tree.proposedEventId,
    causationId: tree.proposedEventId, correlationId: `compare-structure-${tree.version}`,
    payload: { treeId: tree.treeId, documentId: tree.documentId as never, version: tree.version },
    evidence: { kind: 'class-A', comparator: 'structure-shape', reconfirmed: { treeId: prior.treeId }, auditSampled: auditSampled(tree.treeId, config.sampling.belowProbeMinimum), gate: 'not-applicable', gateNote: gateLine(gate) },
  });
  const [r] = commit([draft]);
  return { documentId, status: 'reconfirmed' as const, reconfirmedFrom: prior.treeId, gate: gateLine(gate), event: r };
}

export interface CompareRow { subjectKey: string; value: string; cls: ComparatorClass; action: string; claimId: string; seq: number[] }

export function compareDocument(documentId: string) {
  const f = loadFold();
  requireInitialised(f);
  if (!f.docs.has(documentId)) throw new Rejection(`document ${documentId} is not ingested`);
  const gate = gateFor(goldenClaims(f, undefined).length);
  if (gate.kind !== 'not-applicable') throw new Rejection('claims batch gate with probes is not implemented in this checkout');
  const beliefs = currentBeliefs(f);
  const pending = [...f.claims.values()]
    .filter((c) => c.documentId === documentId && c.state === 'proposed' && c.proposals[0]?.actor.kind === 'agent')
    .sort((a, b) => a.firstSeq - b.firstSeq);
  if (pending.length === 0) throw new Rejection(`no pending agent proposals for ${documentId}`);

  const drafts: AnyDraft[] = [];
  const rows: (Omit<CompareRow, 'seq'> & { draftIds: string[] })[] = [];
  for (const rec of pending) {
    const b = beliefs.get(`${rec.claim.lineageId}|${rec.claim.subjectKey}`);
    const cls = classify(
      { subjectKey: rec.claim.subjectKey, value: rec.claim.value, span: rec.claim.spans[0] },
      b ? { claimId: b.rec.claim.claimId, value: b.rec.claim.value, span: b.rec.claim.spans[0] } : undefined,
      catalogHas(rec.claim.subjectKey), config.thetaIoU,
    );
    const base = { subjectKey: rec.claim.subjectKey, value: formatValue(rec.claim.value), cls: cls.cls, claimId: rec.claim.claimId };
    if (cls.cls === 'A' && b) {
      const ver = buildEvent({
        type: 'ClaimVerified', aggregateId: `claim:${rec.claim.claimId}`, actor: harnessActor, inputArtifactId: lastEventId(rec),
        causationId: lastEventId(rec), correlationId: `compare-${rec.version}`, payload: { claimId: rec.claim.claimId },
        evidence: {
          kind: 'class-A', comparator: 'cmp1', reconfirmed: { claimId: b.rec.claim.claimId }, matchedValue: formatValue(rec.claim.value),
          auditSampled: auditSampled(rec.claim.claimId, config.sampling.belowProbeMinimum), gate: 'not-applicable', gateNote: gateLine(gate),
        },
      });
      const sup = buildEvent({
        type: 'ClaimSuperseded', aggregateId: `claim:${b.rec.claim.claimId}`, actor: harnessActor, inputArtifactId: ver.eventId,
        causationId: ver.eventId, correlationId: ver.correlationId,
        payload: { claimId: asClaimId(b.rec.claim.claimId), successor: rec.claim.claimId },
        evidence: { kind: 'supersession', supersededBy: rec.claim.claimId, reason: 'reconfirmation-chain' },
      });
      drafts.push(ver, sup);
      rows.push({ ...base, action: `reconfirmed ${formatValue(b.rec.claim.value)} (${b.rec.documentId}); verified by harness, previous claim superseded`, draftIds: [ver.eventId, sup.eventId] });
    } else if (cls.cls === 'C' && b) {
      const con = buildEvent({
        type: 'ClaimContested', aggregateId: `claim:${rec.claim.claimId}`, actor: harnessActor, inputArtifactId: lastEventId(rec),
        causationId: asEventId(lastEventId(rec)), correlationId: `compare-${rec.version}`, payload: { claimId: rec.claim.claimId },
        evidence: { kind: 'class-C', beliefClaimId: asClaimId(b.rec.claim.claimId), beliefValue: formatValue(b.rec.claim.value), proposedValue: formatValue(rec.claim.value) },
      });
      drafts.push(con);
      rows.push({ ...base, action: `contested against ${formatValue(b.rec.claim.value)}; a human resolves`, draftIds: [con.eventId] });
    } else {
      rows.push({ ...base, action: cls.cls === 'UNEXPECTED' ? 'queued, high priority (not in the catalogue)' : `queued for human review (${cls.reason})`, draftIds: [] });
    }
  }
  const outcomes = drafts.length ? commit(drafts) : [];
  const seqOf = new Map(outcomes.map((o) => [o.eventId, o.seq]));
  const out: CompareRow[] = rows.map(({ draftIds, ...r }) => ({ ...r, seq: draftIds.map((id) => seqOf.get(id)!).filter((x) => x !== undefined) }));
  const count = (c: ComparatorClass) => out.filter((r) => r.cls === c).length;
  return {
    documentId, gate: gateLine(gate), gateKind: gate.kind, auditSamplingRate: config.sampling.belowProbeMinimum,
    counts: { A: count('A'), B: count('B'), C: count('C'), UNEXPECTED: count('UNEXPECTED') }, rows: out,
  };
}
