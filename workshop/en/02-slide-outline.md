# Slide-by-slide outline — "Documents Are Not Knowledge: Modelling Extraction as an Event-Driven Domain"
Revision 4, 27 Oct 2026 (English; running example: art. 2477 c.c., see `00-running-example.md`). Codemotion template, 16:9, Codemotion font, no cover slide. 33 visible slides (31 numbered, plus 5a from `02c-phase-explainers.md` and 6a), one idea each. Every live slide (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23, 24, 25, 26, 27, 29) is followed by a hidden slide holding a screenshot of the corresponding `fallback/segN/` output; the hidden slide is shown only if the live command fails. All thresholds, counts and percentages of the harness are illustrative, as in the handbook; the dates and amounts of art. 2477 are the official text (Normattiva).

## Slide index

| # | Segment | Title | Form |
| --- | --- | --- | --- |
| 1 | 1 | Chunk → embed → retrieve → hope: what is lost (identity, provenance, time) | diagram |
| 2 | 1 | The domain: art. 2477 c.c., three versions in force during 2019, what changes | table |
| 3 | 1 | Failure (a): unresolvable conflict | live + screenshot |
| 4 | 1 | Failure (b): no retraction | live + screenshot |
| 5 | 1 | Failure (c): no per-layer evaluation | live + screenshot |
| 6 | 2 | Six entities: identity and invariants | table |
| 6a | 2 | Six layers: art. 2477 from text to decision | table |
| 7 | 2 | Claim as an aggregate: Spans inside, absolute coordinates, version | diagram |
| 8 | 2 | Domain-design concepts used and their effect | table |
| 9 | 2 | Lifecycle: the state machine | diagram |
| 10 | 2 | Who may emit what; why not a merge | table |
| 11 | 2 | Checkpoint: 2,000,000 verified, 4,000,000 arrives | question |
| 12 | 3 | Context map: six contexts, ACL, log, harness | diagram |
| 13 | 3 | ACL Structure → Claims in five steps | list |
| 14 | 3 | Why anti-corruption: two coupled versions | load-bearing text |
| 15 | 3 | The three classes: CurrentBeliefs and the comparator | table |
| 16 | 3 | Priors as a source; the human reviews deltas (300 → 60 / 50 / 12, illustrative) | table |
| 17 | 4 | Structure of an event | table |
| 18 | 4 | Two families: fact and decision | table |
| 19 | 4 | Projections: fold, drop, rebuild | diagram |
| 20 | 4 | Re-projection on extractor change: two projections that coexist | diagram |
| 21 | 4 | Temporal query: what the article said on 30 April 2019 | live |
| 22 | 5 | Golden set = a query over the log: four properties | text |
| 23 | 5 | Exclusions; offline and online (probes) | text |
| 24 | 5 | Alignment, classification, counting | list |
| 25 | 5 | Eval v1: table and metrics | table |
| 26 | 5 | Drift v1 → v2: per-item matrix | table |
| 27 | 5 | Promotion criteria and batch gate | list |
| 28 | 6 | The artifact consumed by the agent | diagram |
| 29 | 6 | Consumption policy and an answer that cites the belief | text |
| 30 | 6 | Checkpoint: what the agent may use | question |
| 31 | close | Three decisions and what they cost; QR handout and repository | table |

---

## Segment 1 — Why documents are not knowledge (15:20–15:32)

### Slide 1 — Chunk → embed → retrieve → hope: what is lost (identity, provenance, time)
**Point.** The standard pipeline is a retrieval system, not a knowledge model, because its data model has no place for identity, provenance or time.

**Diagram.** Four boxes in a row, left to right: "Document" → "Chunk" → "Vector" → "Answer", joined by arrows. Under each arrow, in red, what is lost at that step: under the first arrow "identity (which claim does this belong to)"; under the second "provenance (version, character interval)"; under the third "time (true from, true until)". No other elements.

**Speaker notes.** Extraction is a domain, not a pipeline; that sentence is the thesis and the next eighty minutes defend it with mechanisms. A chunk is a string with a vector attached. It has no identity beyond its position in an index, it carries at most a document name, and it has no notion of when what it says was true. Those three things are lost at the moment of chunking and no reranker or prompt recovers them, because they are properties of the data model, not of its quality. Lewis and colleagues, who introduced retrieval-augmented generation, never claimed the retrieved passages were knowledge; the surveys of RAG failure modes catalogue exactly these consequences. I will show three failures on one small document set; each takes under a minute and each is a consequence of one of the three losses.

### Slide 2 — The domain: art. 2477 c.c., three versions in force during 2019, what changes
**Point.** One article of the Civil Code, three versions in force within one year, is enough to produce conflict, supersession and an executable rule — on a text nobody in the room can dismiss as invented.

**Table.**

| Version (Normattiva) | In force | Amending act | Lett. c) of the comma on mandatory appointment |
| --- | --- | --- | --- |
| v7 | 21 Aug 2014 – 15 Mar 2019 | D.L. 91/2014, art. 20 c. 8, conv. L. 116/2014 | "per due esercizi consecutivi ha superato **due** dei limiti indicati dal primo comma dell'articolo 2435-bis" |
| v8 | 16 Mar 2019 – 17 Jun 2019 | D.Lgs. 14/2019, art. 379 | "almeno **uno** dei seguenti limiti": attivo **2 milioni** · ricavi **2 milioni** · **10** unità |
| v9 | from 18 Jun 2019 | D.L. 32/2019, art. 2-bis, conv. L. 55/2019 | attivo **4 milioni** · ricavi **4 milioni** · **20** unità |

Under the table: *Source: Normattiva, R.D. 262/1942, art. 2477, article versions 7, 8, 9, retrieved 27 Oct 2026. Lineage `cc-art2477`; v8 and v9 are ingested live, v7 is used in the retrieval baseline only.*

**Speaker notes.** The running example for the whole session is article 2477 of the Civil Code, the rule that says when an s.r.l. must appoint a statutory auditor. In 2019 its thresholds changed twice in three months: the Codice della crisi, in force on 16 March, replaced "two of the three limits of article 2435-bis" with "at least one of" two million, two million, ten employees; the conversion law of the sblocca cantieri decree, in force on 18 June, doubled them to four million, four million, twenty. The text is official, public and Italian, and Normattiva publishes every version with its period of validity. I chose it because it has the three properties that make extraction hard: three sources state different values for the same quantity, each version supersedes the previous one on a real date, and the rule must be executable to decide whether a given company has the obligation. The amounts are the law's; the thresholds of the harness later are illustrative.

### Slide 3 — Failure (a): unresolvable conflict
**Point.** Retrieval returns "two of the limits of art. 2435-bis", "2 milioni" and "4 milioni" with comparable scores and no field that distinguishes them.

**On screen.** Terminal, `npm run rag:query`; hidden slide with `fallback/seg1/rag-query.txt`.

**Speaker notes.** The three versions are indexed. The query is "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo". Three lett. c) passages come back with comparable similarity: one refers to the limits of another article, one says two million, one says four million, and nothing in any result says which version it is or from when it applied. The generator will pick one by position in the prompt, blend them, or report all three; none of these is an answer. The usual patches do not resolve it: filtering by version metadata requires the query to already know which version applies, which is what the system should know; reranking by recency conflates ingestion date with effective date; deleting the old versions is the next failure. Now the checkpoint, before I show anything else: a shareholders' meeting on 30 April 2019 approves the 2018 accounts. Which revenue threshold applies, and on what evidence present in the chunk? Take a moment. The correct answer is that no evidence is present; the chunk has no field for it. That is the gap segment 2 fills with a span and a version.

### Slide 4 — Failure (b): no retraction
**Point.** The only operation on a vector index is delete, and delete destroys the period during which the old text was in force.

**On screen.** Terminal, `npm run rag:delete-v8` then the same query; hidden slide with `fallback/seg1/rag-after-delete.txt`.

**Speaker notes.** Version 9 supersedes version 8, which superseded version 7. The only thing I can do to the index is delete the superseded chunks. I do it, I run the same query, one result: four million. The meeting of April 2019 can no longer be answered; its period is gone. Keep the chunks instead and failure (a) recurs on every query that touches a changed comma. There is no third option because the index has no state in which a passage is no longer current but still true for its period. Supersession is a relationship between two assertions over time, and the index has neither assertions nor time.

### Slide 5 — Failure (c): no per-layer evaluation
**Point.** A one-shot extraction cannot say whether the error was in reading the structure, the value or the attribution, so evaluation collapses to end-to-end answer checking.

**On screen.** Terminal, `npm run rag:extract-c2`; hidden slide with `fallback/seg1/rag-extract.txt`.

**Speaker notes.** This is an extraction prompt run over the comma with the thresholds in one shot: a block of JSON. Suppose one of these values is wrong. Where is the error? Was the comma boundary read incorrectly, did the model count the abrogated comma, was the comma right and the number misread, or was the number right and attributed to the wrong quantity? Nobody in the room can say, and neither can the system, because the output is one artifact produced by one opaque step. The operational consequence is that the extractor cannot be improved without re-evaluating everything. Debrief: three losses, identity, provenance, time. All three are the absence of the same object, an assertion with an identity, a provenance and a lifecycle. We now build that object, and we build it from the entities, not from the tools.

---

## Segment 2 — Knowledge artifacts as first-class aggregates (15:32–15:45)

### Slide 6 — Six entities: identity and invariants
**Point.** Six entities with explicit identity and invariants are the whole model; everything else is derived.

**Table.**

| Entity | Identity | Invariants |
| --- | --- | --- |
| Document | lineage id + document id; DocumentVersion is a value (label, content hash, effective date) | one lineage per version; immutable once ingested |
| Span (value) | document id, version, half-open `[start, end)` in absolute coordinates | never exists without an owning Claim |
| Claim (aggregate root) | hash of (document id, version, subject key, normalized value) | ≥ 1 Span; state ∈ {proposed, verified, contested, superseded}; every transition is an event with an actor; verified is immutable; superseded references its successor |
| Entity | canonical id from the subject catalogue | has ≥ 1 verified Claim mentioning it |
| Policy | policy id | condition / effect / exception, each referencing verified Claims |
| WorkflowStep | step id + position | preconditions and effects reference verified Policies |

**Speaker notes.** Six entities, read from the top. A Document belongs to a lineage, here `cc-art2477`, and its versions are values: label v8 or v9, content hash, effective date. A Span is a value object, a half-open character interval in absolute document coordinates with the version attached, and it never exists on its own. A Claim is the aggregate root: its identity is a deterministic hash of document, version, canonical subject key and normalized value, so the same assertion extracted twice has the same id. The subject key is the canonical name of a quantity, `ricavi.limite`, `dipendenti.limite`, resolved through a hand-maintained catalogue with synonyms. Entity, Policy and WorkflowStep sit on top and each references only verified claims or policies. These invariants are what the log lets you verify after the fact.

### Slide 6a — Six layers: art. 2477 from text to decision
**Point.** A layer is one level of knowledge derived from the level below; following one article through all six makes the word concrete before it is used.

**On slide.** Definition line, then the table. *Layer = one level of knowledge with its own artifacts, its own extractor, its own events and its own golden set. Layer n reads only what layer n − 1 has verified.*

| # | Layer | What it holds | Art. 2477, version 8 | Lets the next layer start |
| --- | --- | --- | --- | --- |
| 1 | Source | document versions, immutable, with a validity period | `cc-art2477@v8`, in force 16 Mar – 17 Jun 2019 | `DocumentVersionIngested` |
| 2 | Structure | the section tree: commi, notes, header, with offsets | `tree-v8`: header, c1, abrogato (note), c2 … c6 | `StructureVerified` |
| 3 | Claims | one assertion: subject key, normalized value, span | `ricavi.limite` = 2,000,000 EUR, c2 `[1067, 1126)`: "ricavi delle vendite e delle prestazioni: 2 milioni di euro" | `ClaimVerified` |
| 4 | Entities | who and what the claims talk about, resolved to the catalogue | `organo-di-controllo`, `revisore`, `societa-srl` | `EntityResolved` |
| 5 | Policies | a rule: condition / effect / exception, with applicability | `nomina-obbligatoria@v8`: 2 consecutive years over at least one limit → appointment mandatory | `PolicyVerified` |
| 6 | Workflow | executable steps that apply the policies to one case | `obbligo-nomina`: "mandatory for this s.r.l. on 30 Apr 2019?" → yes | `WorkflowStepVerified` |

Small tag under the table: *live today: layers 1–3; layers 4–6 shown as a pre-computed excerpt (slide 16).*

**Speaker notes.** I will say "layer" a lot, so here is what I mean, on our article. Read the table from the top. Source is the text as published, version 8, with the dates it was in force; nothing is interpreted yet. Structure is the shape of that text: the commi, the abrogated comma kept as a note, the header; still no meaning, only where things are. Claims is the first layer that asserts something: the revenue threshold is two million euro, and here is the exact sentence that says so. Entities says who those claims are about: the control body, the auditor, the s.r.l. Policies turns the claims into a rule: if for two consecutive years at least one limit is exceeded, the appointment is mandatory. Workflow makes the rule executable for one company on one date. The column on the right is the whole contract: a layer starts only from the verified events of the one below. That is why, in a minute, Claims will wait for me to verify the tree. And it is why the failure of slide 5 has a name now: a one-shot extraction jumps from Source to Claims in one opaque step, so when a value is wrong nobody can say which layer broke. Today we run the first three layers live; the last three come as an excerpt.

### Slide 7 — Claim as an aggregate: Spans inside, absolute coordinates, version
**Point.** Provenance cannot be lost because a Span is a value inside the Claim aggregate, not a nullable column elsewhere.

**Diagram.** One large box labelled "Claim" containing four text lines: "claim id", "subject key: ricavi.limite", "normalized value: 2,000,000 EUR", "state: proposed". Inside the same box, one small box: "Span [1,067, 1,126) in cc-art2477-v8.txt". From the small box an arrow to a box outside on the right: "DocumentVersion v8 · hash 7f98bb0c… · in force 2019-03-16 to 2019-06-17", which in turn has an arrow to a box "Lineage: cc-art2477".

**On screen after the diagram.** Terminal: `npm run log:init`, `npm run ingest:v8`, `npm run extract:structure-v8`, `npm run review`, `npm run extract:claims-v8`, `npm run show:ricavi-v8`; hidden slide with `fallback/seg2/log-after-extract.txt`.

**Speaker notes.** A Claim cannot be constructed without at least one Span; the invariant is structural, enforced where the Claim is created, not a validation rule that can be skipped. Two extractions producing the same Span on the same version produce the same evidence, because value objects are equal when their fields are equal. Now the log. `npm run log:init`: in the tail, `LogInitialised` and one bootstrap decision, `ExtractorVersionPromoted` for claims version 1, actor human, evidence "initial version"; we need it later. `npm run ingest:v8`, then the structure extractor, then `npm run review` where I verify the tree of commi, because the Claims layer accepts only verified structure. Then the claims extractor on comma 2: four `ClaimProposed` from claims@v1. `npm run show:ricavi-v8` prints the revenue proposal in full: absolute span [1,067, 1,126), actor agent with model id and prompt version, causation pointing at the `StructureVerified`.

### Slide 8 — Domain-design concepts used and their effect
**Point.** Each domain-design concept is kept only because it produces an observable effect in the log.

**Table.**

| Concept | Use here | Observable effect |
| --- | --- | --- |
| Aggregate and root | Claim is the root, Spans inside | provenance cannot be lost |
| Entity vs value object | Document, Claim, Entity, Policy, WorkflowStep have identity; Span, DocumentVersion are values | equal spans are one piece of evidence |
| Invariant | enforced at construction and transition | verifiable from the log after the fact |
| Domain event | every transition is a fact with an actor, never a command | the log is replayable |
| Projection | the knowledge base is a view over the log | no migrations: rebuild |
| Bounded context | each layer is one; the Harness is a seventh; the log is infrastructure | "comma" means one thing per context |
| Published language | a context's event catalogue is its only interface | downstream never reads upstream internals |
| Anti-corruption layer | translation at each context's entry | extractor versions stay independent |

**Speaker notes.** These are the domain-design terms I will use, and only these. Evans's definitions, each with the effect you can observe in the log on the right. Aggregate and root give us the provenance invariant we just saw. Entity versus value object makes equal spans one piece of evidence rather than two. Domain events are facts that happened with an actor, never commands, and that is what makes the log replayable. Projection means the knowledge base is a view, deletable and rebuildable, so there is nothing to migrate. Bounded context: each of the six layers is one, the Harness is a seventh, the log is shared infrastructure and not a context; without explicit boundaries "comma" is a tree node, an assertion and a rule in the same code. Published language and anti-corruption layer come back in segment 3, where the ACL is shown in full.

### Slide 9 — Lifecycle: the state machine
**Point.** Four states, every transition an event with an actor; the extraction agent only ever produces the first.

**Diagram.** State machine, left to right. A filled start dot with an arrow to a rounded box "proposed", arrow label "ClaimProposed (agent or human)". From "proposed" two arrows: one to "verified", label "ClaimVerified (human; harness in class A)"; one to "contested", label "ClaimContested (harness)". From "verified" an arrow to "contested", label "ClaimContested (harness)", and an arrow to "superseded", label "ClaimSuperseded (human; harness for identical-value reconfirmation)". From "contested" two arrows: to "verified", label "ClaimVerified (human)"; to "superseded", label "ClaimSuperseded (human)". From "superseded" an arrow to an end dot. Colour: "proposed" grey, "verified" green, "contested" amber, "superseded" blue-grey. No arrow leaves "superseded" except to the end.

**Speaker notes.** Proposed, verified, contested, superseded. Read the labels on the arrows, because the actor is the point. `ClaimProposed` comes from an agent, with model id, prompt version and extractor version, or from a human. `ClaimVerified` comes from a human, or from the harness in one well-defined case we will meet in segment 3. `ClaimContested` is always the harness: detection is mechanical. Leaving contested is human only. `ClaimSuperseded` carries a mandatory successor. Invariants: a verified claim is immutable; a superseded claim always references its successor; a proposed claim never verified stays proposed, and the harness measures that backlog rather than hiding it. Every transition records who caused it, so later we can ask which extractor version produced this wrong claim and who verified it.

### Slide 10 — Who may emit what; why not a merge
**Point.** Conflict is kept as an explicit state with a human resolution because the resolution is a judgment, not a function.

**Table.**

| Event | Agent | Human | Harness |
| --- | --- | --- | --- |
| ClaimProposed | yes | yes | no |
| ClaimVerified | never | yes | class A only (evidence: reconfirmed belief id + batch id) |
| ClaimContested | no | no | yes (detection) |
| ClaimSuperseded | no | yes (successor mandatory) | identical-value reconfirmation chain only |

Under the table one line: *Alternative not chosen: deterministic merge / CRDT / last-writer-wins — the disagreement is itself knowledge; ingestion date ≠ effective date.*

**On screen after the table.** Terminal: `npm run review`; hidden slide with `fallback/seg2/log-after-verify.txt`.

**Speaker notes.** The agent proposes and nothing else; in the repository that is a type-level impossibility, the agent module cannot import the decision-event constructors. Why not merge the two revenue thresholds into one value with a resolution function? Because in normative texts the resolution is a judgment: which version applies to which date, whether a later act replaces or adds, whether a transitional rule applies. A judgment must be recorded with an actor and a date. CRDTs are the right tool when concurrent writes have a lawful merge; here they would silently destroy the disagreement, and the disagreement is knowledge. Last-writer-wins is wrong on principle because ingestion date is not effective date: we ingest a 2019 text in 2026. The cost, stated: a contested claim is not consumable until a human resolves it, so there is a review queue and latency. Now the review itself, and watch what the agent got wrong.

### Slide 11 — Checkpoint: 2,000,000 verified, 4,000,000 arrives
**Point.** The audience predicts the states and the actors before the comparator exists.

**On the slide, only this text.** "`ricavi.limite` 2,000,000 EUR is verified. A later extraction proposes 4,000,000 EUR on the same subject. After the event: what is the state of each claim, and who may emit the event?"

**Speaker notes.** The answer, given only after the room has committed: 2,000,000 stays verified, because a verified claim is immutable and nothing has superseded it yet. 4,000,000 is born proposed and becomes contested, and the actor of that transition is the harness, because detecting a different value on the same subject is mechanical. The resolution, verifying 4,000,000 and superseding 2,000,000 with it as successor, is human only. Then the live review on slide 10's screen, which is the debrief of this segment: claims@v1 proposed four claims; the reviewer verifies two, `attivo.limite` 2,000,000 and `ricavi.limite` 2,000,000; leaves two proposed, `esercizi.consecutivi` 3 because the value is wrong — the model conflated the three-year cessation rule with the two-year trigger — and `capitale.soglia` because it reproduces the capital trigger abrogated in 2014, which is not in this text; and adds two by hand, `esercizi.consecutivi` 2 and `dipendenti.limite` 10, each as a human `ClaimProposed` followed by a `ClaimVerified`. Four verified claims with actor human and a note; two proposals left in the backlog, visible, not deleted. The agent proposes, the human decides, the event records who.

---

## Segment 3 — The six layers, the ACL and the three classes (15:45–15:57)

### Slide 12 — Context map: six contexts, ACL, log, harness
**Point.** Each layer is a bounded context that consumes only the verified events of the previous one, through an ACL, and all of them share one log.

**Diagram.** Across the top, six boxes in a row: "1 Source", "2 Structure", "3 Claims", "4 Entities", "5 Policies", "6 Workflow". Under each name, in small type, the art. 2477 example of slide 6a (`cc-art2477@v8`, `tree-v8`, `ricavi.limite` = 2,000,000, `organo-di-controllo`, `nomina-obbligatoria@v8`, `obbligo-nomina`); on each arrow the concrete event: `StructureVerified`, `ClaimVerified`, `EntityResolved`, `PolicyVerified`. Between each adjacent pair a small box labelled "ACL" with an arrow entering it from the left box labelled "Verified events" and an arrow leaving it into the right box. Below the row, one wide box spanning the full width: "Append-only log (shared infrastructure)". A double-headed vertical arrow from each of the six boxes down to the log. At the bottom right, a box "Harness" with an arrow from the log labelled "decision events" and an arrow back to the log labelled "ExtractorVersionPromoted / BatchRejected". No arrow between non-adjacent layers.

**Speaker notes.** Six bounded contexts in order: source, structure, claims, entities, policies, executable workflow. The Harness is a seventh context; the log is infrastructure shared by all of them, not a context. The single contract between layers, layer n consumes only verified artifacts of layer n minus 1, lives in the ACL at each boundary. Each ACL does three things: filters, accepting only verified events; translates, from the upstream event shape to the context's own input type; and stamps causation, so the id of the consumed event becomes the causation id of everything produced from it. That contract is verifiable from the log by following causation ids: every `ClaimProposed` must point at a `StructureVerified`. These are the six layers of slide 6a, now drawn as contexts. Today we run the first three layers live and show the last three as a pre-computed excerpt.

### Slide 13 — ACL Structure → Claims in five steps
**Point.** The ACL translates shape and coordinates, nothing else, and that is where the provenance invariant is enforced.

**List.**
1. Filter — accept `StructureVerified` only; `StructureProposed` and everything else is ignored.
2. Selection — one extraction unit per node of type comma; header and note nodes (the "COMMA ABROGATO" line) do not become units.
3. Translation and coordinates — copy the comma text, fix the base offset; comma-2-local span `[280, 342)` + base 720 → absolute `[1,000, 1,062)`.
4. Causation — the `StructureVerified` id becomes the causation id of every unit and every `ClaimProposed`.
5. Rejection — a tree without intervals or without a version produces `ACLRejected`, not an exception.

Under the list: *Numbering note: v8 says "lettera c) del terzo comma" (the drafter counted the abrogated comma); v9 corrected it to "secondo comma". The tree takes the v9 reading; the note node keeps the discrepancy visible.*

**On screen after the list.** Terminal: `npm run ingest:v9`, `npm run extract:v9`; hidden slide with `fallback/seg3/log-after-extract-v9.txt`.

**Speaker notes.** Upstream, the Structure context publishes a tree of commi with paths, types and absolute intervals. Downstream, the Claims context works on its own input type, the extraction unit: text, base offset, path. The ACL in five steps. Filter: this is the one place where "only verified from the previous layer" is applied. Selection: what is extractable is the Claims context's decision, not Structure's; the abrogated comma is a note node and never a unit. Coordinates: the extractor returns comma-local spans, the ACL adds the base offset, 720 for comma 2 of v8, and the provenance invariant depends on that conversion. Causation. Rejection as a recorded fact. The ACL does not judge content, that is the harness, and does not interpret meaning, that is the extractor. The numbering note is real: version 8 counts the abrogated comma, version 9 does not; a structure decision, recorded, not hidden. Now version 9: ingest, extract structure and claims together, units comma 2, 3 and 5. In the tail, `StructureVerified` with actor harness, because the v9 tree has the same paths and types as the verified v8 tree; then the ACL units and six `ClaimProposed`. I stop before the comparator.

### Slide 14 — Why anti-corruption: two coupled versions
**Point.** Without an ACL a change in the Structure extractor changes the Claims prompt without a Claims version change, and the resulting drift is attributable to nobody.

**On the slide.** Two short columns of text. Left, headed "Without ACL": "Claims prompt built on the Structure tree shape → Structure v2 adds node type *lettera* → Claims prompt changes, Claims extractor version unchanged → two coupled versions, drift attributable to neither." Right, headed "With ACL": "Claims extractor sees only extraction units → new node type handled in the ACL → ACL change versioned as such → Claims extractor identical, drift attributable."

**Speaker notes.** This is the load-bearing passage, so I will say it slowly. Without an ACL, the prompt of the Claims extractor is built directly on the shape of the Structure tree. When the Structure extractor changes and introduces a new node type, say it starts splitting a comma into its lettere, the Claims prompt changes although nobody has changed the version of the Claims extractor. Two coupled versions, and a drift in the claims that cannot be attributed to either of them. With the ACL, adapting to the new node type is a change to the ACL, versioned as such, and the Claims extractor stays identical. This is the mechanism behind per-layer evaluation in segment 5: an extractor version can only be held responsible for its output if its input contract is fixed and versioned independently of the upstream extractor.

### Slide 15 — The three classes: CurrentBeliefs and the comparator
**Point.** A proposal becomes verified through one of three classes decided by deterministic code against CurrentBeliefs, never by a model.

**Table.**

| Class | Condition | Who decides | Event |
| --- | --- | --- | --- |
| A — reconfirmation | human-verified belief on the same subject, same normalized value, batch passed its probes | harness | `ClaimVerified(actor=harness, evidence = belief id + batch id)`; the reconfirmed claim superseded as bookkeeping |
| B — novelty | no belief on the subject | human | stays proposed, review queue |
| C — conflict | belief with a different value | harness contests, human resolves | `ClaimContested`, then human `ClaimVerified` / `ClaimSuperseded` |

Under the table: *Comparator: lineage → canonical subject (unresolved = unexpected novelty, high priority) → lookup in CurrentBeliefs → value comparison → in-version span IoU ≥ θ for A. Policies and Workflow layers: always B or C. Class-A audit sampling: 5 % (20 % against imported priors; 100 % below the golden-set minimum), illustrative.*

**On screen after the table.** Checkpoint, then `npm run compare`, then `npm run review`; hidden slide with `fallback/seg3/log-after-compare.txt`.

**Speaker notes.** CurrentBeliefs is a projection keyed by lineage and subject key, holding the verified, non-superseded claim with its actor and evidence; at most one per key, and if a fold finds two, the bug is in the comparator. The comparator is code, never a language model: resolve the lineage, canonicalize the subject through the catalogue, look up, compare normalized values. Checkpoint: six proposals from version 9 are on the screen; classify each as A, B or C before the comparator runs. After the room commits: `esercizi.consecutivi` 2 is A; `attivo.limite` 4,000,000, `ricavi.limite` 4,000,000 and `dipendenti.limite` 20 are C; `cessazione.esercizi` 3 and `assemblea.termine` 30 days are B, because commi 3 and 5 were not extracted in segment 2 and no belief exists on those subjects. `npm run compare`: one `ClaimVerified` with actor harness and evidence, three `ClaimContested`, two proposals queued. Read the gate line: batch gate not applicable, golden set of four expected items is below the illustrative minimum of ten, so class A is decided by the comparator alone and every class-A reconfirmation is sampled for human audit until the minimum is reached. `npm run review`: I verify the three v9 values and declare the three v8 claims superseded with their v9 successors.

### Slide 16 — Priors as a source; the human reviews deltas (300 → 60 / 50 / 12, illustrative)
**Point.** The three-class rule makes human cost proportional to novelty plus conflict instead of volume, at the declared cost of reconfirming an initial human error.

**Table.** (illustrative, 300-claim document)

| Scenario | Human verifies everything | Three-class rule |
| --- | --- | --- |
| First ingestion, no prior | 300 | 300 |
| First ingestion with a system-of-record prior (240 reconfirm, 40 novel, 20 contradict) | 300 | 60 |
| New version: 250 unchanged, 30 changed, 20 new | 300 | 50 |
| Extractor v2 on the existing corpus, 12 disagreements with v1 | 300 | 12 |

Under the table: *Priors enter the log as sources with an actor and evidence (system-of-record import — here a firm's compliance register of the thresholds it applies, illustrative; a verified reference version; the subject catalogue), never as configuration. Hidden cost: an initial human error is reconfirmed in class A at every re-projection; mitigated by sampling, not eliminated.*

**Speaker notes.** The alternative to the three classes is a human verifying everything, and its cost is proportional to volume: every re-projection, a new version or a new extractor, reproduces the whole volume. Under the three-class rule the human reviews deltas, and deltas are exactly the interesting cases. Illustrative, on a 300-claim document: 300 against 300 on a cold start, but 60 with a system-of-record prior, 50 for the next version, 12 for a new extractor version. Changing an extractor, which under full review is so expensive it is never done, becomes cheap. Priors are modelled as sources in the log, with an actor and evidence, because a prior must be supersedable like any belief; in this domain the system of record is the firm's own compliance register of the thresholds it applies, and import-verified is weaker than human-verified. The hidden cost belongs on the closing slide: class A assumes the first human was right, and an early error is reconfirmed forever unless sampling or a supersession catches it. Debrief: `npm run layers-4-6`, thirty seconds of pre-computed Entities, Policies and Workflow events — the policy "nomina obbligatoria" with its condition, effect and exception, and the workflow that decides the obligation for a given company — same ACL pattern, same proposed-then-verified rule, never executed live because it does not fit.

---

## Segment 4 — The knowledge base as a replayable projection (15:57–16:09)

### Slide 17 — Structure of an event
**Point.** Every event carries identity, classification, actor, traceability, payload and, for decisions, evidence; the event id is the idempotency key.

**Table.**

| Group | Fields | Note |
| --- | --- | --- |
| Identity | event id, global sequence, aggregate version | event id deterministic from (producer, input artifact id, extractor version): duplicates are rejected on append |
| Classification | type, layer, aggregate id | |
| Actor | kind (human / agent / harness / import / process), id; for agent: model id, prompt version, extractor version | `process` for ingestion, log initialisation, ACL, cursors |
| Traceability | causation id, correlation id | causation = the event consumed; correlation = the extraction run |
| Payload | type-specific | |
| Evidence | decision events only, mandatory | spans, probe results, reviewer note, conflicting claim id, reconfirmed belief id |

**Speaker notes.** This is the shape of every line in the tail. Identity first: the event id is deterministic from the producer, the input artifact and the extractor version, so a re-run of the same version on the same input produces the same id and the append discards it silently. That is what makes parallel, restartable agents safe. A different version produces different ids and is appended by design. Actor: human, agent, harness, import or process, and for an agent the model id, prompt version and extractor version. Traceability: causation is the event consumed, correlation is the run. Evidence is required on decision events and forbidden on fact events, enforced in the schema. Storage is a file today; the only requirements are ordered and idempotent append, so a distributed stream is an adapter change, not a model change.

### Slide 18 — Two families: fact and decision
**Point.** Decisions are as important as facts and always carry evidence; replaying the log reconstructs not only what was believed but why and who decided.

**Table.**

| Family | Events | Layer |
| --- | --- | --- |
| Fact | `LogInitialised`, `DocumentVersionIngested` | Source |
| Fact | `StructureProposed`, `ClaimProposed`, `EntityProposed`, `PolicyProposed`, `WorkflowStepProposed` | Structure … Workflow |
| Fact | `ACLRejected`, `CursorAdvanced` | all |
| Decision | `StructureVerified`, `ClaimVerified`, `ClaimContested`, `ClaimSuperseded`, `EntityResolved`, `EntityMerged`, `PolicyVerified`, `WorkflowStepVerified` | per layer |
| Decision | `ExtractorVersionPromoted`, `BatchRejected`, `EvalCompleted` | Harness |

**Speaker notes.** Two families. Facts: something was ingested, proposed, rejected by an ACL, or a cursor moved. Decisions: something was verified, contested, superseded, resolved, merged, promoted or rejected, and every decision carries its evidence. The bootstrap event we saw at `log:init`, `ExtractorVersionPromoted` for claims@v1, is a decision too, with "initial version" as evidence, and it is why the projection we are about to rebuild is labelled "v1 promoted". The contract between layers is checked mechanically on this table: every causation of a Proposed event must point at a Verified event of the previous layer. Replay reconstructs what was believed on a date, why, and who decided it.

### Slide 19 — Projections: fold, drop, rebuild
**Point.** The knowledge base is a fold over the log; it can be deleted and rebuilt identically, so there is no migration.

**Diagram.** On the left a tall vertical column labelled "log", made of numbered rows "1, 2, 3 … n". From the column three arrows to the right, each labelled "fold", ending in three boxes stacked vertically: "CurrentBeliefs", "ConflictQueue", "Timeline". A red X drawn over the three boxes with the caption "deletable". Below, a second set of three arrows labelled "fold" from the same log column regenerating the same three boxes, drawn identical, with the caption "rebuilt identical".

**On screen after the diagram.** Terminal: `npm run log:cat`, `npm run projections:drop`, `npm run projections:build`; hidden slide with `fallback/seg4/projections-rebuilt.txt`.

**Speaker notes.** Five projections in the repository, all folds: CurrentBeliefs keyed by lineage and subject; ClaimsByDocumentVersion; ConflictQueue, the open contested claims; ReviewQueue, the class-B proposals ordered by catalogue expectation; Timeline, state per date per claim. `npm run log:cat` prints the whole log formatted, and I follow one causation chain aloud, from `DocumentVersionIngested` of version 9 through `StructureVerified`, the `ClaimProposed` for `ricavi.limite` 4,000,000, the `ClaimContested`, the human `ClaimVerified`, to the `ClaimSuperseded` of the v8 claim with its successor. Then `npm run projections:drop`, the projections are gone, and `npm run projections:build`, CurrentBeliefs is byte-identical. Nothing was migrated. That is the whole claim of the abstract's "not a database to be migrated", and it is a one-line command.

### Slide 20 — Re-projection on extractor change: two projections that coexist
**Point.** When the extractor changes and no document changes, the log is replayed through the new version and the new projection coexists with the old until promoted; nothing is overwritten.

**Diagram.** The same log column on the left. Two arrows to the right, labelled "replay with extractor v1" and "replay with extractor v2", ending in two boxes side by side: "Projection v1 (promoted)" and "Projection v2 (candidate)". Between the two boxes a double-headed arrow labelled "harness: drift". No arrow from either box back to the log.

**On screen after the diagram.** Checkpoint, then `npm run replay:claims-v2`, `npm run projections:diff`; hidden slide with `fallback/seg4/projections-diff.txt`.

**Speaker notes.** This is the case a "propagate on document change" design does not cover: no document changes, a prompt or extractor version changes. With a mutable knowledge base the only option is re-run and overwrite, which is the migration we are removing. Here the `StructureVerified` events are replayed through claims@v2, which emits new `ClaimProposed` tagged v2. Checkpoint before I run it: we switch to prompt v2 and replay; which lines of the log are modified? Commit to an answer. None. Events tagged v2 are appended, eleven of them, five for version 8 and six for version 9; CurrentBeliefs does not change until v2 is promoted by an `ExtractorVersionPromoted`, and the v1 proposals stay in the log, attributable to their version. `npm run replay:claims-v2`, watch the tail, then `npm run projections:diff`: v1 promoted and v2 candidate side by side. The harness decides between them in segment 5.

### Slide 21 — Temporal query: what the article said on 30 April 2019
**Point.** "What did the article say on date D" is a valid-time query on the version in force on D; transaction time is the log sequence; both are kept and both queryable.

**On screen.** Terminal: `npm run beliefs:at-2019-04-30`, `npm run beliefs`; hidden slide with `fallback/seg4/beliefs-at-2019-04-30.txt`.

**Speaker notes.** `npm run beliefs:at-2019-04-30`: `ricavi.limite` 2,000,000, verified, from version 8, because version 8 was the text in force on 30 April 2019, the day a typical meeting approved the 2018 accounts. `npm run beliefs` with no date: 4,000,000 from version 9. This is bitemporal reasoning in Snodgrass's sense: valid time is the document's effective date, transaction time is the log sequence, and the two are kept distinct. The date query is valid time; transaction time, "what did this system assert at sequence n", exists as `--seq` and would show nothing interesting today, because every event in this log was appended this afternoon. An answer given on date D can be reproduced a year later by folding to the same sequence, with the same extractor and golden-set versions recorded in the `EvalCompleted` and `ExtractorVersionPromoted` events of the time; that is the audit record. Debrief of the segment: nothing to migrate, you replay; and the tail on the right has been append-only for the whole segment, which you can check by scrolling it.

---

## Segment 5 — The harness (16:09–16:21)

### Slide 22 — Golden set = a query over the log: four properties
**Point.** The golden set of a layer is the set of human decision events of that layer up to a cut-off sequence, which gives it four properties a hand-built evaluation set does not have.

**On the slide.** Definition line: *Golden set (layer, version k) = all decision events of the layer with actor human, up to sequence s_k.* Then four numbered lines:
1. Produced as a side effect of operation: every human decision is a labelled example.
2. Per layer by construction: every decision event belongs to a layer.
3. Follows the real distribution: it grows with the corpus.
4. Contains the hardest cases: conflict resolutions, which an external labeller never produces because the labeller never saw the conflict.

**Speaker notes.** This is the distinctive idea of the talk. A conventional eval set is built apart, by labellers, static, separate from operation, tests the model end to end, and drifts from the real distribution as the corpus changes. Here the golden set is a query: all human-actor decision events of the Claims layer up to sequence 12,430, say, is a reproducible definition; the same query on the same log returns the same set. Four properties follow. It is produced as a side effect of doing the work. It is per layer because every event has a layer. It follows the real distribution because it grows with the corpus. And it contains the conflict resolutions, which are exactly the examples nobody writes by hand. The users, resolving conflicts to do their job, write the evaluation set.

### Slide 23 — Exclusions; offline and online (probes)
**Point.** Harness- and import-verified claims and prompt examples are excluded to avoid circularity, and the same golden set serves promotion offline and batch gating online.

**On the slide.** Two short blocks. "Exclusions: harness-verified and import-verified claims (derived from human decisions already present); items used as examples in the extractor's prompt (listed in the version manifest), otherwise probes measure recall of the prompt." Then a two-row table:

| Mode | Input | Decides | Trigger |
| --- | --- | --- | --- |
| Offline | whole golden set | promotion of an extractor version | every extractor or prompt change |
| Online (probes) | a subset inserted in each production batch | batch is signal or noise | every batch |

**On screen after.** Terminal: `npm run golden:claims-until-seg2`, then `npm run golden:claims`; hidden slide with `fallback/seg5/golden-claims.txt`.

**Speaker notes.** Two mandatory exclusions. Harness-verified and import-verified claims do not enter the golden set because they derive from human decisions already in it; including them would be circular. Items used as examples in an extractor's prompt are subtracted from that extractor's probes; otherwise the probe measures the prompt's recall, not the extractor's. Same set, two modes: offline, the whole set, for promotion; online, a subset inserted as probes in every production batch, for the gate. Now the query on today's log. `npm run golden:claims-until-seg2`, the sequence after segment 2: four items, the human verifications on comma 2 of version 8. The same command without the cut-off: seven items, and the three new ones are the resolutions of the three conflicts you watched me make twenty minutes ago. That is property 4 on this session's own log.

### Slide 24 — Alignment, classification, counting
**Point.** Metrics are derived in four mechanical steps on half-open spans with an IoU threshold, micro-averaged over all golden items.

**List.**
1. Alignment — for each expected item, the proposal with the same canonical subject key; several → highest span IoU, the rest unaligned.
2. Classification — value correct if normalized values are equal; provenance correct if IoU ≥ θ (illustrative 0.8); outcome: correct / wrong value / wrong provenance.
3. Counting — correct pair = TP; any other pair = one FP and one FN; expected with no pair = FN; proposal with no pair = FP.
4. Metrics — precision = TP / (TP + FP), recall = TP / (TP + FN); counts summed over all items before dividing (micro-average).

**Speaker notes.** Spans are half-open character intervals and IoU is intersection over union in characters; θ is 0.8, illustrative. Step one aligns on the canonical subject key, which is why the catalogue matters: without it there is nothing to align on. Step two classifies each aligned pair on value and on provenance separately, so "right place, wrong number" is a distinct outcome from "right number, wrong place". Step three counts: a pair that is not correct costs one false positive and one false negative, because the proposal is wrong and the expected item was not met. Step four is micro-averaged because commi differ in size; a per-unit average would weight a two-claim comma like a forty-claim one.

### Slide 25 — Eval v1: table and metrics
**Point.** On the four expected claims of comma 2 of version 8, claims@v1 scores TP 2, FP 2, FN 2: precision 0.50, recall 0.50.

**Table.**

| Expected (key, value, span) | Proposal v1 | IoU | Outcome | Counts |
| --- | --- | --- | --- | --- |
| attivo.limite, 2,000,000 EUR, [280, 342) | attivo.limite, 2,000,000 EUR, [278, 342) | 62/64 = 0.97 | correct | TP |
| ricavi.limite, 2,000,000 EUR, [347, 406) | ricavi.limite, 2,000,000 EUR, [347, 406) | 1.00 | correct | TP |
| esercizi.consecutivi, 2, [216, 244) | esercizi.consecutivi, 3, [216, 244) | 1.00 | wrong value | FP + FN |
| dipendenti.limite, 10, [411, 469) | — | — | missing | FN |
| — | capitale.soglia, "minimo s.p.a.", [0, 79) | — | unexpected (not in catalogue) | FP |

Under the table: *TP 2 · FP 2 · FN 2 · precision 2/4 = 0.50 · recall 2/4 = 0.50.* (Spans comma-2-local for readability, base offset 720; the log holds absolute coordinates, and `npm run eval:claims-v1` prints both.)

**On screen.** Terminal: `npm run eval:claims-v1`; hidden slide with `fallback/seg5/eval-v1.txt`.

**Speaker notes.** `npm run eval:claims-v1` against the four-item golden set. Pair one aloud: expected length 62, proposed length 64 because the extractor included the "1) " before the quantity, intersection 62, union 64, IoU 0.97, above 0.8, value equal, correct. Pair two perfect. Pair three: perfect span, wrong number, the extractor looked in the right place and read "tre" from the cessation rule instead of "due"; one FP and one FN. The employee threshold was never proposed: FN. `capitale.soglia`, the capital trigger abrogated in 2014, is not in this text and not in the catalogue: FP. These are exactly the four proposals you saw in segment 2 and the two I added by hand. Totals TP 2, FP 2, FN 2; precision 0.50, recall 0.50. Note what the table says that an aggregate does not: which items, and whether the error is in the value or in the provenance.

### Slide 26 — Drift v1 → v2: per-item matrix
**Point.** Drift is measured per golden item, never by comparing aggregate percentages, because an aggregate improvement can hide a regression on exactly the items that matter.

**Table.**

| Expected | v1 | v2 | Cell |
| --- | --- | --- | --- |
| attivo.limite | correct | correct | stable |
| ricavi.limite | correct | wrong value (2,000 EUR) | **regression** |
| esercizi.consecutivi | wrong value | correct | improvement |
| dipendenti.limite | missing | correct | improvement |

Under the table: *v2 aggregates: TP 3 · FN 1 · FP 2 · precision 0.60 · recall 0.75. Also tracked: noise introduced (proposals in v2 absent in v1 — here `cessazione.esercizi` 3, true of the article but not of this unit), provenance drift (span moved beyond θ).*

**On screen.** Terminal: `npm run eval:claims-v2-summary`, checkpoint, then `npm run drift:v1-v2`; hidden slides with `fallback/seg5/eval-v2-summary.txt` and `fallback/seg5/drift-v1-v2.txt`.

**Speaker notes.** `npm run eval:claims-v2-summary` prints only the aggregates: precision 0.60, recall 0.75, up 0.10 and 0.25. Checkpoint: v2 is better on both aggregates; assume for a moment that both thresholds were met — do we promote v2? I expect most of the room to say yes. The answer is no, and the reason is only visible per item. `npm run drift:v1-v2` shows why: v2 fixed the consecutive years and found the employee threshold, two improvements, and it read the revenue threshold as 2,000 euro, dropping "milioni" in normalization, a regression on a monetary value, in the critical subset. The aggregate hid it. The matrix has four cells, stable, regression, improvement, stable wrong, plus two lists, noise introduced and provenance drift. Drift is never a difference of percentages.

### Slide 27 — Promotion criteria and batch gate
**Point.** Promotion requires all four criteria; the batch gate is count-based because rates on three to ten probes are unstable.

**List.** Promotion (offline, whole golden set, all must hold; thresholds illustrative):
1. precision(v2) ≥ layer threshold (0.90 for Claims);
2. recall(v2) ≥ recall(v1) − ε (ε = 0.02);
3. zero regressions on the critical subset (monetary, count, time-limit);
4. wrong-provenance pairs ≤ 2 % of value-correct pairs.

Batch gate (online probes, illustrative): probes ≈ 5 % of units with expected items totalling ≥ 10; pass if ≤ 1 FN and ≤ 1 FP across probes and zero critical errors; fail → `BatchRejected`, all proposals stay proposed. Below the minimum golden-set size the gate is not applicable and class-A audit sampling is 100 %.

**Speaker notes.** v2 fails criterion 3, `ricavi.limite` is monetary, so no `ExtractorVersionPromoted` is emitted; its proposals stay in the log tagged v2, the harness never uses them for reconfirmation, and the v2 projection remains a candidate. It also fails criterion 1, but criterion 3 is the one an aggregate would have hidden. The batch gate in one sentence: a few golden items are inserted in every production batch; because samples that small make rates unstable, one missed probe out of three drops recall to 0.67, the criterion is in counts, at most one FN and one FP and zero critical errors; fail means `BatchRejected` and everything stays proposed. The gate line you saw in segment 3 was the cold-start case: below the minimum, the gate does not run and every class-A reconfirmation is sampled. Debrief: drift is measured per item, and the golden set was written by the users resolving conflicts.

---

## Segment 6 — Output and consumption (16:21–16:27)

### Slide 28 — The artifact consumed by the agent
**Point.** The expertise-aware agent consumes the projection, never the raw documents, and every answer can be traced from belief to span to document version.

**Diagram.** On the left a box "Expertise-aware agent". Arrow to a box "Projection (CurrentBeliefs · Policies · WorkflowSteps · ConflictQueue · versions)". From there an arrow to a box "Belief (id, actor, evidence chain, dates)". From there an arrow to "Span". From there an arrow to "DocumentVersion". On the far right a box "raw documents" crossed out, with no arrow entering it from the agent.

**Speaker notes.** The output of the six layers is not a cleaned document set and not a vector index. For the lineage `cc-art2477` it is: CurrentBeliefs, verified non-superseded claims by subject with actor, evidence chain and dates; Policies, here "nomina obbligatoria" with its condition, effect and exception resting on the verified thresholds and its applicability from 18 June 2019; WorkflowSteps for the use case "is the appointment mandatory for this company at this date"; the ConflictQueue, what the system cannot yet assert; and the versions, golden set and promoted extractors, that produced it. It is reproducible, given the log and the versions, and dated, as of any sequence. The agent reads this and never the documents. Retrieval over raw text keeps a role, for free-text questions and for discovering candidate subjects, but only as a tool the agent may use to propose a claim, never as a source it may assert from.

### Slide 29 — Consumption policy and an answer that cites the belief
**Point.** A consumption policy, applied to the root of the evidence chain, states which verifications an agent may rely on, and the answer cites a belief id, not a document.

**On the slide.** A small table:

| Question class | Usable beliefs |
| --- | --- |
| Monetary quantities and time limits | human-rooted verified only |
| Other claims | human- or harness-verified |
| Any class | never proposed, never contested |
| Questions about date D | the projection in force on D |

Then one answer line: *ricavi.limite, meeting of 2019-04-30 → 2,000,000 EUR · belief <id> · verified by human · span [1,067, 1,126) in cc-art2477-v8.txt.*

**On screen.** Terminal: `npm run ask:ricavi-2019-04-30`, then `npm run ask:ricavi`; hidden slide with `fallback/seg6/ask.txt`.

**Speaker notes.** A consumption policy is per layer and per subject class, and it is applied to the root of the chain, not to the last actor: a class-A reconfirmation by the harness carries the human-verified belief it reconfirms. `npm run ask:ricavi-2019-04-30`, the question with the date of the meeting: 2,000,000 euro, belief id, actor human, date, span in the version 8 document. The same question without a date: 4,000,000 with the version 9 belief, verified after contestation, successor of the version 8 one. When the relevant belief is contested, the answer says so and cites the conflict; the ConflictQueue is part of the artifact so the agent can report what is undecided instead of guessing. For an executable question the agent runs the verified workflow, not a prompt. Take an illustrative company with total assets of 2.5 and 2.6 million, revenues of 1.5 and 1.6 million, eight and nine employees in 2017 and 2018. Asked on 30 April 2019, the appointment is mandatory: assets exceeded two million in both years. Asked on 30 June 2019, it is not: no limit of the four-million regime is exceeded. Same company, two months apart, two answers, each with the belief and policy ids it rests on.

### Slide 30 — Checkpoint: what the agent may use
**Point.** The audience applies the consumption policy to the chain of evidence, not to the last actor.

**On the slide, only this text.** "Policy: for monetary quantities and time limits, human-rooted verified beliefs only. After today's ingestion of version 9, can the agent answer on `assemblea.termine` (the thirty days)? On `esercizi.consecutivi` (the two years)?"

**Speaker notes.** After the room commits: `assemblea.termine`, no; it is still proposed, class B, waiting for a human, because comma 5 was never reviewed. `esercizi.consecutivi`, yes; it was reconfirmed by the harness in class A, and the evidence of that reconfirmation is the version 8 human verification, so the chain is rooted in a human decision and the policy is satisfied. Had the policy said "last actor human", the answer would have been no, and the three-class rule would have bought nothing; the policy is applied to the root precisely so that reconfirmation stays cheap without weakening the rule that agents never verify. Debrief in three words: projection, not documents.

---

## Close (16:27–16:30)

### Slide 31 — Three decisions and what they cost; QR handout and repository
**Point.** Three design decisions, each with its cost stated.

**Table.**

| Decision | Cost |
| --- | --- |
| Explicit contested state resolved by a human, instead of merge | latency between ingestion and availability; a review queue to operate |
| The log is the system of record; the knowledge base is a projection | storage grows with events, not documents; re-projection compute on every extractor change |
| Per-layer golden sets derived from the log | freezing and maintenance per layer; a hand-maintained subject catalogue |

Bottom right: QR placeholder → one-page handout (entity list, event catalogue, three-class table, art. 2477 versions, repository link). Bottom left: repository URL placeholder.

**Speaker notes.** Three decisions, and what each one costs, because the approach costs more than retrieval on every axis except correctness over time. First, an explicit contested state with human resolution: the cost is latency and a review queue, reduced to deltas by the three classes and priors, not removed. Second, the log as the record and the knowledge base as a projection: storage grows with events and every extractor change replays that layer and the ones after it; in exchange, no migration, temporal queries, and attributable drift. Third, per-layer golden sets derived from the log: they must be frozen and versioned per layer and the subject catalogue must be maintained by hand; in exchange, the failure is localized and the evaluation set follows the real distribution and contains the conflicts. When the document set has no supersession, no conflicts and no audit obligation, plain retrieval is sufficient and an order of magnitude cheaper. The QR gives you the handout and the repository, with the three official versions of art. 2477; `npm run dry-run` reproduces everything you saw offline. Questions.
