# Harness design

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revision 4, 27 Oct 2026. Compact specification derived from handbook chapter 6 and the decisions in AGENT.md (7–9); the reasoning is in the handbook, this file is what the repository implements under `src/harness/`. Running example: art. 2477 c.c. (`00-running-example.md`). Every threshold is illustrative and lives in `config.ts`.

## 1. Golden sets: a query over the log

Golden set of layer L at version k = all decision events of layer L whose actor is human, up to cut-off sequence `untilSeq`. Excluded: harness- and import-actor decisions (circular); items whose ids appear in the extractor's manifest `promptExampleIds` (otherwise the probe measures the prompt's recall, not the extractor's). Reproducible: the same query on the same log slice returns the same set; the version is the pair (layer, untilSeq).

| Layer | Golden item input | Expected | Alignment key | Comparison |
| --- | --- | --- | --- | --- |
| structure | (document id, version) | section tree | section path | type equality per node; interval IoU ≥ θ per node |
| claims | `StructureVerified` section id | set of (subject key, normalized value, spans, tolerance) | subject key | normalized value equality; span IoU ≥ θ |
| entities | set of verified claim ids | (claim id, entity id) pairs | the pair | exact match |
| policies | (entity id, lineage) | condition / effect / exception triples | (entity, element) | typed element equality; referenced claim ids |
| workflow | (use case, lineage) | ordered steps + expected output on a test input | position | step equality; output equality |

Two modes: offline (whole set; decides promotion; runs on every extractor or prompt change) and online probes (k items inserted in each production batch; decides signal or noise per batch).

In the workshop log the Claims golden set has four items after segment 2 (the human-verified claims of comma 2 of v8: `esercizi.consecutivi` 2, `attivo.limite` 2,000,000 EUR, `ricavi.limite` 2,000,000 EUR, `dipendenti.limite` 10) and seven after segment 3 (the three human resolutions of the v9 conflicts: `attivo.limite` 4,000,000, `ricavi.limite` 4,000,000, `dipendenti.limite` 20). The eval of segment 5 uses the cut-off after segment 2.

## 2. Metrics (Claims layer; the others change only key and comparison)

1. Align: for each expected item, the proposal with the same subject key; several → highest span IoU, the rest unaligned.
2. Classify each pair: value correct (normalized equality) and provenance correct (IoU ≥ θ, θ = 0.8 illustrative, half-open intervals) → correct; else wrong value or wrong provenance.
3. Count: correct pair = TP; incorrect pair = FP + FN; unpaired expected = FN; unpaired proposal = FP.
4. Micro-average over all golden items: precision = TP/(TP+FP), recall = TP/(TP+FN).

Worked example (comma 2 of v8, in force 16 March 2019, four expected): claims@v1 → `attivo.limite` correct (IoU 62/64 = 0.97), `ricavi.limite` correct (IoU 1.00), `esercizi.consecutivi` wrong value (3 instead of 2, right span), `dipendenti.limite` missing, plus an unexpected `capitale.soglia` the catalogue does not resolve → TP 2, FP 2, FN 2, P 0.50, R 0.50; claims@v2 → attivo, esercizi and dipendenti correct, `ricavi.limite` wrong value (2,000 EUR: "milioni" dropped in normalization), plus an unexpected `cessazione.esercizi` outside the unit → TP 3, FP 2, FN 1, P 0.60, R 0.75.

## 3. Drift: per item, never by aggregate

Both versions on the same golden-set version; each expected item lands in one cell of {stable, regression, improvement, stable-wrong}. Plus: proposals in v2 absent in v1 = noise introduced; pairs correct in both with IoU dropping below θ in v2 = provenance drift. In the example: `attivo.limite` stable, `ricavi.limite` regression (2,000 EUR), `esercizi.consecutivi` improvement, `dipendenti.limite` improvement. Aggregates improved (+0.10, +0.25) while a monetary item regressed.

## 4. Promotion criteria (offline) — all four must hold

| # | Criterion | Illustrative value | Example v2 |
| --- | --- | --- | --- |
| 1 | precision(v2) ≥ layer threshold | 0.90 | fails (0.60) |
| 2 | recall(v2) ≥ recall(v1) − ε | ε = 0.02 | holds (0.75 ≥ 0.48) |
| 3 | regressions on the critical subset = 0 | subset = monetary, count, time-limit | fails (`ricavi.limite`, monetary) |
| 4 | wrong-provenance pairs ≤ 2 % of value-correct pairs | 2 % | holds |

Pass → `ExtractorVersionPromoted` with the four values as evidence; the version's projection becomes the promoted one. Fail → nothing is emitted; the v2 proposals stay in the log tagged v2; the harness never uses them for reconfirmation.

## 5. Batch gate (online probes) and the decision rule for agent output

k = 5 % of batch size, with a minimum such that probe expected items total at least 10 (illustrative). Count-based, because rates on 3–10 items are unstable: pass iff FN ≤ 1 and FP ≤ 1 across probe items and critical errors = 0.

Decision rule: a batch that passes is signal — its class-A proposals may be reconfirmed by the harness; class B stays proposed; class C is contested. A batch that fails is noise — `BatchRejected` with the probe counts as evidence; every proposal in the batch stays proposed and goes to the human queue. Agent output is never verified by the agent; the harness verifies only in class A and only on evidence already in the log.

Cold start (run sheet revision 4, to be confirmed): while the layer's golden set is below the probe minimum, the gate is not applicable, class A is decided by the comparator alone, and audit sampling of class-A reconfirmations is 100 %. The `compare` output prints this state explicitly; in the workshop this is the state of the v9 batch (golden set of four items, one section).

## 6. Human involvement — the three-class comparator

Deterministic steps: resolve lineage → canonicalize subject through the catalogue (unresolved = unexpected novelty, high-priority queue — `capitale.soglia` in the example) → look up (lineage, subject) in CurrentBeliefs → absent = B, equal value = A, different value = C → in class A within the same document version also require span IoU ≥ θ. On the six v9 proposals: `esercizi.consecutivi` 2 is A; `attivo.limite`, `ricavi.limite`, `dipendenti.limite` are C; `cessazione.esercizi` and `assemblea.termine` are B. Policies and Workflow layers are always B or C. Illustrative human cost on a 300-claim document, full review vs three-class rule: 300 vs 300 (no prior), 300 vs 60 (system-of-record prior, e.g. the firm's compliance register), 300 vs 50 (a new version of the text), 300 vs 12 (extractor v2). Declared cost: an initial human error is reconfirmed at every re-projection unless caught by sampling or superseded.

## 7. Types (TypeScript, `src/harness/`)

```ts
export interface GoldenItem<TExpected> {
  readonly inputArtifactId: string;         // for claims: the StructureVerified section id (e.g. c2 of v8)
  readonly expected: readonly TExpected[];
  readonly provenance: { readonly verifiedBy: string; readonly seq: number; readonly goldenSetVersion: string };
}
export interface ExpectedClaim {
  readonly subjectKey: SubjectKey;          // 'ricavi.limite'
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
  readonly tolerance?: { readonly iou: number };
}
export type PairOutcome = 'correct' | 'wrong-value' | 'wrong-provenance';
export interface AlignedPair { readonly expected: ExpectedClaim; readonly proposal?: Claim; readonly iou?: number; readonly outcome?: PairOutcome }
export interface Counts { readonly tp: number; readonly fp: number; readonly fn: number }
export interface Metrics extends Counts { readonly precision: number; readonly recall: number }
export type DriftCell = 'stable' | 'regression' | 'improvement' | 'stable-wrong';
export interface DriftRow { readonly subjectKey: SubjectKey; readonly v1: PairOutcome | 'missing'; readonly v2: PairOutcome | 'missing'; readonly cell: DriftCell; readonly critical: boolean }
export type CriticalClass = 'monetary' | 'count' | 'time-limit';   // critical subset: attivo/ricavi, dipendenti, esercizi/cessazione/termine
export interface PromotionResult { readonly promoted: boolean; readonly failedCriteria: readonly (1 | 2 | 3 | 4)[] }
export type GateResult =
  | { readonly kind: 'passed'; readonly counts: Counts }
  | { readonly kind: 'rejected'; readonly counts: Counts; readonly criticalErrors: number }
  | { readonly kind: 'not-applicable'; readonly goldenItems: number; readonly minimum: number };   // cold start
export type ComparatorClass = 'A' | 'B' | 'C' | 'UNEXPECTED';

export declare function goldenSet(log: readonly ClaimEvent[], layer: Layer, untilSeq: number,
  opts: { excludePromptExampleIds: readonly string[] }): readonly GoldenItem<ExpectedClaim>[];
export declare function evaluate(golden: readonly GoldenItem<ExpectedClaim>[], proposals: readonly Claim[],
  opts: { thetaIoU: number }): { pairs: readonly AlignedPair[]; metrics: Metrics };
export declare function drift(a: readonly AlignedPair[], b: readonly AlignedPair[]): readonly DriftRow[];
export declare function promotion(prev: Metrics, next: Metrics, rows: readonly DriftRow[], cfg: PromotionConfig): PromotionResult;
export declare function batchGate(probes: readonly AlignedPair[], cfg: GateConfig): GateResult;
export declare function compare(proposal: Claim, beliefs: ReadonlyMap<BeliefKey, Belief>, catalog: Catalog,
  opts: { thetaIoU: number }): { cls: ComparatorClass; evidence: Record<string, unknown> };
```

Every function above is pure and unit-tested; the agents are the only non-deterministic component and are fixture-replayed, so `npm run dry-run` is byte-identical across runs.
