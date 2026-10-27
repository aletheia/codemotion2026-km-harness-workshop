# Slide storytelling — "Documents Are Not Knowledge: Modelling Extraction as an Event-Driven Domain"

Codemotion Milan 2026 · Wed 28 Oct 2026, 15:20–16:40 CET · Luca Bianchi · revision 1, 27 Oct 2026.

This is the narrative layer of the deck: what each slide says in its headline, what is physically on it, the one sentence the room must leave with, and the line that carries the audience to the next slide. It follows the 31 slides of `02-slide-outline.md` (full speaker notes and diagram specifications live there) and the timings of `01-run-sheet.md`. Values come from `00-running-example.md`; harness thresholds are illustrative.

## 1. The story in one paragraph

Every company that runs an s.r.l. had to know, in spring 2019, whether it needed a statutory auditor. The answer was in one article of the Civil Code that changed twice in three months. A retrieval pipeline, given the three texts, returns three answers and cannot choose, cannot retract, and cannot tell where it went wrong. We rebuild the problem as a domain: the assertion becomes a Claim with an identity, a span and a lifecycle; every change of state becomes an event with an actor; the knowledge base becomes a projection we can delete and rebuild; and the evaluation set writes itself from the decisions the reviewers already make. At the end the same question — "on 30 April 2019, is the appointment mandatory?" — gets a dated answer that cites the sentence of the law it rests on, and a different answer two months later. Three design decisions make this possible, and each has a price we state.

## 2. Structure

| Act | Segments | Slides | Question the act answers | Emotional beat |
| --- | --- | --- | --- | --- |
| I — The break | 1 | 1–5, 5a | Why can't documents be queried as knowledge? | Recognition: "I have shipped this pipeline." |
| II — The object | 2–3 | 6, 6a, 7–16 | What must an assertion be, so that conflict, retraction and attribution exist? | Construction: each entity removes one failure. |
| III — The memory | 4 | 17–21 | Where does the knowledge base live, and what happens when things change? | Relief: nothing to migrate, replay. |
| IV — The judge | 5 | 22–27 | How do we know an extractor is better, and who writes the test? | Surprise: the aggregate lies; the users wrote the golden set. |
| V — The answer | 6 + close | 28–31 | What does an agent consume, and what does all this cost? | Closure: the opening question answered twice; the bill presented honestly. |

## 3. Threads that run through the whole deck

1. **The meeting of 30 April 2019.** Introduced on slide 2 as a question, used as the checkpoint of slide 3 ("no evidence in the chunk"), answered as a valid-time query on slide 21 (2,000,000 EUR), answered with a cited belief on slide 29, and answered as an executable decision for one company on slide 29 (mandatory on 30 April, not on 30 June). The audience should feel it close.
2. **The tail on the right.** From slide 7 onward the right third of the screen shows the log growing. Every live step is narrated against it: "look at the right". On slide 21 the debrief is "it has only grown".
3. **Who decided.** Every state change has an actor. The colour of the actor is the same on every slide and in the terminal (section 4). Slides 10, 15, 25 and 30 are the moments where the actor is the point.
4. **The two numbers that never change.** 2,000,000 (v8) and 4,000,000 (v9) on `ricavi.limite`. They are the conflict of slide 11, the contested pair of slide 15, the replay of slide 20, the temporal answer of slide 21, the regression of slide 26 (2,000 EUR, the dropped "milioni"), the answer of slide 29.

## 4. Visual grammar

| Element | Rule |
| --- | --- |
| Template | Official Codemotion template, Codemotion font, 16:9, no cover slide |
| Headline | An assertion, ≤ 10 words, sentence case; the slide must be understood from the headline alone |
| Kicker (small caps above the headline) | `SEGMENT n · TOPIC` on content slides, `CHECKPOINT` on question slides, `LIVE` on terminal slides |
| Body | One idea per slide; a diagram or a table, never both; at most 25 words of prose |
| State colours | proposed = grey · verified = green · contested = amber · superseded = blue-grey (same in diagrams, tables and the tail formatter) |
| Actor colours | agent = purple · human = dark blue · harness = teal · process / import = neutral grey |
| Italian text | Quotations of the article stay in Italian, in quotation marks, with the version label (v7/v8/v9) |
| Illustrative numbers | Marked with a small "illustrative" tag in the corner of the slide |
| Terminal slides | No slide content while the command runs; the speaker switches to the terminal; a hidden backup slide follows with the screenshot of the `fallback/` file |
| Checkpoint slides | Only the question, large, centred; the answer appears on the next click or verbally |

## 5. Rhythm check

| Form | Slides | Count |
| --- | --- | --- |
| Diagram | 1, 5a, 7, 9, 12, 19, 20, 28 | 8 |
| Table | 2, 6, 6a, 8, 10, 15, 16, 17, 18, 23, 25, 26, 29, 31 | 14 |
| Text / list | 13, 14, 22, 24, 27 | 5 |
| Live terminal (no slide content) | 3, 4, 5, 21 | 4 |
| Checkpoint | 11, 30 (plus checkpoints run on slides 3, 15, 20, 26) | 2 |

33 visible slides (31 + the phase map 5a + the layer map 6a), 17 hidden backup slides (section 7). Text slides 13–14 are consecutive by design: the ACL, then the reason it exists.

---

## 6. Slide by slide

---

### 01 · Chunk, embed, retrieve, hope loses three things

- **Kicker:** SEGMENT 1 · WHY DOCUMENTS ARE NOT KNOWLEDGE
- **Time:** 15:20–15:21 · talk
- **On slide:** four boxes in a row — Document → Chunk → Vector → Answer. Under each arrow, in red: "identity", "provenance", "time".
- **Beat:** The pipeline is a retrieval system; its data model has no place for identity, provenance or time, and no later step can put them back.
- **Say first:** "Extraction is a domain, not a pipeline. The next eighty minutes defend that sentence with mechanisms, not adjectives."
- **Bridge →** "To show what those three losses cost, I need a document set that changes. I picked one nobody here can say I invented."

---

### 02 · One article of the Civil Code, three versions in 2019

- **Kicker:** SEGMENT 1 · THE RUNNING EXAMPLE
- **Time:** 15:21–15:22 · talk
- **On slide:** the three-row table v7 / v8 / v9 (in force, amending act, lett. c) quoted in Italian with the thresholds in bold). Below, one line in larger type: **"Meeting of 30 April 2019, approving the 2018 accounts: is a statutory auditor mandatory?"** Footer: "Source: Normattiva, R.D. 262/1942, art. 2477, versions 7–9."
- **Beat:** Real text, real dates, real stakes: conflict, supersession and an executable rule in one article.
- **Bridge →** "Keep that meeting in mind. It is the question we will answer at the end. First, let us ask it the usual way."

---

### 03 · Three answers, and no field to choose between them

- **Kicker:** LIVE · FAILURE (A)
- **Phase card:** P1 — text in `02c-phase-explainers.md`
- **Time:** 15:22–15:27 · live + checkpoint
- **On slide:** headline only, then switch to terminal: `npm run rag:query`.
- **Checkpoint (spoken, before revealing the answer):** "Meeting of 30 April 2019: which revenue threshold applies, and on what evidence present in the chunk?"
- **Beat:** Nothing in a chunk says which version it is or since when it applied; filtering, reranking and deleting each fail for a precise reason.
- **Bridge →** "The obvious fix is to delete the old versions. Let's do it."
- **Backup:** 03b — `fallback/seg1/rag-query.txt`

---

### 04 · Deleting is the only way an index can retract

- **Kicker:** LIVE · FAILURE (B)
- **Time:** 15:27–15:29 · live
- **On slide:** headline only, then `npm run rag:delete-v8` and the same query.
- **Beat:** One result now — 4 million — and the April meeting has no answer: the index has no state for "no longer current, still true for its period".
- **Bridge →** "And if an extraction is wrong, can we at least say where?"
- **Backup:** 04b — `fallback/seg1/rag-after-delete.txt`

---

### 05 · One opaque step leaves nothing to measure

- **Kicker:** LIVE · FAILURE (C)
- **Time:** 15:29–15:32 · live + debrief
- **On slide:** headline only, then `npm run rag:extract-c2` (a JSON blob with "esercizi_consecutivi": 3).
- **Beat:** Structure, value or attribution: the output cannot say which went wrong, so the extractor can only be judged end to end.
- **Debrief (one minute):** "Three losses, one missing object: an assertion with an identity, a provenance and a lifecycle. We build it from the entities, not from the tools."
- **Bridge →** "Before the model, a map of what we are about to run."
- **Backup:** 05b — `fallback/seg1/rag-extract.txt`

---

### 05a · Nine phases, one log that only grows

- **Kicker:** HOW THE DEMO RUNS
- **Time:** 15:32 · 30 seconds (taken from the slide 6 talk)
- **On slide:** timeline P1 … P9 with phase names; under it a step chart of the log size: 0 → 2 → 5 → 15 → 35 → 35 → 46 → 46 → 48 → 48, flat stretches labelled "reads only". Full specification in `02c-phase-explainers.md` §2.
- **Beat:** Every phase either appends to the log or reads from it; nothing is ever edited.
- **Say:** "From now on the right side of the screen is the system of record. The number at the bottom right of each slide is the length of the log, and it only goes up."
- **Bridge →** "Here is the whole model those phases operate on."

---

### 06 · Six entities, and everything else is derived

- **Kicker:** SEGMENT 2 · KNOWLEDGE ARTIFACTS
- **Time:** 15:32–15:34 · talk
- **On slide:** table Entity · Identity · Invariants (Document, Span, Claim, Entity, Policy, WorkflowStep). Claim row highlighted.
- **Beat:** Identity is deterministic: the same assertion extracted twice is the same Claim.
- **Bridge →** "Each of these entities lives in a layer. Follow one article through all six."

---

### 06a · One article, six layers, from text to decision

- **Kicker:** SEGMENT 2 · THE SIX LAYERS
- **Time:** 15:34 · 45 seconds (taken from the slide 8 talk)
- **On slide:** the definition line (*a layer is one level of knowledge with its own artifacts, extractor, events and golden set; layer n reads only what layer n − 1 has verified*) and a six-row table: layer · what it holds · art. 2477 v8 · the verified event that lets the next layer start. Rows: `cc-art2477@v8` · `tree-v8` · `ricavi.limite` = 2,000,000 EUR with its span · `organo-di-controllo` · `nomina-obbligatoria@v8` · `obbligo-nomina` → "mandatory on 30 April 2019: yes". Full specification in `02-slide-outline.md`, slide 6a.
- **Beat:** Each layer asserts a little more than the one below, and starts only from what the one below has verified.
- **Say:** "Slide 5 failed because one prompt jumped from Source to Claims in one step. Six layers means six places where an error can be found."
- **Bridge →** "The Claim is the centre. Look at what it carries inside."

---

### 07 · A Claim carries its evidence inside

- **Kicker:** SEGMENT 2 · THE AGGREGATE
- **Time:** 15:33–15:35 · talk
- **On slide:** the Claim box (subject key `ricavi.limite`, value 2,000,000 EUR, state proposed) with the Span `[1,067, 1,126)` inside, arrow to "DocumentVersion v8 · in force 2019-03-16 → 2019-06-17", arrow to "Lineage cc-art2477". On the side, the TypeScript type of `Claim` with `spans: readonly [Span, ...Span[]]` highlighted.
- **Beat:** Provenance cannot be lost because a Claim without a Span does not compile.
- **Bridge →** "I used a handful of domain-design words. Here is each one and what it buys in the log."

---

### 08 · Every design concept earns its place in the log

- **Kicker:** SEGMENT 2 · VOCABULARY
- **Phase card:** P2, P3, P4 (extraction) — text in `02c-phase-explainers.md`
- **Time:** 15:35–15:39 · talk, then live
- **On slide:** table Concept · Use here · Observable effect (eight rows).
- **Live:** `log:init` → `ingest:v8` → `extract:structure-v8` → `review` (the tree; note the abrogated comma) → `extract:claims-v8` → `show:ricavi-v8`. Point at the tail: the first lines of the log, the agent actor with model and prompt version, the causation pointing at `StructureVerified`.
- **Beat:** We use DDD only where it produces an effect you can see in the log, and the log now exists.
- **Bridge →** "Four of those lines are proposals. What can happen to a proposal?"
- **Backup:** 08b — `fallback/seg2/log-after-extract.txt`

---

### 09 · Four states, and every arrow has an actor

- **Kicker:** SEGMENT 2 · LIFECYCLE
- **Time:** 15:39–15:40 · talk
- **On slide:** the state machine (proposed grey → verified green / contested amber → superseded blue-grey), arrow labels naming the event and the actor.
- **Beat:** The extraction agent only ever produces the first state.
- **Bridge →** "So who produces the others?"

---

### 10 · Agents propose; humans and the harness decide

- **Kicker:** SEGMENT 2 · WHO MAY EMIT WHAT
- **Time:** 15:40–15:41 · talk
- **On slide:** the 4 × 3 table (event × agent / human / harness). One line under it: "Not chosen: merge, CRDT, last-writer-wins — the disagreement is itself knowledge; ingestion date ≠ effective date."
- **Beat:** A conflict between two normative texts is resolved by a judgment, and a judgment needs an actor and a date.
- **Bridge →** "Let's test that before I show you the review."

---

### 11 · 2 million is verified. 4 million arrives.

- **Kicker:** CHECKPOINT
- **Phase card:** P4 (review), shown after the answer — text in `02c-phase-explainers.md`
- **Time:** 15:41–15:44 · checkpoint, then live
- **On slide:** only the question: "`ricavi.limite` 2,000,000 EUR is verified. A later extraction proposes 4,000,000 EUR. What is the state of each claim, and who may emit the event?"
- **Answer (after the room commits):** 2 M stays verified; 4 M is born proposed and becomes contested by the harness; only a human resolves.
- **Live:** `npm run review` — verify attivo and ricavi; leave "esercizi 3" and `capitale.soglia` proposed; add esercizi 2 and dipendenti 10 by hand. Point at the tail: four human decisions with notes, two proposals left visible.
- **Debrief:** "The agent proposes, the human decides, the event records who. The two wrong proposals are not deleted: the backlog is measured."
- **Bridge →** "That was one layer. There are six, and they must not leak into each other."
- **Backup:** 11b — `fallback/seg2/log-after-verify.txt`

---

### 12 · Six contexts, one log, one contract

- **Kicker:** SEGMENT 3 · THE SIX LAYERS
- **Time:** 15:45–15:46 · talk
- **On slide:** context map: six boxes with ACLs between adjacent pairs, "Verified events" on every arrow, the shared log underneath, the Harness bottom right; under each box the art. 2477 example of slide 6a, in small type.
- **Beat:** Layer n consumes only the verified artifacts of layer n − 1, and the log lets you check it by following causation ids.
- **Bridge →** "The contract lives in the ACL. Here is the one between Structure and Claims."

---

### 13 · The ACL translates shape and coordinates, nothing else

- **Kicker:** SEGMENT 3 · ANTI-CORRUPTION LAYER
- **Time:** 15:46–15:47 · talk
- **On slide:** five numbered steps (filter, select, translate coordinates, stamp causation, record rejection), with the worked conversion `[280, 342) + 720 → [1,000, 1,062)`. Footnote: the real "terzo comma / secondo comma" discrepancy between v8 and v9.
- **Beat:** Provenance in absolute coordinates is enforced at the boundary, not hoped for in the prompt.
- **Bridge →** "Why insist on a translation layer? Because without it, drift belongs to nobody."

---

### 14 · Without an ACL, drift belongs to nobody

- **Kicker:** SEGMENT 3 · WHY ANTI-CORRUPTION
- **Time:** 15:47–15:48 · talk (load-bearing, say it slowly)
- **On slide:** two columns, "Without ACL" / "With ACL", four short steps each, ending in "drift attributable to neither" / "drift attributable".
- **Beat:** An extractor version can be held responsible for its output only if its input contract is versioned independently of the upstream extractor.
- **Bridge →** "Now version 9 enters, and its proposals meet what we already believe."

---

### 15 · Same, new or different: three classes, decided by code

- **Kicker:** SEGMENT 3 · THE THREE CLASSES
- **Phase card:** P5 — text in `02c-phase-explainers.md`
- **Time:** 15:48–15:56 · talk, live, checkpoint, live
- **On slide:** table A reconfirmation / B novelty / C conflict (condition, who decides, event). Under it, the comparator steps in one line.
- **Live first:** `ingest:v9` → `extract:v9`. Point at the tail: `StructureVerified` by the harness (same tree as v8), then six `ClaimProposed`. Stop before the comparator.
- **Checkpoint:** six v9 proposals on screen: classify A, B or C. Answer: esercizi 2 → A; attivo 4 M, ricavi 4 M, dipendenti 20 → C; cessazione 3, termine 30 giorni → B.
- **Live:** `npm run compare` (read the cold-start gate line aloud) → `npm run review` (verify the three v9 values, supersede the v8 ones).
- **Beat:** The comparator is deterministic; the harness may reconfirm because it acts on evidence already in the log, the agent never.
- **Bridge →** "What does this buy in human time?"
- **Backup:** 15a — `fallback/seg3/log-after-extract-v9.txt`; 15b — `fallback/seg3/compare.txt`; 15c — `fallback/seg3/log-after-compare.txt`

---

### 16 · The human reviews deltas, not volume

- **Kicker:** SEGMENT 3 · PRIORS AND HUMAN COST
- **Time:** 15:56–15:57 · talk + 30-second excerpt (if late, say the excerpt in one sentence: first cut of the run sheet)
- **On slide:** the 300 / 60 / 50 / 12 table, tagged "illustrative". One line: "Hidden cost: an initial human error is reconfirmed at every re-projection."
- **Live (debrief):** `npm run layers-4-6` — the policy "nomina obbligatoria" and the workflow, pre-computed, not executed.
- **Beat:** Human cost becomes proportional to novelty plus conflict, and changing an extractor becomes affordable.
- **Bridge →** "All of this is now in the log on the right. Let's look at what a line of it is."
- **Backup:** 16b — `fallback/seg3/layers-4-6.txt`

---

### 17 · Every line in the log has the same anatomy

- **Kicker:** SEGMENT 4 · THE EVENT
- **Time:** 15:57–15:58 · talk
- **On slide:** table Group · Fields · Note (identity, classification, actor, traceability, payload, evidence). On the side, the `DecisionEvent<T, P, E>` type with `evidence` highlighted.
- **Beat:** The event id is the idempotency key: re-running the same extractor version appends nothing.
- **Bridge →** "And there are two kinds of lines."

---

### 18 · Decisions are events too, and they carry evidence

- **Kicker:** SEGMENT 4 · FACTS AND DECISIONS
- **Time:** 15:58–15:59 · talk
- **On slide:** two families, fact and decision, with their event names.
- **Beat:** Replaying the log reconstructs not only what was believed but why, and who decided.
- **Bridge →** "If the log is the record, the knowledge base is just a view. Let me delete it."

---

### 19 · Delete the knowledge base, rebuild it, identical

- **Kicker:** SEGMENT 4 · PROJECTIONS
- **Phase card:** P6 (rebuild) — text in `02c-phase-explainers.md`
- **Time:** 15:59–16:02 · talk + live
- **On slide:** the log column, three folds, the red X over the projections, the identical rebuild.
- **Live:** `npm run log:cat` (follow one causation chain aloud, from `DocumentVersionIngested` v9 to the supersession of the v8 revenue claim) → `projections:drop` → `projections:build`.
- **Beat:** There is nothing to migrate: the knowledge base is a fold.
- **Bridge →** "The harder case: the documents do not change, the prompt does."
- **Backup:** 19b — `fallback/seg4/projections-rebuilt.txt`

---

### 20 · A new prompt adds lines; it never edits one

- **Kicker:** SEGMENT 4 · RE-PROJECTION
- **Phase card:** P6 (replay) — text in `02c-phase-explainers.md`
- **Time:** 16:02–16:07 · talk, checkpoint, live
- **On slide:** the log replayed through v1 and v2 into two side-by-side projections, "promoted" and "candidate", joined by "harness: drift".
- **Checkpoint:** "We switch to prompt v2 and replay. Which lines of the log are modified?" Answer: none; eleven lines are appended.
- **Live:** `npm run replay:claims-v2` → `npm run projections:diff`.
- **Beat:** Two versions of the knowledge base coexist until a decision event promotes one.
- **Bridge →** "And because nothing is overwritten, we can ask the log about the past."
- **Backup:** 20b — `fallback/seg4/projections-diff.txt`

---

### 21 · On 30 April 2019 the threshold was 2 million

- **Kicker:** LIVE · TEMPORAL QUERY
- **Phase card:** P7 — text in `02c-phase-explainers.md`
- **Time:** 16:07–16:09 · live + debrief
- **On slide:** headline only, then `npm run beliefs:at-2019-04-30` and `npm run beliefs`.
- **Beat:** Valid time answers "what did the law say on D"; transaction time answers "what did the system assert at sequence n"; both are kept.
- **Debrief:** "Nothing to migrate: you replay. The tail on the right has only grown."
- **Bridge →** "We now have two extractor versions. Which one is better, and who decides?"
- **Backup:** 21b — `fallback/seg4/beliefs-at-2019-04-30.txt`

---

### 22 · The golden set is a query over the log

- **Kicker:** SEGMENT 5 · THE HARNESS
- **Time:** 16:09–16:10 · talk
- **On slide:** the definition in one line, then four numbered properties (side effect of operation, per layer, real distribution, hardest cases).
- **Beat:** The users, resolving conflicts to do their job, write the evaluation set.
- **Bridge →** "Two exclusions keep it honest, and one set serves two purposes."

---

### 23 · Exclude what is derived; use the rest twice

- **Kicker:** SEGMENT 5 · GOLDEN SET IN PRACTICE
- **Phase card:** P8 (golden) — text in `02c-phase-explainers.md`
- **Time:** 16:10–16:13 · talk + live
- **On slide:** exclusions in one block; the offline / online table.
- **Live:** `npm run golden:claims-until-seg2` (4 expected items) → `npm run golden:claims` (7: the three new ones are the conflicts resolved twenty minutes ago).
- **Beat:** Property 4, proven on this session's own log.
- **Bridge →** "Now we can score an extractor. Four steps, no judgment."
- **Backup:** 23b — `fallback/seg5/golden-claims.txt`

---

### 24 · Four mechanical steps from proposals to metrics

- **Kicker:** SEGMENT 5 · METRICS
- **Time:** 16:13 · talk (30 seconds, then straight into the eval)
- **On slide:** align · classify · count · micro-average, one line each; θ = 0.8 tagged illustrative.
- **Beat:** "Right place, wrong number" and "right number, wrong place" are different outcomes, and the metric keeps them apart.
- **Bridge →** "Here is v1 on the four expected claims."

---

### 25 · v1: right place, wrong number, and we can say which

- **Kicker:** SEGMENT 5 · EVAL V1
- **Phase card:** P8 (eval) — text in `02c-phase-explainers.md`
- **Time:** 16:13–16:15 · live
- **On slide:** the five-row eval table (attivo IoU 62/64 = 0.97, ricavi exact, esercizi 3 wrong value, dipendenti missing, capitale.soglia unexpected). Totals: TP 2 · FP 2 · FN 2 · P 0.50 · R 0.50.
- **Live:** `npm run eval:claims-v1`; compute pair one aloud.
- **Beat:** The table tells you which item failed and whether in value or in provenance, which no aggregate can.
- **Bridge →** "v2 is supposed to be better. Its aggregates say it is."
- **Backup:** 25b — `fallback/seg5/eval-v1.txt`

---

### 26 · Better on average, worse where it matters

- **Kicker:** SEGMENT 5 · DRIFT
- **Phase card:** P8 (drift) — text in `02c-phase-explainers.md`
- **Time:** 16:15–16:20 · live, checkpoint, live
- **On slide:** the per-item drift matrix (attivo stable, **ricavi regression**, esercizi improvement, dipendenti improvement). Under it: v2 P 0.60 · R 0.75.
- **Live:** `npm run eval:claims-v2-summary`.
- **Checkpoint:** "v2 is better on both aggregates. Assume the thresholds were met: do we promote it?" Expected answer from the room: yes. Answer: no.
- **Live:** `npm run drift:v1-v2` — ricavi read as 2,000 EUR: "milioni" dropped. Monetary, critical.
- **Beat:** Drift is measured per item; an aggregate improvement can hide a regression on exactly the value that decides whether a company needs an auditor.
- **Bridge →** "So promotion is a rule, not a feeling."
- **Backup:** 26b — `fallback/seg5/eval-v2-summary.txt`, 26c — `fallback/seg5/drift-v1-v2.txt`

---

### 27 · Promotion needs all four; the gate counts, it does not average

- **Kicker:** SEGMENT 5 · PROMOTION AND GATE
- **Time:** 16:20–16:21 · talk + debrief
- **On slide:** the four promotion criteria (criteria 1 and 3 marked failed for v2); the batch gate in two lines; the cold-start note.
- **Beat:** No `ExtractorVersionPromoted` is emitted; v2 stays a candidate, attributable and harmless.
- **Debrief:** "Drift per item. A golden set written by the people resolving conflicts."
- **Bridge →** "What does an agent built on all this actually read?"

---

### 28 · The agent reads the projection, never the documents

- **Kicker:** SEGMENT 6 · THE ARTIFACT
- **Time:** 16:21–16:23 · talk
- **On slide:** Agent → Projection (CurrentBeliefs · Policies · WorkflowSteps · ConflictQueue · versions) → Belief → Span → DocumentVersion; "raw documents" crossed out on the right.
- **Beat:** Every answer is traceable from belief to the sentence of the law; retrieval may propose, never assert.
- **Bridge →** "Back to the meeting of 30 April 2019."

---

### 29 · The answer cites a belief, and the date changes it

- **Kicker:** SEGMENT 6 · CONSUMPTION
- **Phase card:** P9 — text in `02c-phase-explainers.md`
- **Time:** 16:23–16:25 · talk + live
- **On slide:** the consumption-policy table, then one answer line: "ricavi.limite, meeting of 2019-04-30 → 2,000,000 EUR · verified by human · span [1,067, 1,126) in cc-art2477-v8.txt".
- **Live:** `npm run ask:ricavi-2019-04-30` → `npm run ask:ricavi`.
- **Close the thread:** the illustrative company (attivo 2.5 / 2.6 M, ricavi 1.5 / 1.6 M, 8 / 9 employees): on 30 April 2019 the appointment is mandatory; on 30 June 2019 it is not. Same company, two months apart, two answers, each with its belief and policy ids.
- **Beat:** The question of slide 2 has a dated, cited, executable answer.
- **Bridge →** "One last decision for you to make."
- **Backup:** 29b — `fallback/seg6/ask.txt`

---

### 30 · What may the agent use?

- **Kicker:** CHECKPOINT
- **Time:** 16:25–16:27 · checkpoint + debrief
- **On slide:** only the question: "Policy: monetary quantities and time limits only from human-rooted verified beliefs. Can the agent answer on `assemblea.termine` (thirty days)? On `esercizi.consecutivi` (two years)?"
- **Answer:** termine — no, still proposed. Esercizi — yes: reconfirmed by the harness, rooted in the v8 human verification.
- **Beat:** The policy applies to the root of the evidence chain, which is what keeps reconfirmation cheap without letting agents verify.
- **Debrief:** "Projection, not documents."
- **Bridge →** "None of this is free. Here is the bill."

---

### 31 · Three decisions, three costs

- **Kicker:** CLOSE
- **Time:** 16:27–16:40 · talk, then Q&A (slide stays on screen)
- **On slide:** the three-row table (explicit contested state → latency and a review queue; log as record, knowledge base as projection → storage grows with events, re-projection compute; per-layer golden sets from the log → per-layer maintenance and a hand-kept catalogue). Bottom right: QR to the handout. Bottom left: repository URL.
- **Beat:** When nothing is ever superseded, nothing conflicts and nobody audits, plain retrieval is enough and much cheaper; when the law changes twice in three months, these costs pay for themselves.
- **Last sentence:** "The repository reproduces everything you saw, offline, with `npm run dry-run`. Questions."

---

## 7. Hidden backup slides

One per live step, placed immediately after its slide, holding a screenshot (light theme, ≥ 18 pt) of the corresponding `fallback/` file. Shown only if the command fails; the sentence to say is under "Fallback" in `03-walkthrough-script.md`.

| Backup | After slide | File |
| --- | --- | --- |
| 03b | 3 | `fallback/seg1/rag-query.txt` |
| 04b | 4 | `fallback/seg1/rag-after-delete.txt` |
| 05b | 5 | `fallback/seg1/rag-extract.txt` |
| 08b | 8 | `fallback/seg2/log-after-extract.txt` |
| 11b | 11 | `fallback/seg2/log-after-verify.txt` |
| 15a, 15b, 15c | 15 | `fallback/seg3/log-after-extract-v9.txt`, `fallback/seg3/compare.txt`, `fallback/seg3/log-after-compare.txt` |
| 16b | 16 | `fallback/seg3/layers-4-6.txt` |
| 19b | 19 | `fallback/seg4/projections-rebuilt.txt` |
| 20b | 20 | `fallback/seg4/projections-diff.txt` |
| 21b | 21 | `fallback/seg4/beliefs-at-2019-04-30.txt` |
| 23b | 23 | `fallback/seg5/golden-claims.txt` |
| 25b | 25 | `fallback/seg5/eval-v1.txt` |
| 26b, 26c | 26 | `fallback/seg5/eval-v2-summary.txt`, `fallback/seg5/drift-v1-v2.txt` |
| 29b | 29 | `fallback/seg6/ask.txt` |

## 8. Notes for whoever builds the deck

- Build from this file for headlines, kickers and on-slide content; take diagram specifications verbatim from `02-slide-outline.md`; take speaker notes from there into the presenter notes.
- Three live steps sit on a different slide than in the outline, so that the deck can be clicked straight through: the segment 2 setup commands run on slide 8 (outline: 7), the segment 2 review after the checkpoint of slide 11 (outline: 10), the v9 ingestion on slide 15 just before its checkpoint (outline: 13). Timings within each segment are unchanged.
- Phase cards and the phase strip (log size at the bottom of every live slide from slide 8) are specified in `02c-phase-explainers.md` §1.
- Do not add a cover, an agenda, a "key takeaways" or a "thank you" slide.
- Everything that is illustrative (θ, thresholds, sampling rates, the 300-claim table, the example company) carries the "illustrative" tag; the dates, acts and amounts of art. 2477 do not.
