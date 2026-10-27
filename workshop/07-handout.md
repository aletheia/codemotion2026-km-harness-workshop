# Documents Are Not Knowledge — one-page handout

Luca Bianchi · Codemotion Milan, 28 Oct 2026 · Repository: `<repository URL — TBD>` · Handbook: `handbook/` in the repository · Stack: TypeScript (Node ≥ 20), offline, every LLM call replayed from fixtures.

**The idea in one line.** A knowledge base is a replayable projection over an immutable log of events about Claims — assertions with identity, span-level provenance and a lifecycle — not a database to be migrated. Agents propose; the harness verifies only on evidence already in the log; humans decide conflicts and novelty.

**Running example.** Art. 2477 c.c. (appointment of the control body in an s.r.l.), Normattiva versions 7, 8 and 9: in force 21 Aug 2014, 16 Mar 2019 (D.Lgs. 14/2019: attivo 2 M, ricavi 2 M, 10 dipendenti) and 18 Jun 2019 (L. 55/2019: 4 M, 4 M, 20). One lineage, three versions, real conflicts and real dates; the texts are in `fixtures/documents/`.

## Entities

| Entity | Identity | Invariant |
| --- | --- | --- |
| Lineage / DocumentVersion | lineage id (`cc-art2477`); (version, content hash, effective date, kind) | a version is immutable; one lineage per version |
| Span (value) | document id, version, `[start, end)` absolute | never exists without a Claim |
| Claim (aggregate root) | hash(document id, version, subject key, normalized value) — subject keys such as `ricavi.limite`, `esercizi.consecutivi` | ≥ 1 Span; state ∈ {proposed, verified, contested, superseded}; verified is immutable; superseded has a successor; ≤ 1 verified non-superseded per (lineage, subject key) |
| Entity | catalogue id (`organo-di-controllo`, `revisore`, `assemblea` …) | ≥ 1 verified Claim mentions it |
| Policy | policy id (`nomina-obbligatoria`) | condition / effect / exception, each on verified Claims; applicability period |
| WorkflowStep | step id + position (`obbligo-nomina`) | preconditions on verified Policies; acyclic; executable on a golden input |

## Six layers (bounded contexts), each consuming only the previous layer's verified events through an ACL

source → structure → claims → entities → policies → executable workflow. The ACL filters (Verified only), translates (e.g. comma-local spans → absolute coordinates), stamps causation, records `ACLRejected`. Without it, an upstream extractor change silently changes the downstream prompt: two coupled versions, unattributable drift.

## Event catalogue

| Family | Events | Producer |
| --- | --- | --- |
| fact | `LogInitialised`, `DocumentVersionIngested`, `ACLRejected`, `CursorAdvanced` | process / import |
| fact | `StructureProposed`, `ClaimProposed`, `EntityProposed`, `PolicyProposed`, `WorkflowStepProposed` | agent (model id, prompt version, extractor version); `ClaimProposed` also human |
| decision (evidence required) | `StructureVerified`, `ClaimVerified`, `EntityResolved` | human; harness in class A only |
| decision | `ClaimContested`, `PolicyContested` | harness |
| decision | `ClaimSuperseded`, `EntityMerged`, `PolicyVerified`, `PolicySuperseded`, `WorkflowStepVerified`, `WorkflowStepSuperseded` | human (harness only for identical-value reconfirmation chains) |
| decision | `EvalCompleted`, `ExtractorVersionPromoted`, `BatchRejected` | harness |

Envelope: `eventId` (deterministic = idempotency key) · `seq` · `aggregateVersion` · `type` · `layer` · `aggregateId` · `actor` · `causationId` · `correlationId` · `occurredAt` · `payload` · `evidence` (decisions only).

## Lifecycle and the three-class rule

proposed → verified (human; harness in class A) · proposed/verified → contested (harness) · contested → verified | superseded (human) · verified → superseded (human; harness for identical-value reconfirmation). Comparator (deterministic code) against CurrentBeliefs keyed (lineage, subject key): **A** same value → harness reconfirms with evidence = belief id + batch id (`esercizi.consecutivi` 2 in both 2019 texts) · **B** no belief → stays proposed, human queue (`cessazione.esercizi`, `assemblea.termine`) · **C** different value → contested, human resolves (`ricavi.limite` 2 M → 4 M). Policies and Workflow are always B or C.

## Projections (folds over the log; drop and rebuild)

CurrentBeliefs · ClaimsByDocumentVersion · ConflictQueue · ReviewQueue · Timeline · BeliefsAtDate (valid time by effective date: `--at 2019-04-30` → the 16 March text; transaction time by sequence) · one candidate projection per extractor version until promoted.

## Harness

Golden set of a layer = all human decision events of that layer up to a cut-off sequence (excluding harness/import decisions and prompt examples). Claims metrics: align by subject key; correct iff value equal and span IoU ≥ θ (0.8, illustrative); incorrect pair = FP + FN; micro-averaged P/R. Drift per item: stable / regression / improvement / stable-wrong. Promotion iff P ≥ threshold, R ≥ R(prev) − ε, zero regressions on the critical subset (monetary, count, time-limit), provenance errors ≤ 2 %. Batch gate on inserted probes, count-based: ≤ 1 FN, ≤ 1 FP, zero critical; fail → `BatchRejected`, everything stays proposed. All numbers illustrative.

## Three decisions and what each costs

| Decision | Cost |
| --- | --- |
| Explicit contested state, resolved by a human (not merge / CRDT / last-writer-wins) | availability latency and a review queue |
| The log is the record; the knowledge base is a projection (not a mutable store with change propagation) | storage grows with events; re-projection compute on extractor change |
| Per-layer golden sets derived from the log (not an end-to-end set built on the side) | freezing and versioning per layer; a hand-maintained subject catalogue |

Walkthrough, in order (npm scripts, arguments fixed per step): `npm run log:init` · `ingest:v8` · `extract:structure-v8` · `review` · `extract:claims-v8` · `ingest:v9` · `extract:v9` · `compare` · `log:cat` · `projections:drop` / `projections:build` · `replay:claims-v2` · `projections:diff` · `beliefs:at-2019-04-30` · `golden:claims` · `eval:claims-v1` · `eval:claims-v2-summary` · `drift:v1-v2` · `ask:ricavi-2019-04-30`. `npm run dry-run` reproduces the whole session offline; `npm test` runs the unit and end-to-end tests.
