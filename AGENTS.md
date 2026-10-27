# AGENTS.md — repository for "Documents Are Not Knowledge" (Codemotion Milan 2026)

You are building the TypeScript repository that Luca Bianchi runs live at Codemotion Milan on Wed 28 Oct 2026, 15:20–16:40 CET. It is an event-sourced knowledge-extraction domain with a deterministic evaluation harness, demonstrated on art. 2477 of the Italian Civil Code. It runs fully offline: every LLM call is replayed from a fixture. Work in phases (§14); each phase ends when its acceptance check passes and is committed.

## 0. Sources of truth (read before writing code)

| File | What it fixes |
| --- | --- |
| `workshop/en/00-running-example.md` | Every value, span, date, subject key, extractor output, class, label and script name of the example |
| `workshop/en/03-walkthrough-script.md` | The exact expected terminal output and tail lines of every live step, with sequence numbers |
| `workshop/en/04-domain-model-reference.md` | Entities and invariants (§1), ACLs (§2), event envelope (§3), event catalogue (§4), Claim lifecycle table (§5), projections (§6), TypeScript types (§7) |
| `workshop/en/05-harness-design.md` | Golden sets (§1), metrics (§2), drift (§3), promotion (§4), batch gate and cold start (§5), comparator (§6), TypeScript types (§7) |
| `fixtures/documents/` + its `README.md` | The three official texts, `manifest.json` (trees, content hashes, expected spans), `compliance-register.csv` |
| `fallback/segN/*.txt` | Expected outputs of every live step: the acceptance target (§12) |

`handbook/` and `podcast/` are not part of this repository: ignore any reference to them inside `workshop/` files (the equivalents are `04-domain-model-reference.md` and `05-harness-design.md`). Read-only: `fixtures/documents/`, `workshop/`, `.npmrc`, `.gitignore`. `fallback/` is read-only, except `fallback/seg1/` in phase F1 (rewritten from the real RAG outputs). If two sources disagree, `00-running-example.md` wins for values, `03-walkthrough-script.md` for output format; leave a `TODO(luca):` comment and continue.

## 1. Non-negotiable constraints

1. **Vocabulary.** `Document`, `DocumentVersion`, `Lineage`, `Span`, `Claim`, `Entity`, `Policy`, `WorkflowStep`; layers `source`, `structure`, `claims`, `entities`, `policies`, `workflow`; states `proposed`, `verified`, `contested`, `superseded`. Never "fact", "atom", "ontology", "knowledge graph", "knowledge map". "Agent" means only an LLM-backed extractor; the harness and the reviewer are processes.
2. **Agents never verify.** `ClaimVerified` is produced only by the reviewer CLI (actor human), the harness in class A (actor harness) or the prior importer (actor import). `src/agents/**` must not import decision-event constructors; a test asserts it.
3. **The log is the only state.** One append-only JSONL file, `out/events.jsonl`. Every projection is a fold over it, written to `out/projections/`, droppable and rebuildable. No database.
4. **Deterministic end to end.** Everything except the agents is a pure function with unit tests; agents are fixture-replayed. `occurredAt` comes from a fixed clock (`2026-10-28T13:37:00Z` + seq seconds) unless `DNK_CLOCK=real`. Two runs of `npm run dry-run` produce byte-identical output.
5. **Offline.** No network at runtime. The fixture replayer throws if a request has no recorded response; it never calls a model.
6. **No invented numbers.** All thresholds and rates live in `src/config.ts` under `// illustrative — not a benchmark`.
7. **One language on screen.** Every live command is `npm run <script>` with fixed arguments (§11). No Makefile, no shell scripts on stage.
8. **No frameworks** for the log, the agents or the CLI beyond `zod` for schemas and `tsx` to run TypeScript; `vitest` for tests. The mechanism must stay small and readable.

## 2. Layout

```
src/
  config.ts          illustrative thresholds, golden cut-offs, clock
  domain/            ids, DocumentVersion, Span, Claim, NormalizedValue, transition(), invariants
  events/            envelope, fact/decision schemas (zod; evidence required on decisions, forbidden on facts), eventId, append, read, fold
  catalog/           subject catalogue (§4 of 00-running-example), synonyms, critical classes, normalizer, labels (§13)
  acl/               structureToClaims.ts (reference ACL); sourceToStructure.ts
  agents/            fixture replayer; structure, claims, oneshot extractors (entities/policies/workflow not needed live)
  harness/           beliefs/ compare/ prior/ sampling/ golden/ eval/
  projections/       currentBeliefs, claimsByDocumentVersion, conflictQueue, reviewQueue, timeline, beliefsAt
  processes/         compare (harness process), review (reviewer CLI)
  tools/             one file per npm script (§11)
  rag-baseline/      local chunk/vector/retrieve baseline for segment 1
fixtures/
  documents/         given (read-only)
  llm/<extractor>@<version>/<inputHash>.json   recorded responses (you author them, §6)
  review/decisions.json                        scripted reviewer decisions (§8)
  layers-4-6/excerpt.jsonl                     pre-computed entities/policies/workflow events (§9)
fallback/seg1..seg6/  expected outputs (§12)
test/
out/                 runtime only, git-ignored
```

## 3. Domain and events

Implement `workshop/en/04-domain-model-reference.md` §1–§7 literally, including its TypeScript types (add `integer` and `reference` to `NormalizedValue` as written there).

- `claimId` = SHA-256 (16 hex) of (documentId, version, subjectKey, hash of normalized value). `eventId` = SHA-256 (16 hex) of (producer, inputArtifactId, extractorVersion, eventType, aggregateId). Document the derivation in a comment.
- Spans are half-open `[start, end)` in absolute character offsets (JavaScript string indices). Extractors return section-local spans; the Claims context adds the unit's base offset.
- Envelope: `eventId, seq, aggregateVersion, type, layer, aggregateId, actor, causationId, correlationId, occurredAt, payload, evidence?`. Actor kinds `human | agent | harness | import | process`; agent actors carry `modelId`, `promptVersion`, `extractorVersion`. `process` is the actor of `LogInitialised`, `DocumentVersionIngested`, `ACLRejected`.
- `append` returns the existing seq for a duplicate `eventId` and never throws on duplicates.
- `transition(state, event)` implements the table of `04-domain-model-reference.md` §5, including the two harness exceptions (class-A verify; identical-value reconfirmation-chain supersede).
- Do not emit `CursorAdvanced` in the workshop flow (it would shift every sequence number); keep the type in the catalogue.
- `log:init` emits `LogInitialised` (seq 1) and `ExtractorVersionPromoted(claims@v1, actor=human(luca), evidence "initial version, no predecessor")` (seq 2).

## 4. Three-class rule (harness)

Implement `workshop/en/05-harness-design.md` §6 in four named modules: `harness/beliefs/currentBeliefs.ts` (fold keyed `(lineageId, subjectKey)`, throws in `build` if two verified non-superseded claims share a key, message says the comparator is at fault), `harness/compare/comparator.ts` (pure: `(proposal, beliefs, catalog, opts) → {cls: 'A'|'B'|'C'|'UNEXPECTED', evidence}`), `harness/prior/importSystemOfRecord.ts` (reads `compliance-register.csv`; not used live; tested), `harness/sampling/auditPolicy.ts` (5 % human-rooted, 20 % import-rooted, 100 % in cold start; deterministic by claim id).

Class A: emit `ClaimVerified(actor=harness(compare), evidence {reconfirmedBelief, batchId, probe:'not-applicable'})` on the new claim, then `ClaimSuperseded(actor=harness(compare), successor, evidence {reason:'reconfirmation-chain'})` on the reconfirmed one. Class C: `ClaimContested(actor=harness(compare))` with the conflicting claim and both values. Class B and UNEXPECTED: no event, the claim stays proposed in the ReviewQueue (UNEXPECTED flagged high priority). Policies and Workflow never take the class-A path (hard-coded, tested).

Structure reconfirmation: a `StructureProposed` tree with the same node paths and types as a verified tree of the same lineage is class A → `StructureVerified(actor=harness(compare))`, emitted by `extract:v9` before the claims units are produced. Across versions only paths and types are compared.

Cold-start gate (`05-harness-design.md` §5): while a layer's golden set holds fewer expected items than the probe minimum (10, illustrative), the gate returns `not-applicable`, class A is decided by the comparator alone, class-A audit sampling is 100 %, and `compare` prints the line shown in `fallback/seg3/compare.txt`. Applies to Structure and Claims.

## 5. Harness: golden sets, eval, drift, promotion

Implement `workshop/en/05-harness-design.md` §1–§5 literally.

- `golden/query.ts`: pure over the log slice; only human-actor decision events of the layer up to `untilSeq`; harness- and import-actor decisions excluded; prompt-example ids excluded. A golden item = one verified structure section (input) + its expected claims. Named cut-offs in `config.ts`: `g1 = 15` (end of segment 2). `golden:claims` without cut-off uses the current end of the log.
- `eval/`: align by subject key (highest IoU if several), classify (correct / wrong value / wrong provenance with θ = 0.8), count (incorrect pair = FP + FN; unpaired expected = FN; unpaired proposal = FP), micro-average. `eval` appends `EvalCompleted` (seq 47 for v1, 48 for v2 in the walkthrough).
- `eval/drift.ts`: per-item matrix + noise-introduced + provenance-drift. `eval/promotion.ts`: the four criteria; v2 fails criteria 1 and 3; nothing is emitted when not promoted. `eval/batchGate.ts`: count-based, `BatchRejected` on failure, `not-applicable` in cold start.
- Critical classes: `monetary` (attivo, ricavi), `count` (dipendenti), `time-limit` (esercizi, cessazione, assemblea.termine).
- Worked numbers (must come out exactly, put them in the end-to-end test): claims@v1 on v8 c2 → TP 2, FP 2, FN 2, P 0.50, R 0.50, attivo IoU 62/64 = 0.97; claims@v2 → TP 3, FP 2, FN 1, P 0.60, R 0.75, regression on `ricavi.limite`, criteria 1 and 3 failed.

## 6. LLM fixtures (you author them)

A fixture is `fixtures/llm/<extractor>@<version>/<inputHash>.json` = `{ extractor, version, modelId, promptVersion, inputHash, request, response }`. `inputHash` = SHA-256 of the extraction unit (documentId, version, path, text). The replayer computes the hash, loads the file, validates the response with zod, and throws `FixtureMissing` otherwise. The responses are authored to the specification in `00-running-example.md` §6, not recorded from live calls; set `modelId` to a placeholder `claude-<version>` and state this in the README.

Required fixtures:
- `structure@v1` on v8 and on v9: the trees of `manifest.json` (same paths and types).
- `claims@v1` on v8 c2: attivo 2,000,000 EUR at local [278,342); ricavi 2,000,000 EUR at [347,406); esercizi.consecutivi 3 at [216,244); `capitale.soglia` enum "minimo s.p.a." at [0,79). Nothing for dipendenti.
- `claims@v1` on v9 c2, c3, c5: the six correct claims of `00-running-example.md` §6 (esercizi 2, attivo 4 M, ricavi 4 M, dipendenti 20 from c2; cessazione 3 from c3; assemblea.termine 30 days from c5).
- `claims@v2` on v8 c2: attivo 2 M at [280,342); esercizi 2; dipendenti 10; ricavi **2,000 EUR** (the normalization bug); unexpected `cessazione.esercizi` 3 anchored at [216,244). On v9 c2, c3, c5: the six correct claims.
- `oneshot@v1` on v8 c2 (segment 1): the JSON blob of `fallback/seg1/rag-extract.txt`.

## 7. ACL Structure → Claims

`acl/structureToClaims.ts` exactly as `04-domain-model-reference.md` §2: accept only `StructureVerified`; one extraction unit per node of type `comma` (never `note` or `index`); unit = documentId, version, path, text, base offset; stamp causation = the `StructureVerified` event; record `ACLRejected` (no throw) on a malformed tree. Which commi are extracted is a script argument (`--section c2` for v8, `--section c2,c3,c5` for v9).

## 8. Reviewer CLI

`npm run review` is guided, not free typing: it determines from the log which stage is pending (structure tree of v8 → the v8 claim proposals → the v9 contested claims), loads the scripted decisions of that stage from `fixtures/review/decisions.json`, and shows each decision with its evidence (span text, catalogue lookup, conflicting values and validity periods) pre-filled. Enter confirms, `n` skips, `e` edits the note. `npm run review:auto` (and dry-run) applies the stage without waiting. The decisions are those of `03-walkthrough-script.md` (segment 2 table, segment 3 third call): verify attivo and ricavi; leave esercizi 3 and capitale.soglia proposed; add esercizi 2 and dipendenti 10 (human `ClaimProposed` then `ClaimVerified`); later verify the three v9 claims and supersede attivo 2 M, ricavi 2 M, dipendenti 10 with them. Actor `human(luca)`; notes as in the script.

## 9. Layers 4–6 excerpt

`fixtures/layers-4-6/excerpt.jsonl`: hand-authored events for Entities, the two Policies `nomina-obbligatoria@v8` / `@v9` and the workflow `obbligo-nomina` (`00-running-example.md` §9). `npm run layers-4-6` prints it through the tail formatter with seq `—`; it is never appended to the log.

## 10. Output formats

Every printed output matches the corresponding `fallback/` file line by line: same columns, same order, same wording, same numbers. Display ids (§13) are used everywhere on screen; hashes appear only inside the JSON printed by `show`. Number format on screen: `2,000,000 EUR`, `0.50`, `0.97`. Every script prints at most one screenful (~30 lines). Tail line: `NNNN · Type · actor.kind(actor.id) · layer · label · ← ev-NNNN  evidence: …`, `★` instead of `·` after the seq for decision events, evidence ≤ 60 characters.

## 11. npm scripts

| Script | Segment | Expected output |
| --- | --- | --- |
| `rag:index` | pre-talk | — |
| `rag:query` | 1 | `fallback/seg1/rag-query.txt` |
| `rag:delete-v8` (then `rag:query`) | 1 | `fallback/seg1/rag-after-delete.txt` |
| `rag:extract-c2` | 1 | `fallback/seg1/rag-extract.txt` |
| `log:reset` | pre-talk | removes `out/` |
| `log:init` | 2 | `fallback/seg2/log-init.txt` |
| `ingest:v8` | 2 | `fallback/seg2/ingest-v8.txt` |
| `extract:structure-v8` | 2 | `fallback/seg2/extract-structure-v8.txt` |
| `review` / `review:auto` | 2, 3 | `fallback/seg2/review-structure.txt`, `review-claims.txt`, `fallback/seg3/review-conflicts.txt` |
| `extract:claims-v8` | 2 | `fallback/seg2/extract-claims-v8.txt` |
| `show:ricavi-v8` (generic `show -- --event <ref>`) | 2 | `fallback/seg2/show-ricavi-v8.txt` |
| `ingest:v9`, `extract:v9` | 3 | `fallback/seg3/ingest-extract-v9.txt` |
| `compare` | 3 | `fallback/seg3/compare.txt` |
| `layers-4-6` | 3 | `fallback/seg3/layers-4-6.txt` |
| `log:cat` | 4 | `fallback/seg4/log-cat.txt` |
| `projections:drop`, `projections:build` | 4 | `fallback/seg4/projections-rebuilt.txt` |
| `replay:claims-v2` | 4 | `fallback/seg4/replay-claims-v2.txt` |
| `projections:diff` | 4 | `fallback/seg4/projections-diff.txt` |
| `beliefs:at-2019-04-30`, `beliefs` | 4 | `fallback/seg4/beliefs-at-2019-04-30.txt` (valid time; `--seq <n>` = transaction time) |
| `golden:claims-until-seg2`, `golden:claims` | 5 | `fallback/seg5/golden-claims.txt` |
| `eval:claims-v1` | 5 | `fallback/seg5/eval-v1.txt` |
| `eval:claims-v2-summary` | 5 | `fallback/seg5/eval-v2-summary.txt` |
| `drift:v1-v2` | 5 | `fallback/seg5/drift-v1-v2.txt` |
| `ask:ricavi-2019-04-30`, `ask:ricavi` | 6 | `fallback/seg6/ask.txt` |
| `tail` | always | `tail -f` of `out/events.jsonl` through the formatter |
| `dry-run` | pre-talk | runs everything in order from `log:reset`, writes outputs to `out/dry-run/`, diffs against `fallback/` |
| `test` | pre-talk | vitest |

The log snapshots `fallback/seg2/log-after-extract.txt`, `log-after-verify.txt`, `fallback/seg3/log-after-extract-v9.txt`, `log-after-compare.txt` are `log:cat` at those points.

`seg:1` … `seg:6` run the live steps of a segment in order (`src/tools/segments.ts`): each step is announced with its command and why it matters, runs on Enter (`s` skips, `q` quits) and is followed by the events it appended; `-- --yes` runs without asking (`review` becomes `review:auto`). A segment whose phase is not built yet prints "not implemented yet". Every script started through npm first prints one narration line on stderr (`src/tools/narration.ts`), so stdout stays byte-identical with `fallback/`; `DNK_NARRATE=0` silences it. `viewer` serves a read-only browser view of the log on http://localhost:4477 at every tag; a tab whose phase is not built yet names the tag that adds it.

## 12. Acceptance and the composition of fallback files

Each `fallback/segN/<step>.txt` is the stdout of one or more scripts followed by the tail lines (formatted as in §10) of the events those scripts appended, in run order. `review:auto` prints nothing, so its files contain only tail lines. `dry-run` writes the same composition to `out/dry-run/` and diffs it against `fallback/`:

| Fallback file | Scripts, in order |
| --- | --- |
| seg1/rag-query.txt | rag:query |
| seg1/rag-after-delete.txt | rag:delete-v8, rag:query |
| seg1/rag-extract.txt | rag:extract-c2 |
| seg2/log-init.txt | log:init |
| seg2/ingest-v8.txt | ingest:v8 |
| seg2/extract-structure-v8.txt | extract:structure-v8 |
| seg2/review-structure.txt | review:auto (stage 1) |
| seg2/extract-claims-v8.txt | extract:claims-v8 |
| seg2/show-ricavi-v8.txt | show:ricavi-v8 |
| seg2/review-claims.txt | review:auto (stage 2) |
| seg2/log-after-extract.txt, log-after-verify.txt | log:cat after extract:claims-v8 / after stage 2 |
| seg3/ingest-extract-v9.txt | ingest:v9, extract:v9 |
| seg3/log-after-extract-v9.txt | log:cat after extract:v9 |
| seg3/compare.txt | compare |
| seg3/review-conflicts.txt | review:auto (stage 3) |
| seg3/log-after-compare.txt | log:cat after stage 3 |
| seg3/layers-4-6.txt | layers-4-6 |
| seg4/log-cat.txt | log:cat |
| seg4/projections-rebuilt.txt | projections:drop, projections:build |
| seg4/replay-claims-v2.txt | replay:claims-v2 |
| seg4/projections-diff.txt | projections:diff |
| seg4/beliefs-at-2019-04-30.txt | beliefs:at-2019-04-30, beliefs |
| seg5/golden-claims.txt | golden:claims-until-seg2, golden:claims |
| seg5/eval-v1.txt | eval:claims-v1 |
| seg5/eval-v2-summary.txt | eval:claims-v2-summary |
| seg5/drift-v1-v2.txt | drift:v1-v2 |
| seg6/ask.txt | ask:ricavi-2019-04-30, ask:ricavi |

A step is done when its composed output equals its file, except values that cannot be known in advance (RAG similarity scores, id hashes inside `show`). In phase F1, `fallback/seg1/` is rewritten from the real RAG outputs; from then on every comparison is byte-exact except id hashes inside `show`. In phase F2, `dry-run --update` must leave `fallback/` unchanged: a difference is a bug in the code, not in the file.

## 13. Display ids (labels)

Events are shown as `ev-<seq, 4 digits>`; causation is shown as the `ev-` of the causing event. Claims carry a `label` in the payload, computed by `catalog/labels.ts` from this table (fallback `clm-<first 8 hex of claimId>`):

| Producer | Version | Subject = value | Label |
| --- | --- | --- | --- |
| claims@v1 | v8 | attivo 2 M / ricavi 2 M / esercizi 3 / capitale.soglia | `clm-attivo2m` / `clm-ricavi2m` / `clm-eserc3` / `clm-capitale` |
| human | v8 | esercizi 2 / dipendenti 10 | `clm-eserc2` / `clm-dip10` |
| claims@v1 | v9 | esercizi 2 / attivo 4 M / ricavi 4 M / dipendenti 20 / cessazione 3 / termine 30 | `clm-eserc2b` / `clm-attivo4m` / `clm-ricavi4m` / `clm-dip20` / `clm-cess3` / `clm-term30` |
| claims@v2 | v8 | attivo 2 M / esercizi 2 / dipendenti 10 / ricavi 2,000 / cessazione 3 | `clm-v2-attivo2m` / `clm-v2-eserc2` / `clm-v2-dip10` / `clm-v2-ricavi2k` / `clm-v2-cess3a` |
| claims@v2 | v9 | the six | `clm-v2-eserc2b`, `clm-v2-attivo4m`, `clm-v2-ricavi4m`, `clm-v2-dip20`, `clm-v2-cess3`, `clm-v2-term30` |

Trees are `tree-v8`, `tree-v9`; the segment 3 batch is `btc-v9-01`; golden sets `claims@g1`, `claims@g2`; correlation ids `run-v8-c2-01` style.

## 14. Phases and tags

Build in this order. Each phase ends with one commit on `main`; the human then creates an annotated tag on that commit. The tags are the walkthrough: at the first live slide of each segment the speaker runs `git checkout ws-segN`, so tag N must contain everything segments 1..N run and nothing that a later segment introduces. `out/` is git-ignored, so the event log and the projections survive every checkout.

| Order | Phase | Scope | Acceptance | Tag |
| --- | --- | --- | --- | --- |
| 1 | A | scaffold, config, domain, events, log, append, transition, `log:init`, `log:reset`, `tail`, `log:cat`, unit tests | `npm test` green; `log:init` + `log:cat` = first two lines of `fallback/seg2/log-after-extract.txt` | (`ws_step1_end`) |
| 2 | F1 | rag-baseline, `rag:index`, `rag:query`, `rag:delete-v8`, `rag:extract-c2`, fixture `oneshot@v1` | `rag:query` top 3 = the lettera c) passages of v7, v8, v9; `fallback/seg1/` rewritten with the real outputs | `ws-seg1` |
| 3 | B | catalog, normalizer, labels, replayer, fixtures for v8, ACL, structure/claims extractors, reviewer CLI, segment 2 scripts, `show` | `log:cat` after segment 2 = `fallback/seg2/log-after-verify.txt` (15 events); `show:ricavi-v8` = its fallback | `ws-seg2` |
| 4 | C | beliefs, comparator, gate, sampling, prior importer, fixtures for v9, segment 3 scripts, `layers-4-6` | `log:cat` = `fallback/seg3/log-after-compare.txt` (35 events); `compare` = its fallback | `ws-seg3` |
| 5 | D | projections, drop/build, replay, diff, beliefs `--at` / `--seq`, fixtures for claims@v2 | seg4 fallbacks; 46 events after replay | `ws-seg4` |
| 6 | E1 | golden, eval, drift, promotion, batch gate | seg5 fallbacks; worked numbers exact; 48 events | `ws-seg5` |
| 7 | E2 | `ask` with the consumption policy | `fallback/seg6/ask.txt`; the log stays at 48 | `ws-seg6` |
| 8 | F2 | `dry-run` (+ `--update`), README, end-to-end test, import-boundary test | `npm run dry-run` OK three times in a row; `npm test` green; `dry-run --update` changes nothing in `fallback/` | `ws-final` |

Rules that keep the tags usable on stage:
- Every npm script name of §11 is declared from phase A; a script whose phase is not yet built prints "not implemented yet" and exits 1. Never rename a script in a later phase.
- All dependencies are added in phase A; later phases do not change `package-lock.json`, so no `npm ci` is needed between checkouts.
- Fallback files of a segment are final when that segment's tag is created; later phases must not change them.

## 15. README (phase F2)

Sections: what the repository demonstrates (three sentences); the three-class rule (table, comparator steps, illustrative time comparison 300 vs 300 / 60 / 50 / 12, the hidden cost); golden sets are a query over the log (definition, four properties, two exclusions, offline vs online); event catalogue; how to run the walkthrough (scripts in order) and `dry-run`; what is illustrative (every threshold and rate, and the fact that extractor fixtures are authored to specification).
