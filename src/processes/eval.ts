// The harness process for the offline eval (actor harness(eval)):
//   runEval   golden set at a cut-off + one extractor version's proposals on its inputs → EvalCompleted
//   runDrift  two versions on the same golden set → drift per item and the promotion criteria; appends
//             ExtractorVersionPromoted only when all four hold, nothing otherwise
// The golden set and the proposals are both read from the log, so every number is reproducible from a seq.
import { config } from '../config';
import { readDocument } from '../acl/sourceToStructure';
import { append, readLog, type AppendResult } from '../events/log';
import { deriveEventId } from '../events/eventId';
import { ofType, promotedVersion } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { sameValue, type NormalizedValue, type SubjectKey } from '../domain/claim';
import type { Span } from '../domain/span';
import { goldenSet, resolveCutoff, type GoldenSet } from '../harness/golden/query';
import type { EvalProposal } from '../harness/eval/align';
import { evaluate, type Evaluation } from '../harness/eval/evaluate';
import { drift, noiseIntroduced, provenanceDrift, type DriftRow } from '../harness/eval/drift';
import type { Metrics } from '../harness/eval/metrics';
import { promotion, type PromotionConfig, type PromotionResult } from '../harness/eval/promotion';

const PRODUCER = 'harness:eval';
const actor = { kind: 'harness', id: 'eval', rule: 'eval' } as const;
const tag = (extractorVersion: string) => extractorVersion.split('@')[1] ?? extractorVersion;

/** The Claims golden set at a named cut-off ('g1'), a seq, or the end of the log. */
export function claimsGolden(events: readonly LogEvent[], cutoff?: string, extractorVersion?: string): GoldenSet {
  const untilSeq = resolveCutoff(cutoff, events.length);
  const excludePromptExampleIds = extractorVersion ? config.golden.promptExampleIds[extractorVersion] ?? [] : [];
  return goldenSet(events, 'claims', untilSeq, { excludePromptExampleIds, textOf: (d, v) => readDocument(d, v) });
}

/** The agent proposals of one extractor version on the golden inputs (same StructureVerified, same section), in log order. */
export function proposalsFor(events: readonly LogEvent[], extractorVersion: string, golden: GoldenSet): EvalProposal[] {
  const inputs = new Map(golden.items.map((i) => [`${i.input.structureEventId}#${i.input.sectionPath}`, i.inputArtifactId] as const));
  return ofType(events, 'ClaimProposed').flatMap((e) => {
    if (e.actor.kind !== 'agent' || e.actor.extractorVersion !== extractorVersion) return [];
    const inputArtifactId = inputs.get(`${e.causationId}#${e.payload.sectionPath}`);
    return inputArtifactId ? [{
      inputArtifactId, claimId: e.payload.claimId, subjectKey: e.payload.subjectKey as SubjectKey,
      value: e.payload.normalizedValue as NormalizedValue, spans: e.payload.spans as Span[],
    }] : [];
  });
}

export interface EvalRun {
  readonly extractorVersion: string;
  readonly golden: GoldenSet;
  readonly evaluation: Evaluation;
  readonly result: AppendResult;
  /** The promoted version's last EvalCompleted on the same golden set, to print next to these numbers. */
  readonly previous?: { readonly extractorVersion: string; readonly metrics: Metrics };
}

export function runEval(extractorVersion: string, cutoff?: string, path: string = config.paths.log): EvalRun {
  const events = readLog(path);
  const golden = claimsGolden(events, cutoff, extractorVersion);
  const evaluation = evaluate(golden.items, proposalsFor(events, extractorVersion, golden), { thetaIoU: config.eval.iouThreshold });
  const m = evaluation.metrics;
  const result = append(path, {
    // Same golden set + same extractor version = same id: a second eval appends nothing.
    eventId: deriveEventId({ producer: PRODUCER, inputArtifactId: `${golden.version}@${golden.untilSeq}`, extractorVersion: null, eventType: 'EvalCompleted', aggregateId: extractorVersion }),
    type: 'EvalCompleted',
    layer: 'harness',
    aggregateId: extractorVersion,
    actor,
    correlationId: `eval-${tag(extractorVersion)}-${tag(golden.version)}`,
    payload: {
      extractorVersion, goldenSetVersion: golden.version, tp: m.tp, fp: m.fp, fn: m.fn, precision: m.precision, recall: m.recall,
      items: [
        ...evaluation.pairs.map((p) => ({ subjectKey: p.expected.subjectKey, outcome: p.outcome ?? 'missing', ...(p.iou !== undefined ? { iou: p.iou } : {}) })),
        ...evaluation.unpaired.map((p) => ({ subjectKey: p.subjectKey, outcome: 'unexpected' })),
      ],
    },
    evidence: { kind: 'golden-query', layer: 'claims', untilSeq: golden.untilSeq },
  });

  const promoted = promotedVersion(events, 'claims');
  const prev = promoted === extractorVersion ? undefined
    : ofType(events, 'EvalCompleted').filter((e) => e.payload.extractorVersion === promoted && e.payload.goldenSetVersion === golden.version).at(-1);
  return {
    extractorVersion, golden, evaluation, result,
    ...(prev ? { previous: { extractorVersion: prev.payload.extractorVersion, metrics: prev.payload } } : {}),
  };
}

export interface NoiseItem {
  readonly proposal: EvalProposal;
  readonly sectionPath: string;
  /** A human or the promoted extractor states the same subject and value elsewhere in the lineage. */
  readonly statedElsewhere: boolean;
  /** …and never in this unit. */
  readonly notInUnit: boolean;
  /** The golden item has no expected claim with this subject. */
  readonly noExpectedItem: boolean;
}

export interface DriftRun {
  readonly from: string;
  readonly to: string;
  readonly golden: GoldenSet;
  readonly a: Evaluation;
  readonly b: Evaluation;
  readonly rows: readonly DriftRow[];
  readonly noise: readonly NoiseItem[];
  readonly provenance: readonly DriftRow[];
  readonly promotion: PromotionResult;
  /** Set only when all four criteria hold. */
  readonly result?: AppendResult;
}

export function runDrift(from: string, to: string, cutoff?: string, path: string = config.paths.log, cfg: PromotionConfig = config.promotion): DriftRun {
  const events = readLog(path);
  const golden = claimsGolden(events, cutoff, to);
  const theta = config.eval.iouThreshold;
  const a = evaluate(golden.items, proposalsFor(events, from, golden), { thetaIoU: theta });
  const b = evaluate(golden.items, proposalsFor(events, to, golden), { thetaIoU: theta });
  const rows = drift(a.pairs, b.pairs);
  const verdict = promotion(a.metrics, b.metrics, rows, cfg);

  // Noise, with what the log says about each introduced proposal.
  const promoted = promotedVersion(events, 'claims');
  const trusted = ofType(events, 'ClaimProposed').filter((e) => e.actor.kind === 'human' || (e.actor.kind === 'agent' && e.actor.extractorVersion === promoted));
  const sectionOf = new Map(golden.items.map((i) => [i.inputArtifactId, i] as const));
  const noise = noiseIntroduced(a, b).map((proposal): NoiseItem => {
    const item = sectionOf.get(proposal.inputArtifactId)!;
    const same = trusted.filter((e) => e.payload.subjectKey === proposal.subjectKey && sameValue(e.payload.normalizedValue as NormalizedValue, proposal.value));
    return {
      proposal,
      sectionPath: item.input.sectionPath,
      statedElsewhere: same.some((e) => e.payload.sectionPath !== item.input.sectionPath),
      notInUnit: same.length > 0 && same.every((e) => e.payload.sectionPath !== item.input.sectionPath),
      noExpectedItem: !item.expected.some((x) => x.subjectKey === proposal.subjectKey),
    };
  });

  let result: AppendResult | undefined;
  if (verdict.promoted) {
    result = append(path, {
      eventId: deriveEventId({ producer: PRODUCER, inputArtifactId: `${from}→${to}@${golden.version}@${golden.untilSeq}`, extractorVersion: null, eventType: 'ExtractorVersionPromoted', aggregateId: to }),
      type: 'ExtractorVersionPromoted',
      layer: 'harness',
      aggregateId: to,
      actor,
      correlationId: `promote-${tag(to)}-${tag(golden.version)}`,
      payload: { extractor: to.split('@')[0]!, version: to, previous: promoted ?? null },
      evidence: { kind: 'criteria', criteria: verdict.criteria.map((c) => ({ ...c })) },
    });
  }
  return { from, to, golden, a, b, rows, noise, provenance: provenanceDrift(rows, theta), promotion: verdict, ...(result ? { result } : {}) };
}
