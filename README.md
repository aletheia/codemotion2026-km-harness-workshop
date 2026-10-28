# Documents Are Not Knowledge — workshop repository

Codemotion Milan 2026 · Wed 28 Oct 2026, 15:20–16:40 CET · Luca Bianchi.

## What this repository demonstrates

Knowledge extraction from a legal text (art. 2477 of the Italian Civil Code, in force as v7, v8 and v9) as an event-sourced domain: documents become `DocumentVersion`s, `Span`s and `Claim`s through six layers (`source`, `structure`, `claims`, `entities`, `policies`, `workflow`), and every proposal, verification, contest and supersession is an event in one append-only log, `out/events.jsonl`, of which every projection is a fold. LLM-backed agents only ever propose; claims are verified by a human, by an importer of a system-of-record prior, or by a deterministic harness that reconfirms what a human already verified. The harness evaluates extractor versions against golden sets that are a query over the log, so the whole run — including the evaluation — is deterministic, offline and reproducible byte for byte.

## The three-class rule

Each agent proposal is classified by the comparator against `CurrentBeliefs` (verified, non-superseded claims keyed by lineage and subject key):

| Class | Condition | Who decides | Events |
| --- | --- | --- | --- |
| A — reconfirmation | human-rooted belief on the same subject with the same normalized value | harness | `ClaimVerified(actor=harness, evidence = belief + batch + probe)`, then `ClaimSuperseded(reason: reconfirmation-chain)` on the reconfirmed claim |
| B — novelty | no belief on the subject | human | none: stays `proposed` in the ReviewQueue |
| C — conflict | belief with a different value | harness contests, human resolves | `ClaimContested`, then human `ClaimVerified` / `ClaimSuperseded` |

Comparator steps (`src/harness/compare/comparator.ts`, pure code, never a model):

1. Resolve the lineage of the proposal.
2. Canonicalize the subject through the catalogue; an unresolved subject is an unexpected novelty (`UNEXPECTED`, high-priority queue — `capitale.soglia` in the example).
3. Look up (lineage, subject key) in `CurrentBeliefs`: absent → B; equal normalized value → A; different value → C.
4. For A within the same document version, also require span IoU ≥ θ.

Policies and Workflow never take the class-A path. Class-A reconfirmations are sampled for human audit (5 %; 20 % when the belief is import-rooted; 100 % during cold start, while the golden set is below the probe minimum — the state `npm run compare` prints in segment 3).

Human cost on a 300-claim document, full review vs three-class rule (illustrative):

| Situation | Full review | Three-class rule |
| --- | --- | --- |
| First ingestion, no prior | 300 | 300 |
| First ingestion with a system-of-record prior (240 reconfirm, 40 novel, 20 contradict) | 300 | 60 |
| New version of the text: 250 unchanged, 30 changed, 20 new | 300 | 50 |
| Extractor v2 on the existing corpus, 12 disagreements with v1 | 300 | 12 |

The hidden cost: class A assumes the first human was right. An initial human error is reconfirmed at every re-projection unless audit sampling or a later supersession catches it.

## Golden sets are a query over the log

Golden set of layer L at version k = all decision events of layer L whose actor is human, up to the cut-off sequence `untilSeq` (`src/harness/golden/query.ts`). The same query on the same log slice returns the same set; the version is the pair (layer, untilSeq). In the walkthrough, `claims@g1` (seq ≤ 15, end of segment 2) holds four items and `claims@g2` (end of the log) holds seven.

Four properties a hand-built evaluation set does not have:

1. Produced as a side effect of operation: every human decision is a labelled example.
2. Per layer by construction: every decision event belongs to a layer.
3. Follows the real distribution: it grows with the corpus.
4. Contains the hardest cases: conflict resolutions, which an external labeller never produces because the labeller never saw the conflict.

Two exclusions:

- Harness- and import-actor decisions: they derive from human decisions already in the set, so including them would be circular.
- Items used as examples in the extractor's prompt (`promptExampleIds` in `src/config.ts`): otherwise the eval measures the prompt's recall, not the extractor's.

Offline vs online:

| Mode | Input | Decides | Trigger |
| --- | --- | --- | --- |
| Offline | the whole golden set | promotion of an extractor version (four criteria, `src/harness/eval/promotion.ts`) | every extractor or prompt change |
| Online (probes) | a subset inserted in each production batch | the batch is signal or noise (`BatchRejected` on failure, `src/harness/eval/batchGate.ts`) | every batch |

## Event catalogue

Fact events carry no evidence; decision events must (`src/events/schema.ts`). Agents produce only facts.

| Event | Family | Layer | Producer |
| --- | --- | --- | --- |
| `LogInitialised` | fact | source | process |
| `DocumentVersionIngested` | fact | source | process (import for a system of record) |
| `StructureProposed` | fact | structure | agent |
| `StructureVerified` | decision | structure | human; harness (class A, same paths and types) |
| `ClaimProposed` | fact | claims | agent; human (manual addition) |
| `ClaimVerified` | decision | claims | human; harness (class A only); import (priors) |
| `ClaimContested` | decision | claims | harness |
| `ClaimSuperseded` | decision | claims | human; harness (identical-value reconfirmation chain) |
| `EntityProposed` | fact | entities | agent |
| `EntityResolved` | decision | entities | human; harness |
| `EntityMerged` | decision | entities | human |
| `PolicyProposed` | fact | policies | agent |
| `PolicyVerified` / `PolicyContested` / `PolicySuperseded` | decision | policies | human (verify, supersede); harness (contest) |
| `WorkflowStepProposed` | fact | workflow | agent |
| `WorkflowStepVerified` / `WorkflowStepSuperseded` | decision | workflow | human |
| `ACLRejected` | fact | any | process |
| `CursorAdvanced` | fact | any | agent, process (not emitted in the walkthrough) |
| `EvalCompleted` | decision | harness | harness |
| `ExtractorVersionPromoted` | decision | harness | harness; human (bootstrap of the initial version) |
| `BatchRejected` | decision | harness | harness |

Full payloads and the Claim lifecycle: `workshop/en/04-domain-model-reference.md` §4–§5.

## How to run

Node ≥ 20, then `npm ci`. Everything runs offline; every LLM call is replayed from `fixtures/llm/`.

Before the talk: `npm run log:reset`, `npm run rag:index`, and `npm run tail` in a second terminal.

| Segment | Scripts, in order |
| --- | --- |
| 1 | `rag:query` · `rag:delete-v8` · `rag:query` · `rag:extract-c2` |
| 2 | `log:init` · `ingest:v8` · `extract:structure-v8` · `review` · `extract:claims-v8` · `show:ricavi-v8` · `review` |
| 3 | `ingest:v9` · `extract:v9` · `compare` · `review` · `layers-4-6` |
| 4 | `log:cat` · `projections:drop` · `projections:build` · `replay:claims-v2` · `projections:diff` · `beliefs:at-2019-04-30` · `beliefs` |
| 5 | `golden:claims-until-seg2` · `golden:claims` · `eval:claims-v1` · `eval:claims-v2-summary` · `drift:v1-v2` |
| 6 | `ask:ricavi-2019-04-30` · `ask:ricavi` |

Each segment starts from its tag: `git checkout ws-seg1` … `ws-seg6`. `out/` is git-ignored, so the log survives the checkouts. `npm run review` is guided (Enter confirms, `n` skips, `e` edits the note); `npm run review:auto` applies the pending stage without waiting.

To follow along, each segment has one command: `npm run seg:1` … `npm run seg:6` runs that segment's scripts in order, says before each step what it shows and why, waits for Enter (`s` skips, `q` quits) and prints the events the step appended to the log; `npm run seg:N -- --yes` runs without asking. Every script started through npm prints one narration line on stderr before its output (`DNK_NARRATE=0` silences it; `dry-run` compares stdout only). `npm run viewer` serves a read-only browser view of the log, the claims, the RAG chunks and the dependencies between the layers on http://localhost:4477; it re-reads the log on every request, so it follows the run. On an earlier tag a tab whose phase is not built yet names the tag that adds it.

`npm run dry-run` runs the whole walkthrough from `log:reset` (with `review:auto`), writes each step's output to `out/dry-run/<segment>/<name>.txt` and compares it with `fallback/`; it prints `dry-run: OK (byte-identical with fallback/)` or the first differing file and line. `npm run dry-run -- --update` overwrites the differing `fallback/` files with the real outputs. The comparison is byte-exact except the event-id hash and `occurredAt` inside `show` (the fallback carries the illustrative values of the walkthrough script). `npm test` runs the unit tests, the end-to-end dry-run in a temporary `out/`, and the check that no file under `src/agents/` imports a decision-event constructor.

## What is illustrative

- Every threshold and rate in `src/config.ts` (θ = 0.8, the promotion thresholds, the probe rate and minimum, the batch-gate counts, the audit sampling rates, the golden cut-off): none is a benchmark.
- The 300 / 60 / 50 / 12 cost table above.
- The extractor fixtures in `fixtures/llm/` are authored to the specification of `workshop/en/00-running-example.md` §6, not recorded from live model calls; their `modelId` is a placeholder (`claude-<version>`).
- The reviewer's decisions (`fixtures/review/decisions.json`) and the layers 4–6 excerpt (`fixtures/layers-4-6/excerpt.jsonl`) are scripted.

The dates, acts, texts and amounts of art. 2477 c.c. are not illustrative: they are the official texts in `fixtures/documents/`.
