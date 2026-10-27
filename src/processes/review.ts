// The reviewer CLI (a process, not an agent). Guided, not free typing: the log says which stage is pending,
// fixtures/review/decisions.json holds the scripted decisions of that stage, and each decision is shown with
// its evidence pre-filled (span text, catalogue lookup; for a contested pair both claims side by side with
// their spans and validity periods). Interactive: Enter confirms, n skips, e edits the
// note. Auto (review:auto, dry-run): the stage is applied without waiting and nothing is printed.
//
// A stage is pending when every proposal it decides on is in the log and at least one of its decision
// events is not; stages are taken in file order, so a stage never runs before the previous one is applied.
// Every decision event has a deterministic eventId, so applying a stage twice appends nothing.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { config } from '../config';
import { readDocument } from '../acl/sourceToStructure';
import { claimLabel } from '../catalog/labels';
import { displayValue, normalize } from '../catalog/normalizer';
import { isCritical, lookupSubject } from '../catalog/subjects';
import { deriveClaimId, type NormalizedValue, type SubjectKey } from '../domain/claim';
import { documentId as asDocumentId, lineageId as asLineageId } from '../domain/ids';
import { deriveEventId } from '../events/eventId';
import { assertTransition } from '../events/fold';
import { append, readLog, type AppendResult, type EventDraft } from '../events/log';
import { ingestedVersion, ofType, proposedTree, treeIdOf, verifiedTree } from '../events/lookup';
import type { LogEvent } from '../events/schema';

const note = z.string().min(1);
const decisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify-structure'), treeId: z.string(), note }),
  z.object({ action: z.literal('verify'), claim: z.string(), note }),
  z.object({ action: z.literal('leave'), claim: z.string(), note }),
  // A contested claim resolved in its favour: verify it, supersede the claim it conflicts with.
  z.object({ action: z.literal('resolve'), claim: z.string(), supersedes: z.string(), note }),
  z.object({
    action: z.literal('add'), documentId: z.string(), version: z.string(), sectionPath: z.string(), subjectKey: z.string(),
    value: z.string(), span: z.object({ start: z.int(), end: z.int() }), note,
  }),
]);
const decisionsFileSchema = z.object({
  reviewer: z.string().min(1),
  stages: z.array(z.object({ id: z.string(), title: z.string(), decisions: z.array(decisionSchema).min(1) })),
});

export type Decision = z.infer<typeof decisionSchema>;
export type DecisionsFile = z.infer<typeof decisionsFileSchema>;
export type Stage = DecisionsFile['stages'][number];

export const loadDecisions = (path: string = config.paths.reviewDecisions): DecisionsFile =>
  decisionsFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

/** One decision ready to show and apply: its evidence lines and the events it appends for a given note. */
export interface PlannedDecision {
  readonly decision: Decision;
  readonly lines: readonly string[];
  readonly drafts: (note: string) => EventDraft[];
}

const quote = (text: string, max = 70): string => `"${text.length <= max ? text : text.slice(0, max - 1) + '…'}"`;

function catalogueLine(subjectKey: string): string {
  const subject = lookupSubject(subjectKey);
  if (!subject) return 'catalogue: UNEXPECTED (subject not in catalogue) — high priority';
  return `catalogue: ${subject.cls}${isCritical(subjectKey) ? ' (critical)' : ''}`;
}

/** The decisions of a stage against the log; undefined while a proposal it decides on is not in the log yet. */
export function planStage(stage: Stage, events: readonly LogEvent[], reviewer: string): PlannedDecision[] | undefined {
  const actor = { kind: 'human', id: reviewer } as const;
  const producer = `human:${reviewer}`;
  const proposals = new Map(ofType(events, 'ClaimProposed').flatMap((e) => (e.payload.label ? [[e.payload.label, e] as const] : [])));
  const planned: PlannedDecision[] = [];

  for (const d of stage.decisions) {
    switch (d.action) {
      case 'verify-structure': {
        const tree = proposedTree(events, d.treeId);
        if (!tree) return undefined;
        const nodes = tree.payload.nodes;
        const covers: [number, number] = [Math.min(...nodes.map((n) => n.start)), Math.max(...nodes.map((n) => n.end))];
        planned.push({
          decision: d,
          lines: [
            `verify  ${d.treeId}  ${tree.payload.documentId}@${tree.payload.version}  ${nodes.length} nodes, intervals cover ${covers[0]}..${covers[1]}`,
            ...nodes.map((n) => `      ${n.path.padEnd(9)} ${n.type.padEnd(6)} [${n.start},${n.end})`),
          ],
          drafts: (text) => [{
            eventId: deriveEventId({ producer, inputArtifactId: tree.eventId, extractorVersion: null, eventType: 'StructureVerified', aggregateId: d.treeId }),
            type: 'StructureVerified',
            layer: 'structure',
            aggregateId: d.treeId,
            actor,
            causationId: tree.eventId,
            correlationId: `review-${stage.id}`,
            payload: { treeId: d.treeId },
            evidence: { kind: 'human', note: text, nodesChecked: nodes.length, nodesTotal: nodes.length, covers },
          }],
        });
        break;
      }

      case 'verify':
      case 'leave': {
        const p = proposals.get(d.claim);
        if (!p) return undefined;
        const span = p.payload.spans[0]!;
        const spanText = readDocument(span.documentId, span.version).slice(span.start, span.end);
        planned.push({
          decision: d,
          lines: [
            `${d.action === 'verify' ? 'verify' : 'leave proposed'}  ${d.claim}  ${p.payload.subjectKey} = ${displayValue(p.payload.normalizedValue as NormalizedValue)}  ·  ${catalogueLine(p.payload.subjectKey)}`,
            `      span [${span.start},${span.end})  ${quote(spanText)}`,
          ],
          drafts: (text) => d.action === 'leave' ? [] : [{
            eventId: deriveEventId({ producer, inputArtifactId: p.eventId, extractorVersion: null, eventType: 'ClaimVerified', aggregateId: p.payload.claimId }),
            type: 'ClaimVerified',
            layer: 'claims',
            aggregateId: p.payload.claimId,
            actor,
            causationId: p.eventId,
            correlationId: `review-${stage.id}`,
            payload: { claimId: p.payload.claimId },
            evidence: { kind: 'human', note: text, checkedSpan: span },
          }],
        });
        break;
      }

      case 'resolve': {
        const next = proposals.get(d.claim);
        const prev = proposals.get(d.supersedes);
        // The stage is ready only once compare has contested the new claim: the verification is caused by
        // the ClaimContested event (← ev-0027), not by the proposal.
        const contest = next && ofType(events, 'ClaimContested').find((e) => e.payload.claimId === next.payload.claimId);
        if (!next || !prev || !contest) return undefined;
        // Each side of the pair: its span and the validity period of the document version it comes from.
        const validity = (p: typeof next) => {
          const span = p.payload.spans[0]!;
          const v = ingestedVersion(events, span.documentId, span.version);
          return { span, from: v?.payload.effectiveFrom, to: v?.payload.effectiveTo };
        };
        const n = validity(next);
        const o = validity(prev);
        const side = (label: string, p: typeof next, x: typeof n) =>
          `      ${label.padEnd(13)} ${x.span.version} [${x.span.start},${x.span.end})  ` +
          `${quote(readDocument(x.span.documentId, x.span.version).slice(x.span.start, x.span.end), 50)}  ` +
          `in force ${x.from ?? '?'}${x.to ? ` – ${x.to}` : ' –'}  ${displayValue(p.payload.normalizedValue as NormalizedValue)}`;
        const verifyId = deriveEventId({ producer, inputArtifactId: contest.eventId, extractorVersion: null, eventType: 'ClaimVerified', aggregateId: next.payload.claimId });
        planned.push({
          decision: d,
          lines: [
            `resolve  ${d.claim} vs ${d.supersedes}  ${next.payload.subjectKey}  ·  ${catalogueLine(next.payload.subjectKey)}`,
            side(d.claim, next, n),
            side(d.supersedes, prev, o),
            `      → verify ${d.claim}; supersede ${d.supersedes}${n.from ? ` (valid until ${n.from})` : ''}`,
          ],
          // Verify first, then supersede: the predecessor is superseded by a claim that is already verified,
          // and its valid-time end is the successor version's effectiveFrom (2019-06-18).
          drafts: (text) => [
            {
              eventId: verifyId,
              type: 'ClaimVerified',
              layer: 'claims',
              aggregateId: next.payload.claimId,
              actor,
              causationId: contest.eventId,
              correlationId: `review-${stage.id}`,
              payload: { claimId: next.payload.claimId },
              evidence: { kind: 'human', note: text },
            },
            {
              eventId: deriveEventId({ producer, inputArtifactId: verifyId, extractorVersion: null, eventType: 'ClaimSuperseded', aggregateId: prev.payload.claimId }),
              type: 'ClaimSuperseded',
              layer: 'claims',
              aggregateId: prev.payload.claimId,
              actor,
              causationId: verifyId,
              correlationId: `review-${stage.id}`,
              payload: { claimId: prev.payload.claimId, successor: next.payload.claimId },
              evidence: { reason: 'human-resolution', note: text, ...(n.from ? { validUntil: n.from } : {}) },
            },
          ],
        });
        break;
      }

      case 'add': {
        const tree = verifiedTree(events, treeIdOf(d.version));
        const ingested = ingestedVersion(events, d.documentId, d.version);
        if (!tree || !ingested) return undefined;
        const subjectKey = d.subjectKey as SubjectKey;
        const normalizedValue = normalize(d.value, lookupSubject(subjectKey));
        const claimId = deriveClaimId(asDocumentId(d.documentId), d.version, subjectKey, normalizedValue);
        const label = claimLabel('human', d.version, subjectKey, normalizedValue, claimId);
        const span = { documentId: d.documentId, version: d.version, start: d.span.start, end: d.span.end };
        const proposedId = deriveEventId({ producer, inputArtifactId: tree.eventId, extractorVersion: null, eventType: 'ClaimProposed', aggregateId: claimId });
        planned.push({
          decision: d,
          lines: [
            `add + verify  ${label}  ${subjectKey} = ${displayValue(normalizedValue)}  ·  ${catalogueLine(subjectKey)}`,
            `      span [${span.start},${span.end})  ${quote(readDocument(d.documentId, d.version).slice(span.start, span.end))}`,
          ],
          drafts: (text) => [
            {
              eventId: proposedId,
              type: 'ClaimProposed',
              layer: 'claims',
              aggregateId: claimId,
              actor,
              causationId: tree.eventId,
              correlationId: `review-${stage.id}`,
              payload: { claimId, label, lineageId: asLineageId(ingested.payload.lineageId), subjectKey, normalizedValue, spans: [span], sectionPath: d.sectionPath },
            },
            {
              eventId: deriveEventId({ producer, inputArtifactId: proposedId, extractorVersion: null, eventType: 'ClaimVerified', aggregateId: claimId }),
              type: 'ClaimVerified',
              layer: 'claims',
              aggregateId: claimId,
              actor,
              causationId: proposedId,
              correlationId: `review-${stage.id}`,
              payload: { claimId },
              evidence: { kind: 'human', note: text },
            },
          ],
        });
        break;
      }
    }
  }
  return planned;
}

export interface PendingStage {
  readonly stage: Stage;
  readonly index: number;
  readonly planned: readonly PlannedDecision[];
}

export function pendingStage(file: DecisionsFile, events: readonly LogEvent[]): PendingStage | undefined {
  const inLog = new Set(events.map((e) => e.eventId));
  for (const [index, stage] of file.stages.entries()) {
    const planned = planStage(stage, events, file.reviewer);
    if (!planned) return undefined;
    if (planned.some((p) => p.drafts(p.decision.note).some((d) => !inLog.has(d.eventId)))) return { stage, index, planned };
  }
  return undefined;
}

/** Appends the events of one decision; a claim event the lifecycle table refuses is never appended. */
export function applyDecision(path: string, planned: PlannedDecision, note: string): AppendResult[] {
  return planned.drafts(note).map((draft) => {
    assertTransition(readLog(path), draft);
    return append(path, draft);
  });
}

/** review:auto — applies the pending stage with the scripted notes; returns its id (undefined if none). */
export function reviewAuto(path: string = config.paths.log, decisions: DecisionsFile = loadDecisions()): string | undefined {
  const pending = pendingStage(decisions, readLog(path));
  if (!pending) return undefined;
  for (const p of pending.planned) applyDecision(path, p, p.decision.note);
  return pending.stage.id;
}

/** review — the same stage, one decision at a time: Enter confirms, n skips, e edits the note. */
export async function reviewInteractive(path: string = config.paths.log, decisions: DecisionsFile = loadDecisions()): Promise<string | undefined> {
  const pending = pendingStage(decisions, readLog(path));
  if (!pending) return undefined;
  const { stage, index, planned } = pending;
  const out = process.stdout;
  out.write(`review  stage ${index + 1}/${decisions.stages.length}  ${stage.title}  ·  ${planned.length} decisions  ·  [Enter] confirm · n skip · e edit note\n`);

  // An async line iterator, not rl.question(): with piped input, lines that arrive before a prompt is
  // shown would otherwise be dropped. End of input stops the stage; what was confirmed stays appended.
  const rl = createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string | undefined> => {
    out.write(prompt);
    const next = await lines.next();
    if (next.done) return undefined;
    if (!process.stdin.isTTY) out.write('\n');
    return next.value;
  };

  let appended = 0;
  try {
    decisions: for (const [i, p] of planned.entries()) {
      out.write(`[${i + 1}/${planned.length}] ${p.lines.join('\n')}\n`);
      let text = p.decision.note;
      for (;;) {
        const answer = (await ask(`      note "${text}"  > `))?.trim().toLowerCase();
        if (answer === undefined) {
          out.write('review  input ended; remaining decisions not applied\n');
          break decisions;
        }
        if (answer === 'e') {
          const edited = (await ask('      new note: '))?.trim();
          if (edited) text = edited;
          continue;
        }
        if (answer !== 'n') appended += applyDecision(path, p, text).filter((r) => !r.duplicate).length;
        break;
      }
    }
  } finally {
    rl.close();
  }
  out.write(`review  ${stage.id}: ${appended} events appended\n`);
  return stage.id;
}
