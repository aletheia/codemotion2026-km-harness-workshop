# Running example — art. 2477 of the Italian Civil Code (three versions in force during 2019)

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revision 4, 27 Oct 2026 (evening). This sheet is the single source of truth for names, values, spans, dates and worked numbers; every other file must agree with it.

## 1. Why this document

Art. 2477 c.c. ("Sindaco e revisione legale dei conti") sets when an Italian s.r.l. must appoint a statutory auditor or audit firm. Its thresholds changed twice within three months of 2019: the Codice della crisi (D.Lgs. 14/2019, art. 379, in force 16 March 2019) replaced the old "two of the three limits of art. 2435-bis" with "at least one of" total assets 2 million, revenues 2 million, 10 employees; the conversion law of the "sblocca cantieri" decree (L. 55/2019, art. 2-bis, in force 18 June 2019) doubled them to 4 million, 4 million, 20 employees. The text is public (acts of the Italian State are not protected by copyright, art. 5 L. 633/1941), official (Normattiva publishes every version with its period of validity), Italian, and relevant to anyone in the room who runs or advises a company. It has every property the spine needs: conflict (three values of the same quantity), supersession with real effective dates, retraction, temporal queries ("what did the article say on 30 April 2019?"), a rule with condition, effect and exception (Policy), and an executable decision (Workflow: given the balance sheets of two years, is the appointment mandatory?).

## 2. Source and versions

Source: Normattiva, R.D. 16 marzo 1942, n. 262 (atto 042U0262), art. 2477, article versions 7, 8 and 9 as served by `/atto/caricaArticolo?…&art.idArticolo=2477&art.versione=N`. Retrieved 27 Oct 2026. The fixtures reproduce the consolidated text without Normattiva's `((…))` amendment markers; the line "COMMA ABROGATO DAL D.L. 24 GIUGNO 2014, N. 91 …" is kept because the consolidated text carries it and because it explains the comma numbering (section 7).

| File | Normattiva version | In force | Amending act | Characters | What changes |
| --- | --- | --- | --- | --- | --- |
| `cc-art2477-v7.txt` | 7 | 21 Aug 2014 – 15 Mar 2019 | D.L. 91/2014, art. 20 c. 8, conv. L. 116/2014 | 1,697 | lett. c): "per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis"; cessation after two years; no comma on art. 2409 |
| `cc-art2477-v8.txt` | 8 | 16 Mar 2019 – 17 Jun 2019 | D.Lgs. 14/2019, art. 379 | 1,991 | lett. c): "almeno uno dei seguenti limiti": attivo 2 milioni, ricavi 2 milioni, 10 unità; cessation after three years; registrar may notify the court; art. 2409 applies |
| `cc-art2477-v9.txt` | 9 | from 18 Jun 2019 | D.L. 32/2019, art. 2-bis, conv. L. 55/2019 | 2,012 | 4 milioni, 4 milioni, 20 unità; cross-references corrected from "terzo comma" to "secondo comma" |

Entry into force confirmed on the Gazzetta Ufficiale index of D.Lgs. 14/2019 (art. 379 listed among the articles in force on 16/03/2019) and in the text of L. 55/2019 (art. 1 c. 3, in force the day after publication in GU n. 140 of 17 June 2019).

Lineage: `cc-art2477`. Live walkthrough: v8 is ingested in segment 2, v9 in segment 3. v7 is used only in the segment 1 retrieval baseline (three conflicting passages) and is left in the fixtures for the reader (its lett. c) is a claim by reference to another article, which the catalogue flags as unexpected novelty — a good exercise, not shown).

## 3. Structure (layer 2)

Each file: five header lines (document, section, article title, validity, source) then one paragraph per comma. Section paths follow the numbering used by the text in force today (v9 says "secondo comma" for the comma with the thresholds); the abrogated comma is a node of type `note` and never becomes an extraction unit.

| Path | Type | v8 interval | v9 interval | Content |
| --- | --- | --- | --- | --- |
| header | index | [0, 328) | [0, 345) | document, section, title, validity, source |
| c1 | comma | [330, 606) | [347, 623) | the articles of association may provide for a control body or auditor |
| abrogato | note | [608, 718) | [625, 735) | "COMMA ABROGATO DAL D.L. 24 GIUGNO 2014 …" |
| c2 | comma | [720, 1190) | [737, 1207) | mandatory appointment: a), b), c) with the three limits |
| c3 | comma | [1192, 1377) | [1209, 1396) | cessation after three consecutive years |
| c4 | comma | [1379, 1531) | [1398, 1550) | rules of the s.p.a. board apply |
| c5 | comma | [1533, 1889) | [1552, 1910) | the meeting appoints within thirty days; the court otherwise |
| c6 | comma | [1891, 1990) | [1912, 2011) | art. 2409 applies |

(Intervals are character offsets, half-open, from `manifest.json`; the header interval is the five lines up to the blank line; paragraphs are separated by one blank line, so each node starts two characters after the previous one ends.) The v8 and v9 trees have the same paths and types and differ only in offsets; the harness reconfirms the v9 tree as class A against the human-verified v8 tree (tree equality is by path and type; intervals are compared per node only within the same version).

Real-world note for the Structure segment: v8 says "lettera c) del terzo comma" because the drafter counted the abrogated comma; v9 corrected it to "secondo comma". The tree takes the v9 reading; the note node makes the discrepancy visible instead of hiding it.

## 4. Subject catalogue (Claims layer)

| Subject key | Quantity | Class | Normalized type | Synonyms |
| --- | --- | --- | --- | --- |
| `attivo.limite` | threshold on total assets | monetary (critical) | money EUR | "totale dell'attivo", "attivo dello stato patrimoniale" |
| `ricavi.limite` | threshold on revenues | monetary (critical) | money EUR | "ricavi delle vendite e delle prestazioni", "ricavi" |
| `dipendenti.limite` | threshold on average employees | count (critical) | integer (count) | "dipendenti occupati in media", "unità" |
| `esercizi.consecutivi` | years the threshold must be exceeded | time-limit (critical) | integer (years) | "esercizi consecutivi" |
| `cessazione.esercizi` | years without exceeding after which the obligation ends | time-limit (critical) | integer (years) | "cessa quando, per … esercizi" |
| `assemblea.termine` | days the meeting has to appoint | time-limit (critical) | integer (days) | "entro trenta giorni" |
| `limiti.riferimento` | limits defined by reference to another article | reference | reference (lineage id) | "limiti indicati dal … articolo 2435-bis" (v7 only) |

Critical subset (handbook §6.4, criterion 3): the classes **monetary** (`attivo.limite`, `ricavi.limite`), **count** (`dipendenti.limite`) and **time-limit** (`esercizi.consecutivi`, `cessazione.esercizi`, `assemblea.termine`); there is no "exclusion" class in this domain. `limiti.riferimento` is not critical.

Not in the catalogue (unexpected novelty if proposed): `capitale.soglia` (the pre-2014 capital trigger), anything about consolidated accounts or control of audited companies (lett. a and b are policy conditions, not quantities). An unexpected proposal goes to the human queue with high priority and is shown as such by the review CLI; for the eval it is an unpaired proposal, one FP.

## 5. Expected claims (golden items after the human review)

Spans are absolute character intervals; section-local = absolute − base offset of the unit (c2 base: v8 720, v9 737).

| Version | Subject key | Normalized value | Absolute span | c2-local | Text |
| --- | --- | --- | --- | --- | --- |
| v8 | `esercizi.consecutivi` | 2 | [936, 964) | [216, 244) | `per due esercizi consecutivi` |
| v8 | `attivo.limite` | 2,000,000 EUR | [1000, 1062) | [280, 342) | `totale dell'attivo dello stato patrimoniale: 2 milioni di euro` |
| v8 | `ricavi.limite` | 2,000,000 EUR | [1067, 1126) | [347, 406) | `ricavi delle vendite e delle prestazioni: 2 milioni di euro` |
| v8 | `dipendenti.limite` | 10 | [1131, 1189) | [411, 469) | `dipendenti occupati in media durante l'esercizio: 10 unità` |
| v9 | `esercizi.consecutivi` | 2 | [953, 981) | [216, 244) | `per due esercizi consecutivi` |
| v9 | `attivo.limite` | 4,000,000 EUR | [1017, 1079) | [280, 342) | `… 4 milioni di euro` |
| v9 | `ricavi.limite` | 4,000,000 EUR | [1084, 1143) | [347, 406) | `… 4 milioni di euro` |
| v9 | `dipendenti.limite` | 20 | [1148, 1206) | [411, 469) | `… 20 unità` |
| v9 | `cessazione.esercizi` | 3 | [1324, 1352) | c3 | `per tre esercizi consecutivi` |
| v9 | `assemblea.termine` | 30 days | [1664, 1683) | c5 | `entro trenta giorni` |

Golden item of segment 2 (Claims layer): input = `StructureVerified` section c2 of v8; expected = the four v8 rows above. "Almeno uno dei seguenti limiti" is not a Claim: it is the combinator of the Policy (section 9).

Golden set after segment 3 (no cut-off): two golden items — c2 of v8 with four expected entries, c2 of v9 with three expected entries (the human resolutions of the attivo, ricavi and dipendenti conflicts); `esercizi.consecutivi` of v9 is harness-verified and therefore excluded. `npm run golden:claims` prints "2 items, 7 expected"; the walkthrough says "seven expected items on two sections".

## 6. Extractor fixtures and the worked numbers (handbook §6.2–6.4 — the counts are unchanged)

claims@v1 on c2 of v8 proposes four claims:

| Proposal | Value | Span (c2-local) | Against expected | Outcome |
| --- | --- | --- | --- | --- |
| `attivo.limite` | 2,000,000 EUR | [278, 342) — includes the "1) " | [280, 342) | correct; IoU 62/64 = 0.97 |
| `ricavi.limite` | 2,000,000 EUR | [347, 406) | [347, 406) | correct; IoU 1.00 |
| `esercizi.consecutivi` | **3** | [216, 244) | value 2 | wrong value, right span: the model conflated the cessation rule ("tre esercizi") with the trigger ("due esercizi") |
| `capitale.soglia` | "minimo s.p.a." (enum) | [0, 79) | — | unexpected: the model reproduced the capital trigger abrogated in 2014, anchored on the opening sentence; the catalogue does not resolve the subject |
| `dipendenti.limite` | — | — | expected 10 | missing |

Counts: TP 2, FP 2, FN 2; precision 0.50, recall 0.50. Human review (segment 2): verifies attivo and ricavi; leaves `esercizi.consecutivi 3` and `capitale.soglia` proposed; adds `esercizi.consecutivi 2` and `dipendenti.limite 10` by hand (`ClaimProposed(actor=human)`, then `ClaimVerified`). Golden set: four items.

claims@v2 on the same unit: attivo correct (span [280, 342), IoU 1.00); esercizi 2 correct; dipendenti 10 correct; **`ricavi.limite` = 2,000 EUR** (wrong value: "milioni" dropped in normalization — monetary, critical subset); unexpected `cessazione.esercizi 3` anchored on [216, 244) (a true statement of the article, but not in this unit and not in this item). Counts: TP 3, FP 2, FN 1; precision 0.60, recall 0.75. Drift matrix per item: attivo stable; ricavi **regression**; esercizi improvement; dipendenti improvement. Promotion refused: criterion 3 (regression on a critical item), and criterion 1 (0.60 < 0.90 illustrative). The v2 fixture on v9 produces six correct proposals (not evaluated; eleven v2 lines appear on replay: five for v8, six for v9). `npm run projections:diff` compares the candidate projection of claims@v2 with the promoted one of claims@v1 per document version, so the ricavi regression (2,000 EUR vs 2,000,000 EUR) is visible on the v8 row even though the v8 beliefs are superseded in CurrentBeliefs.

claims@v1 on v9 (segment 3; units c2, c3, c5) proposes six correct claims — the fixture is chosen so that the comparator, not the extractor, is on show:

| Proposal | Value | Belief in CurrentBeliefs | Class |
| --- | --- | --- | --- |
| `esercizi.consecutivi` | 2 | 2 (human, v8) | **A** reconfirmation |
| `attivo.limite` | 4,000,000 EUR | 2,000,000 (human, v8) | **C** conflict |
| `ricavi.limite` | 4,000,000 EUR | 2,000,000 (human, v8) | **C** conflict |
| `dipendenti.limite` | 20 | 10 (human, v8) | **C** conflict |
| `cessazione.esercizi` | 3 | none (c3 was not extracted in segment 2) | **B** novelty |
| `assemblea.termine` | 30 days | none (c5 not extracted in segment 2) | **B** novelty |

Segment 3 review: the reviewer verifies the three v9 claims and declares the three v8 claims superseded with their v9 successors (three decisions, one screen). The two class-B claims stay proposed.

Structure in segment 3: `StructureVerified(actor=harness)` class A — same paths and types as the verified v8 tree (across versions, tree equality is by path and type; node intervals are compared only within the same version, since the offsets differ by construction). The cold-start exemption applies to Structure too (its golden set holds one item). `npm run compare` on the six claims emits one `ClaimVerified(actor=harness)` (esercizi, with the reconfirmation-chain supersession of the v8 claim), three `ClaimContested` and leaves two proposals queued. Cold-start rule (run sheet rev. 4): the batch gate is not applicable (golden set 4 < 10), class A is decided by the comparator, audit sampling 100 %; `npm run compare` prints the line.

## 7. Dates, queries and answers

| Query | Date semantics | Answer | Cited belief |
| --- | --- | --- | --- |
| "Soglia dei ricavi per la nomina obbligatoria, assemblea del 30 aprile 2019 che approva il bilancio 2018" | valid time, `--at 2019-04-30` | 2,000,000 EUR | v8 `ricavi.limite`, verified by human, span [1067, 1126) in `cc-art2477-v8.txt` |
| same question, today | valid time, now | 4,000,000 EUR | v9 `ricavi.limite`, verified by human after contestation, successor of the v8 belief |
| "Quanti esercizi consecutivi?" | now | 2 | v9 `esercizi.consecutivi`, harness class-A reconfirmation rooted in the v8 human verification |
| "Entro quanti giorni deve provvedere l'assemblea?" | now | not answerable under the monetary/time-limit policy: the belief is proposed (class B) | `assemblea.termine`, proposed |

Segment 1 baseline question: "L'assemblea del 30 aprile 2019 approva il bilancio 2018. Quale soglia di ricavi si applica, e su quale evidenza presente nel chunk?" — the index holds v7, v8 and v9; the query "soglia ricavi nomina organo di controllo" returns three passages with comparable scores ("due dei limiti … 2435-bis", "2 milioni di euro", "4 milioni di euro"); no field says which was in force.

Transaction-time queries (`--seq <n>`) exist but show nothing on stage: every event is appended on 28 Oct 2026.

## 8. Checkpoints

| Seg. | Question | Correct answer |
| --- | --- | --- |
| 1 | Assemblea del 30 aprile 2019, bilancio 2018: quale soglia di ricavi, su quale evidenza nel chunk? | None in the chunk; version and validity were discarded at chunking. |
| 2 | `ricavi.limite 2.000.000` è verified; un'estrazione successiva propone 4.000.000 sullo stesso soggetto. Stato di ciascuna claim dopo l'evento, e chi può emetterlo? | 2,000,000 stays verified; 4,000,000 is born proposed and becomes contested by the harness; resolution is human only. |
| 3 | Six proposals on screen: classify each as A, B or C before the comparator runs. | A: esercizi 2 · C: attivo 4 M, ricavi 4 M, dipendenti 20 · B: cessazione 3, termine 30 giorni. |
| 4 | We switch to prompt v2 and replay: which lines of the log are modified? | None; v2 `ClaimProposed` are appended; CurrentBeliefs unchanged until promotion. |
| 5 | v2 is better on both aggregates; assume the thresholds were met: promote? | No: per-item drift shows a regression on `ricavi.limite`, monetary, critical. |
| 6 | Policy: monetary and time-limit quantities only from human-rooted beliefs. Can the agent answer on `assemblea.termine` and on `esercizi.consecutivi`? | termine: no (proposed, class B). esercizi: yes (harness reconfirmation whose evidence is the v8 human verification; the policy applies to the root of the chain). |

## 9. Layers 4–6 (pre-computed excerpt, `layers-4-6`)

Entities: `organo-di-controllo`, `revisore`, `societa-srl`, `assemblea`, `tribunale`, `registro-imprese` (catalogue ids); mentions resolved from the verified claims' subject text. Two Policies, one per regime, because a Policy references verified claims and carries an applicability period: `nomina-obbligatoria@v8` (16 Mar 2019 – 17 Jun 2019, referencing the v8 claims, superseded by the next) and `nomina-obbligatoria@v9` (from 18 Jun 2019, referencing the v9 claims). Each: condition = for `esercizi.consecutivi` consecutive years at least one of `attivo.limite`, `ricavi.limite`, `dipendenti.limite` is exceeded; effect = appointment of a control body or auditor is mandatory; exception = the obligation ceases after `cessazione.esercizi` consecutive years without exceeding any limit (comma 3). Workflow `obbligo-nomina` (use case: "is the appointment mandatory for this s.r.l. at this meeting date?"): step 1 resolve the policy and thresholds in force at the date (valid time); step 2 compare the last two balance sheets with each threshold; step 3 apply the combinator (at least one, both years); step 4 apply the exception; output: mandatory yes/no with the list of belief and policy ids. Golden test input (illustrative company): attivo 2.5 M / 2.6 M, ricavi 1.5 M / 1.6 M, dipendenti 8 / 9 for 2017 / 2018 → at 30 Apr 2019: mandatory (attivo > 2 M both years); at 30 Jun 2019: not mandatory (no limit of the v9 regime exceeded). The same company, two months apart, two answers: this is the closing example of segment 6.

## 10. Priors (handbook §3.6) in this domain

Import from a system of record: `fixtures/documents/compliance-register.csv`, the thresholds a firm currently applies (illustrative: the v9 values), entering as `ClaimVerified(actor=import)`. Reference edition: v9 reviewed in full once. Subject catalogue: section 4. Not used live; present for the cold-start discussion and the tests.

## 11. Names used everywhere

| Item | Name |
| --- | --- |
| Lineage | `cc-art2477` |
| Document versions | v7 (21 Aug 2014, baseline only), v8 (16 Mar 2019), v9 (18 Jun 2019) |
| Extraction unit shown live | comma 2 (`c2`), base offset 720 (v8) / 737 (v9) |
| Conflict used in checkpoints 2, 4, 5, 6 | `ricavi.limite` 2,000,000 → 4,000,000 EUR |
| Class A in segment 3 | `esercizi.consecutivi` 2 |
| Class C in segment 3 | `attivo.limite`, `ricavi.limite`, `dipendenti.limite` |
| Class B in segment 3 | `cessazione.esercizi` 3, `assemblea.termine` 30 giorni |
| v1 wrong value | `esercizi.consecutivi` 3 |
| v1 unexpected proposal | `capitale.soglia` (abrogated trigger) |
| v1 missing | `dipendenti.limite` 10 |
| v2 regression | `ricavi.limite` 2,000 EUR |
| IoU spoken aloud | 62/64 = 0.97 |
| Temporal query | "assemblea del 30 aprile 2019, bilancio 2018" / `--at 2019-04-30` |
| Retrieval query | "soglia ricavi nomina organo di controllo" |
| Prior (illustrative, not live) | `compliance-register.csv` |
| npm scripts | `rag:index`, `rag:query`, `rag:delete-v8`, `rag:extract-c2`, `log:init`, `log:reset`, `ingest:v8`, `ingest:v9`, `extract:structure-v8`, `extract:claims-v8`, `extract:v9`, `show:ricavi-v8`, `review`, `review:auto`, `compare`, `layers-4-6`, `log:cat`, `projections:drop`, `projections:build`, `replay:claims-v2`, `projections:diff`, `beliefs:at-2019-04-30`, `beliefs`, `golden:claims-until-seg2`, `golden:claims`, `eval:claims-v1`, `eval:claims-v2-summary`, `drift:v1-v2`, `ask:ricavi-2019-04-30`, `ask:ricavi`, `dry-run`, `tail`, `test` |
| Fallback files | `fallback/seg1/rag-query.txt`, `rag-after-delete.txt`, `rag-extract.txt`; `seg2/log-after-extract.txt`, `log-after-verify.txt`; `seg3/log-after-extract-v9.txt`, `log-after-compare.txt`, `layers-4-6.txt`; `seg4/log-cat.txt`, `projections-rebuilt.txt`, `projections-diff.txt`, `beliefs-at-2019-04-30.txt`; `seg5/golden-claims.txt`, `eval-v1.txt`, `eval-v2-summary.txt`, `drift-v1-v2.txt`; `seg6/ask.txt` |
| Critical subset | monetary, count, time-limit |
