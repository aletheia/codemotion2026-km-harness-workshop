# Anticipated Q&A and pre-talk checklist

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revision 4, 27 Oct 2026. Q&A slot 16:30–16:40 (slide 31 stays on screen). Answers are written as Luca would say them, in full sentences, 45–75 seconds each. Two spare questions follow the six. Running example: art. 2477 c.c., Normattiva versions 7, 8 and 9 (`00-running-example.md`).

## Six anticipated questions

**1. "Why not just attach the version and the date of entry into force as metadata on the chunks and filter at query time?"**
Metadata filtering fixes failure (a) only when the query already knows which version applies, which is the thing the system is supposed to know; "the meeting of 30 April 2019 that approves the 2018 accounts" has to be resolved to the text in force on that date by something, and that something is a belief with a valid-time period, not a filter parameter. It does nothing for failure (b): three chunks of art. 2477 tagged with three different versions are still three unrelated vectors, so the system cannot say they are about the same threshold, cannot contest one with the other, and cannot record that the 18 June text superseded the 16 March text. And it does nothing for failure (c), because the extraction is still one opaque step. Metadata on chunks is provenance at document granularity; the model needs it at span granularity with a lifecycle on top. If the document set has no supersession and no conflicts, metadata filtering is enough and I would use it — chapter 8.4 of the handbook says exactly when.

**2. "Doesn't the human review become the bottleneck? You have replaced an index with a queue."**
Yes, there is a queue, and that is on the costs slide: a claim is not consumable until it is verified, and retrieval is immediate. What the three-class rule changes is what the queue is proportional to. Under "a human verifies everything", cost is proportional to volume, and every re-projection — a new version of the text, a new extractor — reproduces the whole volume, so extractor changes never happen. Under the three-class rule, cost is proportional to novelty plus conflict: on the illustrative 300-claim document, 60 decisions with a system-of-record prior, 50 for the next version, 12 for a new extractor version. Today you saw it on a small scale: the June 2019 text produced six proposals, and the reviewer took three decisions, the three conflicts; the reconfirmation cost nothing and the two novelties wait in the queue. The human reviews deltas, and the deltas are exactly the interesting cases. The hidden cost is also stated: an initial human error is reconfirmed in class A at every re-projection unless sampling or a later supersession catches it.

**3. "Why a deterministic comparator for same/novel/conflict? An LLM judge would handle synonyms and phrasing much better."**
Because the classification has to be reproducible and attributable. A class-A reconfirmation emits a `ClaimVerified` with an actor and evidence; if the actor were a model, the evidence would be another non-deterministic output, and the rule "agents never verify" would be broken by a third agent. The synonym problem is real, and it is solved where it belongs: in the subject catalogue, a versioned, hand-maintained list of subjects and quantities with synonyms — "ricavi delle vendite e delle prestazioni" and "ricavi" both resolve to `ricavi.limite`. A subject the catalogue does not resolve is an unexpected novelty and goes to a human with high priority, which is the correct behaviour: today it was `capitale.soglia`, the capital trigger abrogated in 2014 that the extractor reproduced from memory; either the catalogue is incomplete or the extractor invented a subject, and both are things a person must see. The catalogue is a cost; it is on the costs slide too. Where a language model is useful in this path is to propose catalogue entries, which enter as proposals like everything else.

**4. "Why not a knowledge graph or an ontology as the final layer? That is what most knowledge-management stacks do."**
Because an ontology is a second artifact with its own drift and, in practice, no owner, and because the relations that matter in a regulated domain are rules with conditions and exceptions. "The appointment of a control body is mandatory if for two consecutive years at least one of the three thresholds is exceeded, and the obligation ceases after three consecutive years in which none is exceeded" is the Policy `nomina-obbligatoria` — condition, effect, exception, each element referencing verified claims — and a graph edge cannot carry the exception, the combinator "at least one", or the applicability period that changed on 18 June 2019. The Entities layer keeps a flat canonical catalogue with synonyms, which is what the comparator and the golden sets need; the relations live in the Policies layer, which has its own events, acceptance criteria and golden items and is never harness-verified because an error there has executable effect. If someone needs a graph view, it is a projection over the log like any other, and it can be dropped and rebuilt.

**5. "This is a JSONL file and one article. How does it scale to the whole Civil Code, thousands of documents and parallel agents?"**
The file is the workshop's storage; the model requires only ordered append and idempotent append, so moving to a partitioned log is an adapter change, not a model change. Parallelism is already in the design: extractors run per extraction unit, fan out freely and are restartable, because the event id is deterministic from (producer, input artifact, extractor version) and the append discards duplicates; each extractor keeps a cursor persisted as an event. Projections are folds and can be rebuilt per lineage, which is the natural partition key, since beliefs are compared within a lineage — one article is one lineage, and the Code is a few thousand of them. The things that do not scale for free are stated: storage grows with events and the log is not compacted; re-projection replays a layer and the ones after it; golden sets must be frozen and versioned per layer. Those are the costs of correctness over time, and they are cheaper than the alternative, which is re-extracting everything and overwriting.

**6. "Which agent framework and which model do you use for the extractors, and how much does the choice matter?"**
The extractors are Claude-backed, and the model id, prompt version and extractor version are recorded in the actor of every proposal, so the choice is attributable in the log and can be changed per layer by replay. No framework is used in the repository: the ACL, the comparator, the log, the projections and the harness are small pure TypeScript functions, and the point of the walkthrough is that the decision path stays visible and testable. A framework would wrap the extractors — retries, tool calls, structured output — and never the decision path; if one were needed in production, I would use Strands Agents with its TypeScript SDK. The choice matters less than people expect because the model is, by construction, an unreliable producer whose output is always proposed: the harness measures each version against the golden set and decides promotion per layer, so swapping a model is a replay plus an eval, not a migration.

## Two spare questions

**7. "Where do the golden sets come from on day one, when nobody has verified anything?"**
From the three forms of prior: an import from a system of record, which enters the log as `ClaimVerified(actor=import)` with the source record as evidence — in this domain, the firm's compliance register with the thresholds it applies today, which is in the fixtures as `compliance-register.csv`; a reference version reviewed in full once; and the subject catalogue, which supplies no values but orders the queue. Import-verified beliefs are excluded from golden sets and sampled harder, so the first human-written golden items come from the first conflicts and novelties the reviewers resolve. Until a layer's golden set reaches the probe minimum, the batch gate is not applicable and class-A reconfirmations are sampled at 100 % (illustrative rule; it is printed by the comparator).

**8. "What happens when the Structure extractor changes and the section tree is different?"**
The new tree is a `StructureProposed`; if it differs from the verified tree it is class C for the Structure layer and a human resolves it. Once verified, the Claims ACL produces new extraction units with new base offsets; replaying the Claims extractor on them appends new proposals attributable to the same claims version. That is the whole point of the anti-corruption layer: the Claims extractor's input contract is fixed and versioned independently, so a change upstream shows up as a structure decision and a replay, not as an unattributable drift in the claims. Art. 2477 has a real case of this: the 16 March 2019 text says "lettera c) del terzo comma" because the drafter counted the abrogated comma, and the 18 June text corrected it to "secondo comma". Whether the abrogated comma is a counted node or a note is a Structure decision, taken once by a human and recorded; the Claims extractor never sees the question.

## Pre-talk checklist

Morning of Wed 28 Oct; be in the room by 15:05.

Repository and demo

- [ ] `git clone` into a clean directory, `npm ci` with the network off, `npm run dry-run` green three times in a row, byte-identical (`CLAUDE_CODE_INSTRUCTIONS.md` §11).
- [ ] `fixtures/documents/` holds `cc-art2477-v7.txt`, `cc-art2477-v8.txt`, `cc-art2477-v9.txt`, `manifest.json`, `compliance-register.csv`; the content hashes match `manifest.json`.
- [ ] `fixtures/llm/` complete for `structure@v1`, `claims@v1`, `claims@v2` on v8 and v9; the replayer fails loudly on a missing fixture (verify by renaming one and running `npm run extract:claims-v8`).
- [ ] `fallback/seg1` … `fallback/seg6` present and non-empty; open the folder in a second terminal tab before 15:20.
- [ ] `npm run log:init` run once before the session and the log removed again, so that the first live `npm run log:init` starts from an empty file (or keep a pre-initialised copy for the fallback path).
- [ ] Verified on screen: `npm run rag:query` returns the three lett. c) passages (2435-bis, 2 milioni, 4 milioni); `npm run compare` prints the cold-start gate line; `npm run beliefs:at-2019-04-30` returns `ricavi.limite` 2,000,000 EUR (valid time); `npm run show:ricavi-v8` prints the `ricavi.limite` proposal; `npm run drift:v1-v2` lists criteria 1 and 3 as failed; `npm run golden:claims` with and without `UNTIL` returns 4 and 7 items.
- [ ] Terminal: light theme, ≥ 18 pt, two panes (left: commands; right: `npm run tail`), `npm run tail` started before the first slide; window arrangement saved.
- [ ] README sections 1–6 present, including the three-class table and the golden-set-from-log definition; repository link resolves from a phone (QR on slide 31).

Slides

- [ ] Official Codemotion template (19 Oct mail), 16:9, Codemotion font, no cover slide; 31 visible slides.
- [ ] Hidden screenshot slide after every live slide (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23–27, 29) holding the corresponding `fallback/` output.
- [ ] Slide 2 (the domain) shows the three versions with their dates of entry into force and the Normattiva source.
- [ ] Slide 31: three decisions and costs; QR to the handout; QR to the repository; both scanned once.
- [ ] Presenter notes = speaker notes from `02-slide-outline.md`; clicker tested; the deck exported to PDF as a second fallback.

Materials

- [ ] Handout (`07-handout.md`) exported to a one-page PDF and published at the handout URL.
- [ ] Run sheet printed (`01-run-sheet.md`), times in CET; a visible clock or timer.
- [ ] Six Q&A answers re-read once.

Logistics (from `talk-brief.md`)

- [ ] Laptop, HDMI adapter, EU charger, mini-jack if audio is needed; wired RJ45 is speaker-only and not required.
- [ ] Hotel in Milan; speaker dinner decision (Codemotion Milan vs mlopsday Bologna, both Wed 28 Oct); travel Milan ↔ Bologna on Thu 29 Oct.
