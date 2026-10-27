# Phase explainers — what each step of the walkthrough does and what the room should expect

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revision 1, 27 Oct 2026. Companion to `02b-slide-storytelling.md` (slide flow) and `03-walkthrough-script.md` (full terminal output). Expected values come from `fallback/` and `00-running-example.md`; harness thresholds are illustrative.

The walkthrough runs the system in nine phases. Before each live phase, the slide shows a **phase card** that tells the room what goes in, what the step does and what should come out, so that the participants can predict the result and then check it against the terminal and the tail. One overview slide (5a) introduces the nine phases and the growth of the log.

## 1. The phase card (visual component)

A band in the lower third of the slide that precedes the live step, identical in layout every time:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ P4 · CLAIMS ON VERSION 8                                    log: seq 6 → 15       │
│ ┌───────────────┐      ┌──────────────────────┐      ┌───────────────────────┐   │
│ │ INPUT         │ ───▶ │ WHAT RUNS            │ ───▶ │ EXPECTED              │   │
│ │ verified tree │      │ ACL → claims@v1 →    │      │ 4 proposals, 2 wrong; │   │
│ │ of v8, comma 2│      │ human review         │      │ 4 human decisions     │   │
│ └───────────────┘      └──────────────────────┘      └───────────────────────┘   │
│ Watch for: the actor of each line on the right — agent, then human.               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Rules: phase id and name top left; log sequence range top right (the number the tail will reach); three boxes of at most 12 words each; one "Watch for" line. Colours follow `02b` §4 (actor colours on the words agent / human / harness). The card never shows the answer to a checkpoint: where a phase contains a checkpoint, the Expected box reads "your prediction first".

A thin **phase strip** runs along the bottom edge of every live slide: nine small segments P1…P9, the current one filled, with the current log size at the right end ("log: 15 events").

## 2. Slide 5a — The walkthrough in nine phases (new slide, inserted after slide 5)

- **Kicker:** HOW THE DEMO RUNS
- **Headline:** Nine phases, one log that only grows
- **On slide:** a horizontal timeline of nine phases (P1 … P9), each labelled with its name and the segment it belongs to. Under the timeline, a step chart of the log size: 0 (P1) → 2 (P2) → 5 (P3) → 15 (P4) → 35 (P5) → 35 (P6 rebuild) → 46 (P6 replay) → 46 (P7) → 48 (P8) → 48 (P9). The flat stretches are labelled "reads only".
- **Beat:** Every phase either appends to the log or reads from it; nothing is ever edited.
- **Say:** "P1 is the baseline we just broke. From P2 on, the right side of the screen is the system of record. Watch the number at the bottom right of each slide: it is the length of the log, and it only goes up."
- **Time:** 15:32 (30 seconds, taken from the slide 6 talk).

| Phase | Name | Segment | Slide with the card | Log after |
| --- | --- | --- | --- | --- |
| P1 | Retrieval baseline | 1 | 3 | — (no log) |
| P2 | Open the log | 2 | 8 | 2 |
| P3 | Version 8: source and structure | 2 | 8 | 5 |
| P4 | Version 8: claims and review | 2 | 8 (extraction), 11 (review) | 15 |
| P5 | Version 9: classify and resolve | 3 | 15 | 35 |
| P6 | Rebuild and replay | 4 | 19, 20 | 46 |
| P7 | Ask the past | 4 | 21 | 46 |
| P8 | Judge the extractor | 5 | 23, 25, 26 | 48 |
| P9 | Answer with evidence | 6 | 29 | 48 |

---

## 3. The nine phases

### P1 — Retrieval baseline (slides 3–5, 15:22–15:32)

**What it does.** Indexes the three versions of art. 2477 as chunks with vectors and treats them the way a standard RAG pipeline would: query, delete, one-shot extraction. It is the control experiment; nothing here touches the log.

| Card box | Text |
| --- | --- |
| Input | three versions of art. 2477 (v7, v8, v9), chunked |
| What runs | `rag:query` → `rag:delete-v8` → `rag:extract-c2` |
| Expected | three answers; then one; then a blob nobody can debug |
| Watch for | the fields line: id, source_file, text, vector — no version, no date |

**Expected result.**
- `rag:query`: top 3 passages with similarity ≈ 0.87, 0.87, 0.84 (scores illustrative): v8 "2 milioni", v9 "4 milioni", v7 "due dei limiti … 2435-bis". Last line: `fields available per chunk: id, source_file, text, vector`.
- `rag:delete-v8`: 13 chunks removed, 24 left; the same query returns v9 and v7 only. The April 2019 answer is gone.
- `rag:extract-c2`: a JSON blob with `"esercizi_consecutivi": 3` and `"regola": "due dei tre limiti"` — two errors, no way to say where they came from.

**Checkpoint.** "Meeting of 30 April 2019: which revenue threshold, on what evidence in the chunk?" — none.

**Why it matters.** Each of the three commands exhibits one loss: identity (conflict), time (retraction), provenance (evaluation).

**If it fails.** `cat fallback/seg1/rag-query.txt`, `rag-after-delete.txt`, `rag-extract.txt`.

---

### P2 — Open the log (slide 8, 15:36)

**What it does.** Creates the append-only file that will be the only state of the system, and records one decision: claims@v1 is the extractor version in use.

| Card box | Text |
| --- | --- |
| Input | nothing: an empty file |
| What runs | `log:init` |
| Expected | 2 events: LogInitialised, ExtractorVersionPromoted(claims@v1) |
| Watch for | the first line on the right; the ★ marks a decision |

**Expected result.** Tail seq 0001 `LogInitialised · process(log-init)`, seq 0002 `★ ExtractorVersionPromoted · human(luca) · claims@v1 · evidence: initial version, no predecessor`.

**Why it matters.** "Promoted" is itself an event. When v2 arrives in P6 and is refused in P8, the difference between promoted and candidate is a fact in the log, not a setting.

**If it fails.** `cat fallback/seg2/log-init.txt`.

---

### P3 — Version 8: source and structure (slide 8, 15:36–15:38)

**What it does.** Registers version 8 with its content hash and validity period, then asks the structure extractor for the tree of commi, which a human verifies. The Claims layer cannot start before this verification: that is the contract between layers.

| Card box | Text |
| --- | --- |
| Input | `cc-art2477-v8.txt`, in force 16 Mar – 17 Jun 2019 |
| What runs | `ingest:v8` → `extract:structure-v8` → `review` |
| Expected | 8 nodes, one of them a note; tree verified by a human |
| Watch for | the note node: the comma abrogated in 2014 |

**Expected result.**
- `ingest:v8`: `hash=sha256:7f98bb0c… effectiveFrom=2019-03-16 effectiveTo=2019-06-17 length=1991`; tail seq 0003 `DocumentVersionIngested · process(ingest)`.
- `extract:structure-v8`: `tree: 8 nodes · [0,1990) · no overlaps · types: index×1, comma×6, note×1`; the node list with intervals (c2 = [720,1190)); tail seq 0004 `StructureProposed · agent(structure@v1)`.
- `review`: the reviewer confirms the tree; tail seq 0005 `★ StructureVerified · human(luca) · evidence: 8/8 nodes, intervals cover 0..1990`.

**Why it matters.** Every absolute span later depends on these intervals. The note node keeps a real drafting detail visible: v8 counts the abrogated comma ("terzo comma"), v9 does not ("secondo comma").

**If it fails.** `cat fallback/seg2/log-after-extract.txt` (seq 1–9).

---

### P4 — Version 8: claims and review (slides 8 → 11, 15:38–15:44)

**What it does.** The ACL turns the verified comma 2 into an extraction unit (base offset 720); claims@v1 proposes claims with section-local spans that the Claims context converts to absolute coordinates; then a human decides on each proposal.

| Card box | Text |
| --- | --- |
| Input | verified tree of v8, comma 2 (base offset 720) |
| What runs | ACL → claims@v1 → `show:ricavi-v8` → `review` |
| Expected | 4 proposals, 2 of them wrong; then 6 human events |
| Watch for | agent lines (seq 6–9), then human lines (seq 10–15) |

**Expected result.**
- `extract:claims-v8`: `units=1 (c2, base offset 720)`, `proposals: 4` — `clm-attivo2m`, `clm-ricavi2m`, `clm-eserc3`, `clm-capitale` (seq 0006–0009), each caused by `ev-0005`.
- `show:ricavi-v8`: the full event — span `[1067,1126)` in v8, actor agent with model id, prompt version `p3`, extractor `claims@v1`, causation `ev-0005`, no evidence field (it is a fact).
- `review`: verify attivo and ricavi (seq 0010–0011); leave `esercizi 3` (value misread: the text says "due") and `capitale.soglia` (the capital trigger abrogated in 2014, not in the catalogue) proposed; add `esercizi 2` and `dipendenti 10` as human proposals and verify them (seq 0012–0015).

**Checkpoint (slide 11, before the review).** "2 million is verified; 4 million arrives: state of each claim, and who may emit the event?"

**Why it matters.** Two genuinely different agent errors — a misread number and a remembered obsolete rule — are kept, visible, as proposals; four human decisions with notes become the first golden set of P8.

**If it fails.** `cat fallback/seg2/log-after-verify.txt` (seq 1–15).

---

### P5 — Version 9: classify and resolve (slide 15, 15:50–15:56)

**What it does.** Ingests version 9; the harness reconfirms its tree (same paths and types as v8); the ACL produces three units (commi 2, 3, 5); claims@v1 proposes six claims; the comparator classifies them against what is already believed; a human resolves the conflicts.

| Card box | Text |
| --- | --- |
| Input | `cc-art2477-v9.txt`, in force from 18 Jun 2019; beliefs from v8 |
| What runs | `ingest:v9` → `extract:v9` → `compare` → `review` |
| Expected | 6 proposals: your classification first (A, B or C) |
| Watch for | who verifies: harness once, human three times |

**Expected result.**
- `ingest:v9` + `extract:v9`: `effectiveFrom=2019-06-18`, `tree: 8 nodes … identical paths and types to tree-v8`, `StructureVerified(actor=harness)` at seq 0018, `acl structure→claims: 3 units (c2 base 737 · c3 base 1209 · c5 base 1552)`, six proposals at seq 0019–0024. The comparator has not run.
- `compare`: `batch gate: not applicable (golden set 4 expected items < minimum 10, illustrative); class-A audit sampling 100 %`, then one line per proposal — `clm-eserc2b` A, `clm-attivo4m` C, `clm-ricavi4m` C, `clm-dip20` C, `clm-cess3` B, `clm-term30` B. Tail seq 0025 `★ ClaimVerified · harness(compare)`, 0026 `★ ClaimSuperseded` (reconfirmation chain), 0027–0029 `★ ClaimContested`.
- `review`: for each conflict, verify the v9 value and supersede the v8 one with a note "L. 55/2019 in force from 2019-06-18" (seq 0030–0035).
- CurrentBeliefs after the phase: attivo 4,000,000 · ricavi 4,000,000 · dipendenti 20 (human) · esercizi 2 (harness, human root).

**Checkpoint.** "Classify the six proposals A, B or C before the comparator runs." Answer: 1 A, 3 C, 2 B.

**Why it matters.** The human makes three decisions instead of six, and the three are the interesting ones; the harness verifies only where a human already decided the same value.

**If it fails.** `cat fallback/seg3/log-after-extract-v9.txt`, `compare.txt`, `log-after-compare.txt`.

---

### P6 — Rebuild and replay (slides 19–20, 15:59–16:07)

**What it does.** First deletes every projection and rebuilds it from the log; then replays the claims layer with a new extractor version, v2, over every verified tree in the log, without changing a single existing line.

| Card box | Text |
| --- | --- |
| Input | the 35-event log; extractor claims@v2 |
| What runs | `log:cat` → `projections:drop` → `projections:build` → `replay:claims-v2` → `projections:diff` |
| Expected | identical beliefs after rebuild; 11 new lines after replay |
| Watch for | the line numbers: 1–35 never change, 36–46 are added |

**Expected result.**
- `projections:drop` / `build`: `folded 35 events`, CurrentBeliefs identical (same four rows, same hash), `ConflictQueue 0 open · ReviewQueue 4 proposed (clm-eserc3, clm-capitale [UNEXPECTED], clm-cess3, clm-term30)`.
- `replay:claims-v2`: `proposals: 5 (v8/c2) + 6 (v9) = 11 appended, 0 duplicates`; tail seq 0036–0046 tagged `agent(claims@v2)`.
- `projections:diff`: per version, promoted v1 vs candidate v2; one row says `DIFFERS` — v8 `ricavi.limite`: 2,000,000 EUR vs **2,000 EUR**.

**Checkpoint (slide 20).** "We switch to prompt v2 and replay: which lines of the log are modified?" — none.

**Why it matters.** This is the phase that removes the migration: a new prompt is a new set of appended proposals and a candidate projection, never an overwrite.

**If it fails.** `cat fallback/seg4/projections-rebuilt.txt`, `replay-claims-v2.txt`, `projections-diff.txt`.

---

### P7 — Ask the past (slide 21, 16:07–16:09)

**What it does.** Folds the log for the version of the article that was in force on a given date (valid time), then for today.

| Card box | Text |
| --- | --- |
| Input | the log; the date 2019-04-30 |
| What runs | `beliefs:at-2019-04-30` → `beliefs` |
| Expected | v8 values on that date; v9 values today |
| Watch for | "in force 2019-03-16 → 2019-06-18" and who superseded what |

**Expected result.**
- On 2019-04-30: attivo 2,000,000 · ricavi 2,000,000 · dipendenti 10 · esercizi 2, each with actor, event and "superseded by … at ev-00NN" (or "reconfirmed by" for esercizi).
- Today: attivo 4,000,000 · ricavi 4,000,000 · dipendenti 20 · esercizi 2 (harness, root human).
- No event appended: the log stays at 46.

**Why it matters.** Supersession did not delete the past: the April 2019 answer that P1 lost is back, with its period of validity.

**If it fails.** `cat fallback/seg4/beliefs-at-2019-04-30.txt`.

---

### P8 — Judge the extractor (slides 23–27, 16:11–16:20)

**What it does.** Derives the golden set from the human decisions already in the log, scores claims@v1 and claims@v2 against it, compares them item by item and applies the promotion criteria.

| Card box | Text |
| --- | --- |
| Input | human decisions in the log; proposals of v1 and v2 |
| What runs | `golden` ×2 → `eval` v1 → `eval` v2 → `drift` |
| Expected | v1 0.50 / 0.50; v2 better on average: promote? your call first |
| Watch for | the drift row of `ricavi.limite` |

**Expected result.**
- `golden:claims-until-seg2`: `inputs: 1 · expected items: 4` (comma 2 of v8). `golden:claims`: `inputs: 2 · expected items: 7` — the three new items are the conflict resolutions of P5; one harness-verified claim excluded.
- `eval:claims-v1`: attivo IoU 0.97 (62/64) correct · ricavi 1.00 correct · esercizi wrong value · dipendenti missing · capitale.soglia unexpected → `TP 2 FP 2 FN 2 precision 0.50 recall 0.50`; seq 0047 `EvalCompleted`.
- `eval:claims-v2-summary`: `TP 3 FP 2 FN 1 precision 0.60 recall 0.75 (v1: 0.50 / 0.50)`; seq 0048.
- `drift:v1-v2`: attivo stable · **ricavi REGRESSION (2,000 EUR — "milioni" dropped; monetary → critical)** · esercizi improvement · dipendenti improvement; noise introduced: cessazione 3; criteria 1 and 3 FAIL → not promoted, no `ExtractorVersionPromoted`.

**Checkpoint (slide 26).** "v2 is better on both aggregates; assume the thresholds were met: do we promote it?" — no.

**Why it matters.** The evaluation set was written by the reviewers while doing their job, and only a per-item comparison catches the regression on the one number that decides whether a company needs an auditor.

**If it fails.** `cat fallback/seg5/golden-claims.txt`, `eval-v1.txt`, `eval-v2-summary.txt`, `drift-v1-v2.txt`.

---

### P9 — Answer with evidence (slide 29, 16:23–16:25)

**What it does.** An expertise-aware agent answers the opening question from the projection only, under a consumption policy that admits only human-rooted beliefs for monetary quantities and time limits.

| Card box | Text |
| --- | --- |
| Input | the projection; policy: monetary and time limits → human-rooted only |
| What runs | `ask:ricavi-2019-04-30` → `ask:ricavi` |
| Expected | 2,000,000 on 30 April 2019; 4,000,000 today; each citing a belief |
| Watch for | the last line: "raw documents: not read" |

**Expected result.**
- As of 2019-04-30: `answer: 2,000,000 EUR`, belief `clm-ricavi2m` verified by human at `ev-0011`, in force 2019-03-16 → 2019-06-18, span `cc-art2477@v8 [1067,1126)` with the quoted text, "superseded later by clm-ricavi4m (ev-0033) — not applicable on 2019-04-30".
- As of now: `answer: 4,000,000 EUR`, belief `clm-ricavi4m` verified by human at `ev-0032` after `ClaimContested ev-0028`, successor of `clm-ricavi2m`, span `cc-art2477@v9 [1084,1143)`.
- `sources consulted: projection only (CurrentBeliefs, Timeline); raw documents: not read`.
- Spoken close: the illustrative company is obliged to appoint on 30 April 2019 and not on 30 June 2019.

**Checkpoint (slide 30).** "Can the agent answer on `assemblea.termine`? On `esercizi.consecutivi`?" — no (proposed); yes (human root).

**Why it matters.** The question of slide 2 has a dated answer that cites the sentence of the law, the person who verified it and the event that superseded it.

**If it fails.** `cat fallback/seg6/ask.txt`.

---

## 4. Changes to the slide flow (`02b-slide-storytelling.md`)

1. Slide **5a** is added after slide 5 (32 visible slides; within the 25–35 target). It takes 30 seconds from the slide 6 talk.
2. Phase cards appear on slides 3 (P1), 8 (P2, P3 and the extraction half of P4: one card with three rows), 11 (the review half of P4, revealed after the checkpoint answer), 15 (P5), 19 (P6, first half), 20 (P6, second half), 21 (P7), 23 (P8, golden), 25 (P8, eval), 26 (P8, drift), 29 (P9).
3. The phase strip with the log size runs along the bottom of every live slide from slide 8.
