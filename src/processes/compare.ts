// The harness process (actor harness(compare)): the three-class rule applied to the log.
//   reconfirmStructure  a proposed tree with the paths and types of a verified tree of the same lineage
//                       → StructureVerified (class A); otherwise the tree waits for the reviewer
//   compareBatch        the proposals of the latest extraction run against CurrentBeliefs:
//                       A → ClaimVerified + ClaimSuperseded(reconfirmation-chain) of the reconfirmed claim
//                       C → ClaimContested;  B and UNEXPECTED → no event (ReviewQueue)
// Every decision carries evidence already in the log (a belief id, a tree id, a batch id). The batch gate
// runs first: in cold start it is not applicable and every class-A reconfirmation is sampled for audit.
import { config } from '../config';
import { catalog } from '../catalog/subjects';
import type { NormalizedValue, SubjectKey } from '../domain/claim';
import type { Span } from '../domain/span';
import { deriveEventId } from '../events/eventId';
import { assertTransition, claimStates } from '../events/fold';
import { append, readLog, type AppendResult, type EventDraft } from '../events/log';
import { ingestedVersion, ofType, proposedTree, verifiedTree } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { build, type Belief } from '../harness/beliefs/currentBeliefs';
import { compare, compareStructure, type Comparison } from '../harness/compare/comparator';
import { batchGate, isColdStart, type GateResult } from '../harness/eval/batchGate';
import { goldenSize } from '../harness/golden/size';
import { auditRate, isSampled } from '../harness/sampling/auditPolicy';

// The producer part of every eventId this process derives; same input + same decision = same id, so a
// second run of compare appends nothing.
const PRODUCER = 'harness:compare';
// The rule names which harness exception the event relies on: class-A verify/supersede, or contest.
const actor = (rule: 'class-A' | 'contest') => ({ kind: 'harness', id: 'compare', rule }) as const;

// What the evidence records about the gate: 'passed' only when probes ran; cold start is 'not-applicable'.
const probeResult = (gate: GateResult) => (gate.kind === 'passed' ? 'passed' : 'not-applicable') as 'passed' | 'not-applicable';

/** append() validates the schema only; the lifecycle table is checked here, against the log as it is now. */
function appendChecked(path: string, draft: EventDraft): AppendResult {
  assertTransition(readLog(path), draft);
  return append(path, draft);
}

// ---------------------------------------------------------------- structure

export interface StructureReconfirmation {
  readonly treeId: string;
  readonly reconfirmed?: { readonly treeId: string; readonly verifiedEvent: Extract<LogEvent, { type: 'StructureVerified' }> };
  readonly goldenItems: number;
  readonly gate: GateResult;
  readonly result?: AppendResult;
}

/** Structure class A for one tree; appends StructureVerified(actor=harness) when the tree reconfirms a verified one. */
export function reconfirmStructure(path: string, treeId: string): StructureReconfirmation {
  const events = readLog(path);
  const tree = proposedTree(events, treeId);
  if (!tree) throw new Error(`${treeId} not proposed`);
  const lineageOf = (documentId: string, version: string) => ingestedVersion(events, documentId, version)?.payload.lineageId;
  const lineage = lineageOf(tree.payload.documentId, tree.payload.version);

  // Candidates: every verified tree of the same lineage, whoever verified it, with the nodes it was proposed with.
  const candidates = ofType(events, 'StructureVerified').flatMap((verifiedEvent) => {
    const t = proposedTree(events, verifiedEvent.payload.treeId);
    return t && lineageOf(t.payload.documentId, t.payload.version) === lineage ? [{ treeId: t.payload.treeId, nodes: t.payload.nodes, verifiedEvent }] : [];
  });
  const match = compareStructure(tree.payload, candidates);
  // The Structure golden set holds one tree after segment 2, so the gate is not applicable (cold start).
  const goldenItems = goldenSize(events, 'structure');
  const gate = batchGate({ goldenItems });
  // No match (or a rejected gate): no event; the tree stays proposed and the reviewer CLI picks it up.
  if (!match || gate.kind === 'rejected') return { treeId, goldenItems, gate };

  const reconfirmed = { treeId: match.treeId, verifiedEvent: match.verifiedEvent };
  const result = append(path, {
    eventId: deriveEventId({ producer: PRODUCER, inputArtifactId: tree.eventId, extractorVersion: null, eventType: 'StructureVerified', aggregateId: treeId }),
    type: 'StructureVerified',
    layer: 'structure',
    aggregateId: treeId,
    actor: actor('class-A'),
    causationId: tree.eventId,
    correlationId: tree.correlationId,       // same run as the StructureProposed it decides on
    payload: { treeId },
    evidence: { kind: 'class-A', reconfirmedTreeId: match.treeId, reconfirmedEventId: match.verifiedEvent.eventId, probeResult: probeResult(gate) },
  });
  return { treeId, reconfirmed, goldenItems, gate, result };
}

// ---------------------------------------------------------------- claims

type ProposedEvent = Extract<LogEvent, { type: 'ClaimProposed' }>;

export interface ComparedProposal {
  readonly proposal: ProposedEvent;
  readonly comparison: Comparison;
}

export interface BatchComparison {
  readonly batchId: string;
  readonly proposals: readonly ComparedProposal[];
  readonly beliefs: number;
  readonly goldenItems: number;
  readonly gate: GateResult;
  readonly auditRate: number;
  readonly results: readonly AppendResult[];
}

/**
 * The batch = the agent proposals of the latest extraction run that are still proposed.
 * Run = correlationId. Only the latest run counts, so the v8 proposals left proposed in segment 2
 * (clm-eserc3, clm-capitale) are never compared again. Already-decided proposals are skipped: compared
 * against the beliefs they created, they would reconfirm themselves. The batch id numbers the runs on the
 * same document version: the first v9 run is btc-v9-01.
 */
export function currentBatch(events: readonly LogEvent[]): { batchId: string; proposals: ProposedEvent[] } | undefined {
  const agentProposals = ofType(events, 'ClaimProposed').filter((e) => e.actor.kind === 'agent');
  const last = agentProposals.at(-1);
  if (!last) return undefined;
  const version = last.payload.spans[0]!.version;
  const runsOnVersion = [...new Set(agentProposals.filter((e) => e.payload.spans[0]!.version === version).map((e) => e.correlationId))];
  const batchId = `btc-${version}-${String(runsOnVersion.indexOf(last.correlationId) + 1).padStart(2, '0')}`;
  const states = claimStates(events);
  // B and UNEXPECTED stay proposed, so a second compare re-lists them; their class does not change.
  const proposals = agentProposals.filter((e) => e.correlationId === last.correlationId && states.get(e.payload.claimId as never) === 'proposed');
  return { batchId, proposals };
}

/** The events one comparison leads to; `rate` is the class-A audit sampling rate for this proposal. */
function decisionDrafts(p: ProposedEvent, c: Comparison, batchId: string, gate: GateResult, rate: number): EventDraft[] {
  const claimId = p.payload.claimId;
  // Class A: verify the new claim, then supersede the belief it reconfirms (the chain keeps one belief per
  // key). The supersession is caused by the verification, so the tail shows ← ev-0025 on seq 26.
  if (c.cls === 'A') {
    const belief = c.evidence.belief;
    const verifiedId = deriveEventId({ producer: PRODUCER, inputArtifactId: p.eventId, extractorVersion: null, eventType: 'ClaimVerified', aggregateId: claimId });
    return [
      {
        eventId: verifiedId,
        type: 'ClaimVerified',
        layer: 'claims',
        aggregateId: claimId,
        actor: actor('class-A'),
        causationId: p.eventId,
        correlationId: batchId,
        payload: { claimId },
        evidence: {
          kind: 'class-A', reconfirmedBeliefId: belief.claimId, beliefEventId: belief.verifiedEventId, batchId,
          probeResult: probeResult(gate), auditSampled: isSampled(claimId, rate),
        },
      },
      {
        eventId: deriveEventId({ producer: PRODUCER, inputArtifactId: verifiedId, extractorVersion: null, eventType: 'ClaimSuperseded', aggregateId: belief.claimId }),
        type: 'ClaimSuperseded',
        layer: 'claims',
        aggregateId: belief.claimId,
        actor: actor('class-A'),
        causationId: verifiedId,
        correlationId: batchId,
        payload: { claimId: belief.claimId, successor: claimId },
        evidence: { reason: 'reconfirmation-chain' },
      },
    ];
  }
  // Class C: contest the new claim only; the belief stays verified until a human resolves the pair.
  // Evidence order is [belief, proposal]: the tail reads "2,000,000 ≠ 4,000,000".
  if (c.cls === 'C') {
    const belief = c.evidence.belief;
    return [{
      eventId: deriveEventId({ producer: PRODUCER, inputArtifactId: p.eventId, extractorVersion: null, eventType: 'ClaimContested', aggregateId: claimId }),
      type: 'ClaimContested',
      layer: 'claims',
      aggregateId: claimId,
      actor: actor('contest'),
      causationId: p.eventId,
      correlationId: batchId,
      payload: { claimId, conflictingClaimId: belief.claimId },
      evidence: {
        dimension: 'same-subject-different-value',
        values: [belief.value, p.payload.normalizedValue],
        spans: [belief.spans[0]!, p.payload.spans[0]!],
      },
    }];
  }
  // Class B and UNEXPECTED: no event; the claim stays proposed and shows up in the ReviewQueue.
  return [];
}

/** npm run compare: gate, classify every proposal of the batch, append the A and C decisions in proposal order. */
export function compareBatch(path: string = config.paths.log): BatchComparison | undefined {
  const events = readLog(path);
  const batch = currentBatch(events);
  if (!batch) return undefined;
  const beliefs = build(events);
  const goldenItems = goldenSize(events, 'claims');
  const gate = batchGate({ goldenItems });

  // Classification sees the beliefs as they were before this batch: the A and C decisions below do not
  // feed back into the comparisons of the same batch.
  const proposals = batch.proposals.map((proposal): ComparedProposal => ({
    proposal,
    comparison: compare({
      claimId: proposal.payload.claimId,
      lineageId: proposal.payload.lineageId,
      subjectKey: proposal.payload.subjectKey as SubjectKey,
      value: proposal.payload.normalizedValue as NormalizedValue,
      spans: proposal.payload.spans as Span[],
    }, beliefs, catalog, { thetaIoU: config.eval.iouThreshold }),
  }));

  // Probe items enter the batch in phase E1; until then the gate is either not applicable (cold start)
  // or throws because the batch carries no probes.
  const rateFor = (b: Belief) => auditRate(b.root.kind, isColdStart(gate));
  const results = proposals.flatMap(({ proposal, comparison }) => {
    const rate = comparison.cls === 'A' ? rateFor(comparison.evidence.belief) : 0;
    return decisionDrafts(proposal, comparison, batch.batchId, gate, rate).map((d) => appendChecked(path, d));
  });
  // The rate printed on the gate line: 100 % in cold start, otherwise the human-rooted base rate.
  const rate = isColdStart(gate) ? config.sampling.coldStart : config.sampling.humanRooted;
  return { batchId: batch.batchId, proposals, beliefs: beliefs.size, goldenItems, gate, auditRate: rate, results };
}
