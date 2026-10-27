# Live walkthrough script — "Documents Are Not Knowledge"

Codemotion Milan 2026 · Wed 28 Oct 2026, 15:20–16:40 CET · Luca Bianchi
Companion to `01-run-sheet.md` (times, slide ranges), `00-running-example.md` (the example: values, spans, fixtures, checkpoints) and `AGENTS.md` §11 (npm scripts, fallback files). English, revision 4, 27 Oct 2026.

All event ids (`ev-0007`), claim ids (`clm-ricavi2m`), batch ids, hashes, model ids and harness thresholds in this script are **illustrative**. Offsets are the real ones of the fixture files (`fixtures/documents/manifest.json`). The repository prints its own deterministic ids; the shapes and the counts are what must match.

Tail line format (from `npm run tail`): `seq · type · actor.kind(actor.id) · layer · aggregateId · ← causationId`, decision events prefixed `★` with evidence summarised in ≤ 60 characters.

---

## Before 15:20 (in the room by 15:05)

- Laptop on mains power, display mirrored at 1920×1080, HDMI adapter attached; notifications off; terminal font ≥ 18 pt, light theme.
- Window layout: **left two thirds** = slides (presenter view on the laptop screen only) or Terminal A; **right third** = Terminal B running `npm run tail` from 15:15, on a fresh log directory (`out/` empty). Terminal A is in the repository root with `fallback/` open in a second tab (`cd fallback` there) so that any `cat fallback/segN/<file>` is one tab switch away.
- `npm run dry-run` run once at 15:05 from a clean `out/`: must print `dry-run: OK (byte-identical with fallback/)`. If it is not green, run the whole session from `fallback/` with `cat` and say so once at the start ("the repository is replayed from snapshots today; the commands are the ones on the slides").
- After the dry-run, `npm run log:init` is **not** run again until 15:36: `out/events.jsonl` must be deleted (`npm run log:reset`, or `rm out/events.jsonl`) so that the room sees `LogInitialised` as seq 1 live. Restart `npm run tail` after the reset.
- The retrieval baseline index (`src/rag-baseline/`, pre-computed vectors) is built by `npm run rag:index` before 15:20; it holds the three versions v7, v8, v9.
- Slides: hidden screenshot slide after every live slide (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23, 24–27, 29) so that the fallback can also be shown without touching the terminal.
- Water, clicker, timer visible on the laptop; handout QR tested on a phone.

---

## Segment 1 — Three live failures of chunk → embed → retrieve (15:20–15:32, slides 1–5)

**On screen before the step.** Slide 1 (pipeline diagram with the three losses), then slide 2 (the domain table: art. 2477 c.c., v7 / v8 / v9 with their validity periods and thresholds). Terminal B is visible on the right and **empty**: the log has not been initialised yet. Say it once: "The right third of the screen is the system of record; it is empty because nothing has happened yet."

### 15:22 — `npm run rag:query` (slide 3)

Expected output (Terminal A):

```
rag-query  index=cc-art2477  chunks=23  top_k=3  q="soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"
score  chunk                      text (trimmed)
0.244  cc-art2477-v8 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 2 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 2 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 10 unità.
0.242  cc-art2477-v9 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 4 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 4 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 20 unità.
0.205  cc-art2477-v7 #3           … c) per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis.
fields available per chunk: id, source_file, text, vector
```

Say: "Three passages, comparable scores, three different rules: by reference to another article, two million, four million. Look at the last line: the fields the retriever has. There is no version, no period of validity, no assertion. The generator downstream can pick by position, blend, or report all three. None of these is an answer."

**Checkpoint (15:25, slide 3, 2 min).** Question verbatim: *"The shareholders' meeting of 30 April 2019 approves the 2018 accounts. Which revenue threshold applies, and on what evidence that is present in the chunk?"*
Expected answers from the room: "two million, because it is the v8 file" (the file name is not in the chunk's fields the generator sees, and even if it were, a file name is not a period of validity); "four million, because it is the latest" (recency of ingestion is not validity; on 30 April 2019 the four-million text did not exist yet); "filter by metadata" (the filter needs to know which version was in force on that date, which is the thing we wanted the system to know).
Correct reasoning: no evidence is present. The chunk carries text and a vector; the information needed to decide — the version the text belongs to, the date from which and until which it was in force, the assertion it makes — was discarded at chunking and cannot be recovered by any later step. This is the gap that segment 2 fills with Span and DocumentVersion.

### 15:27 — `npm run rag:delete-v8` then `npm run rag:query` (slide 4)

```
rag-delete  version=v8  removed=8 chunks  index=cc-art2477 (15 chunks left)
rag-query  index=cc-art2477  chunks=15  top_k=3  q="soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"
score  chunk                      text (trimmed)
0.244  cc-art2477-v9 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 4 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 4 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 20 unità.
0.208  cc-art2477-v7 #3           … c) per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis.
0.141  cc-art2477-v7 #5           Nel caso di nomina di un organo di controllo, anche monocratico, si applicano le disposizioni sul collegio sindacale previste per le società per azion …
```

Say as a statement: "The only operation the index offers to retire the March text is deletion. The question about 30 April 2019 no longer has an answer: the text that was in force on that date is gone, and the two that remain are wrong for it. The index has no state for 'no longer current but true for its period', because it has neither assertions nor time."

### 15:29 — `npm run rag:extract-c2` (slide 5)

```
rag-extract  unit=v8/c2  extractor=one-shot  model=claude-<version> (illustrative)
{
  "soglie": { "attivo": 2000000, "ricavi": 2000000, "dipendenti": 10 },
  "esercizi_consecutivi": 3,
  "regola": "due dei tre limiti"
}
```

Ask the room where the error is (the comma says two consecutive years, not three; it says "at least one" of the limits, not "two of three" — that is the rule in force until March, which the model knows from training and not from the text). Then: "Was the comma boundary wrong, was the value misread, or was a correct value attached to the wrong rule? One opaque step, one artifact; the output cannot say. There is no place to state 'structure was right, claims were wrong', so there is nothing to measure per layer."

**Debrief (15:31).** Three losses: identity, provenance, time. The entities of segment 2 are the three losses turned into objects.

**Fallback.** `fallback/seg1/rag-query.txt`, `rag-after-delete.txt`, `rag-extract.txt` hold the three outputs above verbatim. Sentence while switching: "The snapshot is what the command printed this morning; the point is in the fields, not in the run."

**Timing.** Each command < 5 s. If over: skip the `rag-delete` run and show its screenshot slide (saves 1 min).

---

## Segment 2 — Entities, aggregate, lifecycle; extract comma 2 of v8 (15:32–15:45, slides 6–11)

**On screen before the step.** Slides 6–8 (entities table; Claim aggregate diagram; domain-design concepts). Terminal B still empty.

### 15:36 — `npm run log:init` (slide 7)

Terminal A:

```
log-init  out/events.jsonl created  (append-only; duplicate eventId → ignored)
```

Terminal B (tail):

```
0001 · LogInitialised            · process(log-init)   · source    · log           ·
0002 ★ ExtractorVersionPromoted  · human(luca)         · harness   · claims@v1     ·            evidence: initial version, no predecessor
```

Say: "Seq 2 is a decision: claims@v1 is the promoted extractor for the Claims layer. It is in the log because in segment 4 a second version will exist and 'promoted' must be something the log says, not an assumption."

### `npm run ingest:v8`

```
ingest  lineage=cc-art2477  documentId=cc-art2477  version=v8  hash=sha256:7f98bb0c…  effectiveFrom=2019-03-16  effectiveTo=2019-06-17  length=1991
```

Tail:

```
0003 · DocumentVersionIngested   · process(ingest)     · source    · cc-art2477@v8 ·
```

### `npm run extract:structure-v8`

```
extract  layer=structure  extractor=structure@v1  input=cc-art2477@v8  (fixture replay)
tree: 8 nodes · [0,1990) · no overlaps · types: index×1, comma×6, note×1
  header [0,328) · c1 [330,606) · abrogato(note) [608,718) · c2 [720,1190) · c3 [1192,1377) · c4 [1379,1531) · c5 [1533,1889) · c6 [1891,1990)
```

Tail:

```
0004 · StructureProposed         · agent(structure@v1) · structure · tree-v8       · ← ev-0003
```

### `npm run review` (first call: the structure tree)

The reviewer CLI shows the eight nodes with intervals and asks `verify? [y/n]`. Answer `y`, note `"abrogated comma kept as note; paths follow the v9 numbering"`.

Say while it is on screen: "One node is a note, not a comma: the comma abrogated in 2014. The March text still says 'lettera c) del terzo comma' because its drafter counted it; the June text corrected it to 'secondo comma'. The tree takes the June reading and keeps the note visible. That is a structure decision, recorded by a human, and nothing downstream can run until this event exists."

Tail:

```
0005 ★ StructureVerified         · human(luca)         · structure · tree-v8       · ← ev-0004  evidence: 8/8 nodes, intervals cover 0..1990
```

### `npm run extract:claims-v8`

```
extract  layer=claims  extractor=claims@v1 (promoted)  units=1  (c2, base offset 720)  (fixture replay)
proposals: 4
```

Tail:

```
0006 · ClaimProposed             · agent(claims@v1)    · claims    · clm-attivo2m  · ← ev-0005
0007 · ClaimProposed             · agent(claims@v1)    · claims    · clm-ricavi2m  · ← ev-0005
0008 · ClaimProposed             · agent(claims@v1)    · claims    · clm-eserc3    · ← ev-0005
0009 · ClaimProposed             · agent(claims@v1)    · claims    · clm-capitale  · ← ev-0005
```

Do not comment on the content yet; the room will see it at the review step.

### `npm run show:ricavi-v8`

(`--event last` would print the `capitale.soglia` proposal. Use the `ricavi.limite` one, which is the span the slides use.)

```
{
  "eventId": "ev-0007",
  "seq": 7,
  "aggregateVersion": 1,
  "type": "ClaimProposed",
  "layer": "claims",
  "aggregateId": "clm-ricavi2m",
  "actor": { "kind": "agent", "id": "claims-extractor",
             "modelId": "claude-<version> (illustrative; the fixture records the real id)", "promptVersion": "p3", "extractorVersion": "claims@v1" },
  "causationId": "ev-0005",
  "correlationId": "run-v8-c2-01",
  "occurredAt": "2026-10-28T13:37:12Z",
  "payload": {
    "lineageId": "cc-art2477",
    "subjectKey": "ricavi.limite",
    "normalizedValue": { "type": "money", "amount": 2000000, "currency": "EUR" },
    "spans": [ { "documentId": "cc-art2477", "version": "v8", "start": 1067, "end": 1126 } ],
    "sectionPath": "c2"
  }
}
```

Walk the fields top to bottom in 40 seconds: identity (eventId deterministic from producer, input, extractor version → idempotent), classification, actor with model and prompt version, causation = the `StructureVerified` the unit came from, payload with the Span in **absolute** document coordinates (the extractor returned `[347,406)` local to the comma; the Claims context added the base offset 720). No `evidence` field: this is a fact event, the "fact" family of the event catalogue, not a verified claim.

**Talk (15:39, slides 9–10):** state machine; who may emit what; contested instead of merge.

**Checkpoint (15:41, slide 11, 2 min).** Question verbatim: *"`ricavi.limite` 2,000,000 EUR is verified. A later extraction proposes 4,000,000 on the same subject. What is the state of each claim after the event, and who may emit it?"*
Expected answers: "two million becomes superseded" (nobody has decided that yet); "the harness merges to the latest" (there is no merge; ingestion date ≠ effective date); "the agent marks four million verified" (an agent can only emit `ClaimProposed`).
Correct reasoning: 2,000,000 stays verified, untouched. 4,000,000 is born `proposed` by the agent; the harness, comparing it with CurrentBeliefs, finds a belief on the same subject with a different value and emits `ClaimContested` with a reference to the 2,000,000 claim. Only a human can move 4,000,000 to verified and declare 2,000,000 superseded with 4,000,000 as successor. The log records who and when.

### 15:43 — `npm run review` (second call: the four proposals)

The CLI prints the four proposals with their span text and the catalogue lookup, then asks for each. The scripted decisions (`review:auto` reproduces them in dry-run):

| Proposal | Span text (trimmed) | Decision | Note typed |
| --- | --- | --- | --- |
| `clm-attivo2m` attivo.limite 2,000,000 EUR | "1) totale dell'attivo dello stato patrimoniale: 2 milioni di euro" [998,1062) | **verify** | ok |
| `clm-ricavi2m` ricavi.limite 2,000,000 EUR | "ricavi delle vendite e delle prestazioni: 2 milioni di euro" [1067,1126) | **verify** | ok |
| `clm-eserc3` esercizi.consecutivi 3 | "per due esercizi consecutivi" [936,964) | **leave proposed** | value misread (text says due) |
| `clm-capitale` capitale.soglia "minimo s.p.a." | "La nomina dell'organo di controllo o del revisore è obbligatoria se la società:" [720,799) — catalogue: UNEXPECTED | **leave proposed** | abrogated 2014 trigger, not in text |
| *add* esercizi.consecutivi 2 | "per due esercizi consecutivi" [936,964) | **propose + verify** | misread value, added by reviewer |
| *add* dipendenti.limite 10 | "dipendenti occupati in media durante l'esercizio: 10 unità" [1131,1189) | **propose + verify** | missing claim, added by reviewer |

Tail:

```
0010 ★ ClaimVerified             · human(luca)         · claims    · clm-attivo2m  · ← ev-0006  evidence: note "ok"; span [998,1062)
0011 ★ ClaimVerified             · human(luca)         · claims    · clm-ricavi2m  · ← ev-0007  evidence: note "ok"; span [1067,1126)
0012 · ClaimProposed             · human(luca)         · claims    · clm-eserc2    · ← ev-0005
0013 ★ ClaimVerified             · human(luca)         · claims    · clm-eserc2    · ← ev-0012  evidence: note "added by reviewer"
0014 · ClaimProposed             · human(luca)         · claims    · clm-dip10     · ← ev-0005
0015 ★ ClaimVerified             · human(luca)         · claims    · clm-dip10     · ← ev-0014  evidence: note "missing in v1 output"
```

Say: "Four human decisions, two of them on claims the agent never produced. Two proposals stay proposed — seq 8 and seq 9 — and will stay there; the harness measures that backlog instead of hiding it. Seq 9 is worth a sentence: the model proposed the capital threshold that was abrogated in 2014. It is not in the text, and the catalogue does not even have the subject, so it is flagged as unexpected and goes to the top of the human queue. Remember these four verified claims: in segment 5 they are the golden set, and nobody built a dataset."

**Debrief (15:44).** The agent proposes, the human decides, the event records who.

**Fallback.** `fallback/seg2/log-after-extract.txt` (seq 1–9) and `fallback/seg2/log-after-verify.txt` (seq 1–15), shown with `cat` through the formatter (`npm run log:cat -- --file …`). Sentence: "Same fifteen lines, recorded this morning; the ids are deterministic so they are byte-identical."

**Timing.** log-init 1 s, ingest 1 s, extract structure 2 s, review (tree) 30 s, extract claims 2 s, show 40 s of talking, review (claims) 60 s. If over: skip `npm run show:ricavi-v8` and point at the hidden JSON slide (saves 40 s).

---

## Segment 3 — Context map, ACL, three classes; ingest v9 (15:45–15:57, slides 12–16)

**On screen before the step.** Slides 12–14 (context map; ACL in five steps; the coupled-versions passage), then 15–16 (three classes; priors and the delta table). Tail shows seq 1–15.

### 15:51 — `npm run ingest:v9` then `npm run extract:v9` (slide 13)

```
ingest  lineage=cc-art2477  documentId=cc-art2477  version=v9  hash=sha256:ab421a21…  effectiveFrom=2019-06-18  length=2012
extract  layer=structure  extractor=structure@v1  input=cc-art2477@v9  (fixture replay)
tree: 8 nodes · [0,2011) · identical paths and types to tree-v8
harness: structure class A — tree-v9 reconfirms tree-v8 (ev-0005); gate not applicable (structure golden set 1 item) → StructureVerified(actor=harness)
acl structure→claims: 3 units  (c2 base 737 · c3 base 1209 · c5 base 1552)  causation ev-0018
extract  layer=claims  extractor=claims@v1 (promoted)  units=3  (fixture replay)
proposals: 6  — comparator NOT run (npm run compare)
```

Tail:

```
0016 · DocumentVersionIngested   · process(ingest)     · source    · cc-art2477@v9 ·
0017 · StructureProposed         · agent(structure@v1) · structure · tree-v9       · ← ev-0016
0018 ★ StructureVerified         · harness(compare)    · structure · tree-v9       · ← ev-0017  evidence: class A, same paths/types as tree-v8 (ev-0005)
0019 · ClaimProposed             · agent(claims@v1)    · claims    · clm-eserc2b   · ← ev-0018
0020 · ClaimProposed             · agent(claims@v1)    · claims    · clm-attivo4m  · ← ev-0018
0021 · ClaimProposed             · agent(claims@v1)    · claims    · clm-ricavi4m  · ← ev-0018
0022 · ClaimProposed             · agent(claims@v1)    · claims    · clm-dip20     · ← ev-0018
0023 · ClaimProposed             · agent(claims@v1)    · claims    · clm-cess3     · ← ev-0018
0024 · ClaimProposed             · agent(claims@v1)    · claims    · clm-term30    · ← ev-0018
```

Say: "Seq 18 is the harness verifying a structure tree: class A, the same paths and types as the tree a human verified; the intervals differ because the June text is twenty-one characters longer, and that is fine, intervals are compared only within a version. The five ACL steps ran between seq 18 and seq 19: filter on Verified, select three comma nodes — this time commas 2, 3 and 5, not only comma 2 — base offsets 737, 1209 and 1552, causation stamped, nothing rejected. Six proposals. Stop here."

**Checkpoint (15:53, slide 15, 2 min).** Put the six proposals on the slide (subject, value, comma). Question verbatim: *"Classify each of the six as A, B or C before the comparator runs."*
Expected answers: most of the room gets the three thresholds → C; common mistakes are cessation and the thirty-day term → A ("they are in the text, the agent is confident": being in the text is not having a belief) and `esercizi.consecutivi` → C ("three was proposed earlier"; but three was never verified, the belief is two).
Correct reasoning: the comparator looks up (lineage, subject key) in CurrentBeliefs. `esercizi.consecutivi` 2 has a human-verified belief with the same normalized value → A. `attivo.limite` 4,000,000, `ricavi.limite` 4,000,000 and `dipendenti.limite` 20 have beliefs with different values (2,000,000, 2,000,000, 10) → C. `cessazione.esercizi` 3 and `assemblea.termine` 30 giorni have no belief, because commas 3 and 5 were not extracted in segment 2 → B; both subjects resolve in the catalogue, so they are expected novelty, not unexpected.

### 15:55 — `npm run compare`

```
compare  batch=btc-v9-01  proposals=6  beliefs=4
batch gate: not applicable (golden set 4 expected items < minimum 10, illustrative); class-A audit sampling 100 %
clm-eserc2b    esercizi.consecutivi   2            A  reconfirms clm-eserc2 (human)           → ClaimVerified(harness)
clm-attivo4m   attivo.limite          4,000,000    C  conflicts clm-attivo2m (2,000,000 EUR)   → ClaimContested
clm-ricavi4m   ricavi.limite          4,000,000    C  conflicts clm-ricavi2m (2,000,000 EUR)   → ClaimContested
clm-dip20      dipendenti.limite      20           C  conflicts clm-dip10 (10)                 → ClaimContested
clm-cess3      cessazione.esercizi    3            B  no belief                                → ReviewQueue
clm-term30     assemblea.termine      30 giorni    B  no belief                                → ReviewQueue
```

Tail:

```
0025 ★ ClaimVerified             · harness(compare)    · claims    · clm-eserc2b   · ← ev-0019  evidence: A: belief clm-eserc2 (ev-0013) · btc-v9-01
0026 ★ ClaimSuperseded           · harness(compare)    · claims    · clm-eserc2    · ← ev-0025  evidence: reconfirmation-chain → clm-eserc2b
0027 ★ ClaimContested            · harness(compare)    · claims    · clm-attivo4m  · ← ev-0020  evidence: C: conflicts clm-attivo2m (2,000,000 ≠ 4,000,000)
0028 ★ ClaimContested            · harness(compare)    · claims    · clm-ricavi4m  · ← ev-0021  evidence: C: conflicts clm-ricavi2m (2,000,000 ≠ 4,000,000)
0029 ★ ClaimContested            · harness(compare)    · claims    · clm-dip20     · ← ev-0022  evidence: C: conflicts clm-dip10 (10 ≠ 20)
```

Say: "Second line of the output: the gate. With four golden items from one comma the probes cannot reach the minimum, so the gate is declared not applicable and every class-A reconfirmation is sampled for human audit. The rule is illustrative; it is printed because a rule that silently does not apply is a rule you cannot audit. Five decision events, every one with evidence that is already in the log: a belief id and a batch id. One reconfirmation, three contestations. The agent did not verify anything."

### `npm run review` (third call: the three contested claims)

The CLI shows each contested pair side by side — `clm-attivo4m` next to `clm-attivo2m`, then ricavi, then dipendenti — with both spans and both validity periods. Decision for each: verify the v9 claim, supersede the v8 claim with the v9 claim as successor, note `"L. 55/2019 in force from 2019-06-18"`.

Tail:

```
0030 ★ ClaimVerified             · human(luca)         · claims    · clm-attivo4m  · ← ev-0027  evidence: note "L. 55/2019 in force from 2019-06-18"
0031 ★ ClaimSuperseded           · human(luca)         · claims    · clm-attivo2m  · ← ev-0030  evidence: successor clm-attivo4m; valid until 2019-06-18
0032 ★ ClaimVerified             · human(luca)         · claims    · clm-ricavi4m  · ← ev-0028  evidence: note "L. 55/2019 in force from 2019-06-18"
0033 ★ ClaimSuperseded           · human(luca)         · claims    · clm-ricavi2m  · ← ev-0032  evidence: successor clm-ricavi4m; valid until 2019-06-18
0034 ★ ClaimVerified             · human(luca)         · claims    · clm-dip20     · ← ev-0029  evidence: note "L. 55/2019 in force from 2019-06-18"
0035 ★ ClaimSuperseded           · human(luca)         · claims    · clm-dip10     · ← ev-0034  evidence: successor clm-dip20; valid until 2019-06-18
```

Say: "Three disagreements, three decisions, each in the log with the date and the person. The March values are not deleted: they are superseded, with their period intact. A query 'as of 30 April 2019' will still find two million, verified — segment 4."

**Debrief (15:56) — `npm run layers-4-6`.** Prints `fallback/seg3/layers-4-6.txt` through the formatter; it is an excerpt, **not appended** to the live log (seq shown as `—`):

```
—    · EntityProposed            · agent(entities@v1)  · entities  · ent-organo    · ← ev-0030
—    ★ EntityResolved            · harness(catalog)    · entities  · ent-organo    ·            evidence: catalogue "organo di controllo" → organo-di-controllo
—    · PolicyProposed            · agent(policies@v1)  · policies  · pol-nomina    · ← (EntityResolved)
—    ★ PolicyVerified            · human(luca)         · policies  · pol-nomina    ·            evidence: cond = ≥1 of attivo/ricavi/dipendenti for 2 yrs; effect = nomina obbligatoria; exc = cessazione 3 yrs
—    · WorkflowStepProposed      · agent(workflow@v1)  · workflow  · wf-obbligo-1  · ← (PolicyVerified)
—    ★ WorkflowStepVerified      · human(luca)         · workflow  · wf-obbligo-1  ·            evidence: test input 2.5M/2.6M, 1.5M/1.6M, 8/9 → mandatory at 2019-04-30, not at 2019-06-30
```

Thirty seconds: "Same ACL at each entry, same proposed/verified rule, same evidence on decisions. The policy `nomina-obbligatoria` is the rule of comma 2 with the exception of comma 3; the workflow `obbligo-nomina` executes it for a company at a date. Policies and Workflow are never harness-verified. Not executed today; the handout has the acceptance criteria."

**Fallback.** `fallback/seg3/log-after-extract-v9.txt` (seq 1–24), `fallback/seg3/log-after-compare.txt` (seq 1–35), `fallback/seg3/layers-4-6.txt`. Sentence: "Snapshot of the same lines; the classification is deterministic so there is nothing the live run would add."

**Timing.** ingest + extract 5 s, compare 2 s, review 60 s (three pairs), layers-4-6 30 s. If over: cut the `layers-4-6` excerpt to one sentence (saves 1 min).

---

## Segment 4 — The log, projections, replay, temporal query (15:57–16:09, slides 17–21)

**On screen before the step.** Slides 17–19 (event fields; two families; projections as a fold). Tail shows seq 1–35.

### 16:00 — `npm run log:cat` (slide 19)

Prints seq 1–35 in the tail format, one screenful. Follow one chain aloud, finger on the screen, from the newest event backwards:

`ev-0033 ClaimSuperseded(ricavi2m, human)` ← `ev-0032 ClaimVerified(ricavi4m, human)` ← `ev-0028 ClaimContested(ricavi4m, harness)` ← `ev-0021 ClaimProposed(ricavi4m, claims@v1)` ← `ev-0018 StructureVerified(tree-v9, harness)` ← `ev-0017 StructureProposed(structure@v1)` ← `ev-0016 DocumentVersionIngested(cc-art2477@v9)`.

Say: "Every `*Proposed` points at a `*Verified` of the previous layer. That is the layer contract, checked mechanically by following causation ids, not by reading code."

### `npm run projections:drop` then `npm run projections:build`

```
projections-drop   removed: CurrentBeliefs, ClaimsByDocumentVersion, ConflictQueue, ReviewQueue, Timeline
projections-build  folded 35 events in 12 ms
CurrentBeliefs (cc-art2477)                                      hash 5e17c0
  attivo.limite          4,000,000 EUR  clm-attivo4m  human(luca)      ev-0030   root: human
  ricavi.limite          4,000,000 EUR  clm-ricavi4m  human(luca)      ev-0032   root: human
  dipendenti.limite      20             clm-dip20     human(luca)      ev-0034   root: human
  esercizi.consecutivi   2              clm-eserc2b   harness(compare) ev-0025   root: human (clm-eserc2, ev-0013)
ConflictQueue  0 open      ReviewQueue  4 proposed (clm-eserc3, clm-capitale [UNEXPECTED], clm-cess3, clm-term30)
```

Say: "Deleted and rebuilt, same hash. The knowledge base is this table; the record is the log on the right. There is nothing to migrate because there is nothing to keep."

**Talk (16:02, slide 20):** two projections coexist on an extractor change.

**Checkpoint (16:03, slide 20, 2 min).** Question verbatim: *"We switch to prompt v2 and replay. Which lines of the log are modified?"*
Expected answers: "the four ClaimProposed from v1 are overwritten"; "the beliefs change to v2's values"; "the superseded two-million claims disappear".
Correct reasoning: none. A replay feeds the existing `StructureVerified` events to claims@v2, which emits new `ClaimProposed` events with its own deterministic ids (producer, input, extractor version are different, so the ids are different and the append accepts them). The v1 events stay, attributable to v1. CurrentBeliefs does not change: the v2 proposals are proposed, and the harness never uses an unpromoted version for reconfirmation. The projection under v2 is a candidate shown next to the promoted one.

### 16:05 — `npm run replay:claims-v2`

```
replay  extractor=claims@v2 (candidate)  inputs: StructureVerified ev-0005 (v8: c2), ev-0018 (v9: c2, c3, c5)  (fixture replay)
proposals: 5 (v8/c2) + 6 (v9) = 11 appended, 0 duplicates
```

Tail (first five shown; the room needs to see the tag `claims@v2` and that nothing above moved):

```
0036 · ClaimProposed             · agent(claims@v2)    · claims    · clm-v2-attivo2m · ← ev-0005
0037 · ClaimProposed             · agent(claims@v2)    · claims    · clm-v2-ricavi2k · ← ev-0005
0038 · ClaimProposed             · agent(claims@v2)    · claims    · clm-v2-eserc2   · ← ev-0005
0039 · ClaimProposed             · agent(claims@v2)    · claims    · clm-v2-dip10    · ← ev-0005
0040 · ClaimProposed             · agent(claims@v2)    · claims    · clm-v2-cess3a   · ← ev-0005
0041–0046 · ClaimProposed        · agent(claims@v2)    · claims    · (v9: c2, c3, c5 — six proposals)
```

### `npm run projections:diff`

```
projections-diff  promoted=claims@v1  candidate=claims@v2  lineage=cc-art2477  per document version  (candidate = v2 proposals folded as if verified; not a belief)
version  subject                promoted (v1, verified)      candidate (v2, proposed)     status
v8       attivo.limite          2,000,000 EUR (superseded)   2,000,000 EUR                same
v8       ricavi.limite          2,000,000 EUR (superseded)   2,000 EUR                    DIFFERS
v8       esercizi.consecutivi   2 (superseded)               2                            same
v8       dipendenti.limite      10 (superseded)              10                           same
v8       cessazione.esercizi    —                            3                            candidate only (not in unit c2)
v9       attivo.limite          4,000,000 EUR                4,000,000 EUR                same
v9       ricavi.limite          4,000,000 EUR                4,000,000 EUR                same
v9       dipendenti.limite      20                           20                           same
v9       esercizi.consecutivi   2                            2                            same
v9       cessazione.esercizi    — (proposed)                 3                            candidate only
v9       assemblea.termine      — (proposed)                 30 giorni                    candidate only
```

Say: "Side by side, per version, nothing overwritten. One line differs, on the March text: two thousand euro where the text says two million. Whether v2 replaces v1 is the harness's decision, in segment 5, with evidence — and note that a diff of the current state would not have shown it, because the March claims are superseded; this is why the harness evaluates against golden items, not by diffing beliefs."

### 16:07 — `npm run beliefs:at-2019-04-30` then `npm run beliefs` (slide 21)

```
beliefs  lineage=cc-art2477  as-of=2019-04-30  (valid time: document version in force on the date)
  attivo.limite          2,000,000 EUR  clm-attivo2m  human(luca)  ev-0010   in force 2019-03-16 → 2019-06-18  (superseded by clm-attivo4m at ev-0031)
  ricavi.limite          2,000,000 EUR  clm-ricavi2m  human(luca)  ev-0011   in force 2019-03-16 → 2019-06-18  (superseded by clm-ricavi4m at ev-0033)
  dipendenti.limite      10             clm-dip10     human(luca)  ev-0015   in force 2019-03-16 → 2019-06-18  (superseded by clm-dip20 at ev-0035)
  esercizi.consecutivi   2              clm-eserc2    human(luca)  ev-0013   in force 2019-03-16 → 2019-06-18  (reconfirmed by clm-eserc2b at ev-0026)
beliefs  lineage=cc-art2477  as-of=now
  attivo.limite          4,000,000 EUR  clm-attivo4m  human(luca)      ev-0030
  ricavi.limite          4,000,000 EUR  clm-ricavi4m  human(luca)      ev-0032
  dipendenti.limite      20             clm-dip20     human(luca)      ev-0034
  esercizi.consecutivi   2              clm-eserc2b   harness(compare) ev-0025   root: human
```

Say: "The superseded claims are still in the log with their period intact; the query folds to the state that was in force on the date. Transaction time — when we learned it — is the sequence number; valid time — when it was true — is the period of validity of the document version. Both are kept and both are queryable; today only valid time is interesting, because everything in this log was learned this afternoon."

**Debrief (16:08).** Nothing to migrate: replay. Point at Terminal B: it has only grown.

**Fallback.** `fallback/seg4/log-cat.txt`, `projections-rebuilt.txt`, `projections-diff.txt`, `beliefs-at-2019-04-30.txt`. Sentence: "The fold is deterministic, so the snapshot and the live run cannot differ; here is the snapshot."

**Timing.** log-cat 60 s of talking, drop/build 2 s, replay 2 s, diff 2 s, beliefs 2 s. If over: skip `projections-diff` and show its screenshot slide (saves 40 s).

---

## Segment 5 — The harness: golden set, eval, drift, promotion (16:09–16:21, slides 22–27)

**On screen before the step.** Slides 22–23 (golden set as a query over the log; exclusions; offline vs probes). Tail shows seq 1–46.

### 16:11 — `npm run golden:claims-until-seg2` then `npm run golden:claims` (slide 23)

```
golden  layer=claims  until=seq 15  actors=human only  excluded: harness-verified 0, import-verified 0, prompt examples 0
inputs: 1 · expected items: 4   (golden set claims@g1)
  input ev-0005 (tree-v8 / c2)   expected: esercizi.consecutivi 2 [936,964) · attivo.limite 2,000,000 EUR [1000,1062)
                                           ricavi.limite 2,000,000 EUR [1067,1126) · dipendenti.limite 10 [1131,1189)
golden  layer=claims  until=seq 46  actors=human only  excluded: harness-verified 1 (ev-0025), import-verified 0, prompt examples 0
inputs: 2 · expected items: 7   (golden set claims@g2)
  input ev-0005 (tree-v8 / c2)   expected: 4 as above
  input ev-0018 (tree-v9 / c2)   expected: attivo.limite 4,000,000 EUR [1017,1079) · ricavi.limite 4,000,000 EUR [1084,1143) · dipendenti.limite 20 [1148,1206)
                                 ← human resolutions of ClaimContested ev-0027, ev-0028, ev-0029
```

Say: "Two queries, two golden-set versions, both reproducible from a sequence number. The three new items are the conflicts Luca resolved twenty minutes ago; no external labeller would have produced them, because no external labeller saw the conflict. The harness verification of the two-year rule is excluded: it derives from a human decision already in the set."

### 16:13 — `npm run eval:claims-v1` (slides 24–25)

(The eval uses golden set claims@g1 — the comma 2 of v8 item — so the numbers of the handbook come out; say so.)

```
eval  extractor=claims@v1  golden=claims@g1 (until seq 15, 4 expected)  theta_iou=0.80 (illustrative)   spans: absolute [c2-local]
expected                                      proposal (v1)                                  IoU    outcome          counts
attivo.limite 2,000,000 [1000,1062) [280,342)  attivo.limite 2,000,000 [998,1062) [278,342)  0.97   correct          TP
ricavi.limite 2,000,000 [1067,1126) [347,406)  ricavi.limite 2,000,000 [1067,1126) [347,406) 1.00   correct          TP
esercizi.consecutivi 2 [936,964) [216,244)     esercizi.consecutivi 3 [936,964) [216,244)    1.00   wrong value      FP + FN
dipendenti.limite 10 [1131,1189) [411,469)     —                                             —      missing          FN
—                                             capitale.soglia "minimo s.p.a." [720,799)     —      unexpected       FP
TP 2  FP 2  FN 2   precision 0.50   recall 0.50
→ EvalCompleted ev-0047
```

Compute pair 1 aloud: expected length 62, proposed length 64 — it took the "1) " as well — intersection `[1000,1062)` = 62, union `[998,1062)` = 64, 62/64 = 0.97 ≥ 0.80. Pair 3: perfect span, wrong number — the extractor looked in the right place and read "tre" from the cessation rule into the trigger; it costs one FP and one FN.

### 16:15 — `npm run eval:claims-v2-summary` (slide 26)

```
eval  extractor=claims@v2  golden=claims@g1  --summary
TP 3  FP 2  FN 1   precision 0.60   recall 0.75     (v1: 0.50 / 0.50)
→ EvalCompleted ev-0048
```

**Checkpoint (16:17, slide 26, 1 min).** Question verbatim: *"v2 is better on both aggregates, +0.10 precision and +0.25 recall. Assume for a moment both thresholds were met: do we promote v2?"* (the assumption is needed because precision 0.60 fails the illustrative 0.90 threshold on its own, which would make the question trivial). Expected from the room: yes. Correct answer: no, and the reason is only visible per item. Do not explain yet; run the drift.

### 16:18 — `npm run drift:v1-v2` (slides 26–27)

```
drift  from=claims@v1  to=claims@v2  golden=claims@g1  per item
expected                    v1            v2            cell
attivo.limite               correct       correct       stable
ricavi.limite               correct       wrong value   REGRESSION   (v2: 2,000 EUR — "milioni" dropped; class monetary → critical subset)
esercizi.consecutivi        wrong value   correct       improvement
dipendenti.limite           missing       correct       improvement
noise introduced by v2: cessazione.esercizi 3 (true in the article, not in unit c2, no expected item)
provenance drift: none
promotion criteria (illustrative): 1. P ≥ 0.90 → FAIL (0.60)   2. R(v2) ≥ R(v1) − 0.02 → ok   3. critical regressions = 0 → FAIL (ricavi.limite)   4. wrong-provenance ≤ 2 % → ok
→ not promoted; no ExtractorVersionPromoted; v2 proposals stay proposed, excluded from reconfirmation
```

Say: "In aggregate v2 is better and it hid a regression on a monetary value — the threshold that decides whether a company must appoint an auditor, off by a factor of a thousand. Drift is measured per item because an aggregate improvement can conceal a regression on exactly the items that matter. Criterion 1 fails too, but criterion 3 is the one that would fail even with a perfect precision." Batch gate in one sentence: "Online, the same golden items are inserted as probes into production batches, and the batch is signal only if it misses at most one and invents at most one, with zero critical errors; the rule is in counts because rates on five items are noise."

**Debrief (16:20).** Drift per item; the golden set was written by the users resolving conflicts.

**Fallback.** `fallback/seg5/golden-claims.txt`, `eval-v1.txt`, `eval-v2-summary.txt`, `drift-v1-v2.txt`. Sentence: "Metrics are pure functions of the log; this is the same table."

**Timing.** golden 2 × 2 s + 30 s talking, eval v1 2 s + 60 s talking, eval v2 2 s, drift 2 s + 60 s. If over: drop the second `npm run golden:claims` call (saves 30 s), then show the v2 summary from the slide instead of running it.

---

## Segment 6 — Consumption (16:21–16:27, slides 28–30)

**On screen before the step.** Slides 28–29 (the artifact diagram; consumption policy and the answer shape). Tail shows seq 1–48.

### 16:23 — `npm run ask:ricavi-2019-04-30` then `npm run ask:ricavi` (slide 29)

```
ask  "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"  as-of=2019-04-30  policy: monetary, time-limit → human-rooted verified only
answer: 2,000,000 EUR
  belief   clm-ricavi2m   verified by human(luca) at ev-0011   in force 2019-03-16 → 2019-06-18
  evidence span cc-art2477@v8 [1067,1126)  "ricavi delle vendite e delle prestazioni: 2 milioni di euro"
  superseded later by clm-ricavi4m (ev-0033) — not applicable on 2019-04-30
ask  "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"  as-of=now
answer: 4,000,000 EUR
  belief   clm-ricavi4m   verified by human(luca) at ev-0032 after ClaimContested ev-0028   successor of clm-ricavi2m
  evidence span cc-art2477@v9 [1084,1143)  "ricavi delle vendite e delle prestazioni: 4 milioni di euro"
sources consulted: projection only (CurrentBeliefs, Timeline); raw documents: not read
```

Say: "The agent answered from the projection and cited a belief id. From the id anyone reaches the actor, the evidence, the span and the version. Compare with 15:22: same question, and now there is evidence in the answer." Then the closing example, from the slide, no terminal: "An illustrative company: total assets 2.5 and 2.6 million, revenues 1.5 and 1.6 million, 8 and 9 employees in 2017 and 2018. Meeting on 30 April 2019: the two-million threshold on total assets is exceeded in both years, the appointment is mandatory, and the workflow cites `clm-attivo2m` and `clm-eserc2`. Meeting on 30 June 2019: no threshold of the June text is exceeded, not mandatory, citing `clm-attivo4m`, `clm-ricavi4m`, `clm-dip20`. Same company, two months apart, two answers, each with its evidence — and neither comes from reading the article at question time."

**Checkpoint (16:25, slide 30, 1 min).** Question verbatim: *"Consumption policy: monetary and time-limit quantities only from human-rooted verified beliefs. Can the agent answer on `assemblea.termine` — the thirty days — and on `esercizi.consecutivi` — the two years — under the June text?"*
Expected answers: "the thirty days yes, the agent extracted it" (it is proposed, class B, in the review queue); "the two years no, it was verified by the harness, not a human" (the policy is applied to the root of the evidence chain).
Correct reasoning: `assemblea.termine` 30 giorni is still `proposed` — class B, nobody decided — so the agent must say it cannot assert it and may report that it is pending. `esercizi.consecutivi` 2 under v9 is `verified` by the harness in class A, and its evidence is the v8 claim a human verified (ev-0013); the policy "human-rooted" is satisfied by the root of the chain, so the agent may answer, citing `clm-eserc2b` and its root.

**Debrief (16:26).** Projection, not documents.

**Fallback.** `fallback/seg6/ask.txt`. Sentence: "Same two answers, recorded; the belief ids are the ones on the screen on the right."

**Timing.** Two commands, 2 s each, 60 s of talking plus 30 s for the closing example. Nothing to cut; if the session is already over time, skip the second `ask` and state the answer.

---

## Close (16:27–16:30, slide 31)

No terminal. Three decisions and what each costs, read from the slide, one sentence each:

1. Explicit contested state resolved by a human instead of a merge — cost: latency between ingestion and availability, and a review queue to staff.
2. The log is the record and the knowledge base is a projection — cost: storage grows with events and never compacts; every extractor change replays the layer and the ones after it.
3. Per-layer golden sets derived from the log — cost: golden sets frozen and versioned per layer, and a subject catalogue maintained by hand; plus the stated hidden cost that an initial human error is reconfirmed in class A until sampling or a supersession catches it.

QR to the handout (entity list, event catalogue, repository). Then questions (16:30–16:40, `06-qa-and-checklist.md`). Leave Terminal B visible during Q&A: questions about "what is in the log" can be answered by pointing.

---

## Inconsistencies found while writing this script (to resolve before 15:20)

1. **`beliefs --at <date>` must be a valid-time query.** Handbook §4.8 describes the temporal query as a fold "up to that date (or up to the sequence number that was current on that date)", i.e. transaction time. In the room every event is appended on 28 Oct 2026, so a transaction-time fold to 2019-04-30 returns an empty projection. The script and the expected output above treat `--at` as valid time: the belief whose document version was in force on the date, with a superseded claim valid until its successor's effective date. `src/projections/` (beliefs-at-date) and the README must say which of the two the command implements; only the valid-time reading produces "2,000,000 EUR" on stage.
2. **`npm run show -- --event last` prints the `capitale.soglia` proposal**, not the `ricavi.limite` one, if claims@v1 emits in the order of the fixture. The script uses `npm run show:ricavi-v8`; the run sheet line matches.
3. **Actor kind for ingestion and log-init.** Handbook §4.2 lists four actor kinds (human, agent, harness, import). `LogInitialised` and `DocumentVersionIngested` are produced by the deterministic ingestion process, which is none of the four. The script prints `process(ingest)` / `process(log-init)`; the schema should either add `process` or assign these to `harness`.
4. **Replay of claims@v2 over v9** appends six proposals that nobody evaluates (the golden set for v9 has three items, and `eval` runs on claims@g1). Harmless, but the room will see 11 lines appear; the script says "five plus six" so it is not read as an error.
5. **Promotion criterion 1 also fails for v2** (precision 0.60 < 0.90). The handbook example states that v2 "fails criterion 3"; it fails 1 and 3. The script says so explicitly and keeps criterion 3 as the argument (it would fail even at perfect precision).
6. **`projections:diff` on current beliefs alone would not show the v2 regression**, because the v8 claims are superseded by the time of the replay and v2's proposals on v9 are correct (`00-running-example.md` §6). The script therefore has `projections:diff` print per document version, so the "2,000 EUR vs 2,000,000 EUR" line is visible on the v8 row; the repository must implement the diff per version, or the segment 4 output will be all "same". Alternative to consider in the sheet: let the v2 normalization bug ("milioni" dropped) also affect v9's `ricavi.limite` (4,000 EUR), which is what a real normalization bug would do; this would change the v9 candidate row to DIFFERS without touching the segment 5 numbers, which are computed on claims@g1 (v8 only).
7. **The segment 3 structure reconfirmation needs the cold-start exemption too** (run sheet rev. 12): the Structure golden set holds one item, so the gate cannot run; the extract output above prints "gate not applicable (structure golden set 1 item)" for that reason.
