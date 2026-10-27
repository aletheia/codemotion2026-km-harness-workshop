# Domain model reference

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revision 4, 27 Oct 2026. Extracted from handbook chapters 2, 4 and 5; this file is the one-page reference the handout and the repository README point to. Running example: art. 2477 c.c., three versions in force during 2019 (`00-running-example.md`). Vocabulary is the abstract's; no other terms are used.

## 1. Entities, identity, invariants

| Entity | Kind | Identity | Invariants |
| --- | --- | --- | --- |
| Lineage | entity | lineage id (e.g. `cc-art2477`) | Groups the successive versions of one document — here the versions of one article of the Civil Code; assigned at ingestion; the scope within which beliefs are compared. |
| Document / DocumentVersion | entity / value | lineage id + document id; version = (version label, content hash, effective date, kind ∈ {consolidated-text, amending-act, system-of-record}) | A version belongs to exactly one lineage; immutable once ingested; duplicate content hash within a lineage rejected. |
| Span | value object | document id, version, half-open interval `[start, end)` in absolute document coordinates | Never exists without an owning Claim; equal fields = the same evidence, not two. |
| Claim | aggregate root | claim id = hash(document id, version, canonical subject key, hash of normalized value) | ≥ 1 Span; state ∈ {proposed, verified, contested, superseded}; every transition is an event with an actor; a verified claim is immutable; a superseded claim references its successor; at most one verified non-superseded claim per (lineage, subject key). |
| SectionTree / SectionNode | entity (Structure layer) | (document id, version) / node path (`header`, `c1`, `abrogato`, `c2` … `c6`) | Intervals non-overlapping and covering the document; every node typed (comma, note, index); paths unique; total span = document length. |
| Entity | entity | canonical entity id from the subject catalogue (`organo-di-controllo`, `revisore`, `societa-srl`, `assemblea`, `tribunale`, `registro-imprese`) | Has at least one verified Claim mentioning it; merges recorded with both predecessors. |
| Policy | entity | policy id (e.g. `nomina-obbligatoria`) | Triple condition / effect / exception, each element referencing verified Claims and resolved Entities; typed effect; applicability (lineage, effective period). |
| WorkflowStep | entity | step id + position (workflow `obbligo-nomina`) | Preconditions reference verified Policies; steps form an acyclic sequence; every required input is an earlier output or declared external; executable on a golden test input. |

Subject key: the canonical pair (subject, quantity), e.g. `ricavi.limite`, `esercizi.consecutivi`, produced by a deterministic lookup in the subject catalogue (subjects and quantities with synonyms: "ricavi delle vendite e delle prestazioni" → `ricavi.limite`, "dipendenti occupati in media" → `dipendenti.limite`). Normalized value: money with currency, integer with unit (years, days, count), percentage, boolean, enumerated, date, or a reference to another lineage (`limiti.riferimento` in the 2014 text, which points at art. 2435-bis); unsupported forms fail normalization and are flagged, never guessed. Critical subset (for the harness): subject-key classes monetary (`attivo.limite`, `ricavi.limite`), count (`dipendenti.limite`) and time-limit (`esercizi.consecutivi`, `cessazione.esercizi`, `assemblea.termine`).

## 2. Bounded contexts and anti-corruption layers

Six contexts in order — Source, Structure, Claims, Entities, Policies, Workflow — plus the Harness as a seventh. The log is shared infrastructure, not a context. A context's event catalogue is its published language; a downstream context reads only verified events of the previous context, through an ACL that filters, translates, stamps causation and records rejections as `ACLRejected`.

| Boundary | Filter | Translation | Notes |
| --- | --- | --- | --- |
| Source → Structure | `DocumentVersionIngested` | (document id, version, text) | — |
| Structure → Claims | `StructureVerified` | one extraction unit per comma node: (document id, version, section path, section text, base offset, section type); section-local spans → absolute by adding base offset (c2 of v8 starts at character 720, so local `[280, 342)` is absolute `[1000, 1062)`); `note` and `index` nodes (the abrogated comma, the header) never become units | The reference ACL, shown live. Without it the Claims prompt is coupled to the Structure tree shape: two coupled versions, unattributable drift. |
| Claims → Entities | `ClaimVerified` | mention candidates (subject text, span, section context) | — |
| Entities → Policies | `EntityResolved` | verified claims grouped by entity | — |
| Policies → Workflow | `PolicyVerified` | orderable preconditions and effects | — |

## 3. Event envelope

| Group | Fields |
| --- | --- |
| Identity | `eventId` (deterministic: hash of producer, input artifact id, extractor version, event type, aggregate id — the idempotency key), `seq` (global), `aggregateVersion` |
| Classification | `type`, `layer`, `aggregateId` |
| Actor | `kind` ∈ {human, agent, harness, import, process}, `id`; for agent also `modelId`, `promptVersion`, `extractorVersion` |
| Traceability | `causationId` (the event consumed), `correlationId` (the extraction run) |
| Payload | type-specific |
| Evidence | required on every decision event, forbidden on fact events |

`process` is the actor kind for deterministic system steps (ingestion, log initialisation, ACL, cursors); see run sheet revision 11 — to be confirmed. Append rejects a duplicate `eventId` silently and counts it.

## 4. Event catalogue

| Event | Family | Layer | Producer | Payload (beyond the envelope) |
| --- | --- | --- | --- | --- |
| `LogInitialised` | fact | source | process | log id, created at |
| `DocumentVersionIngested` | fact | source | process (or import for system-of-record) | lineage id, document id, version, content hash, effective from, effective to (if known), kind, source reference (Normattiva atto and `art.versione`) |
| `StructureProposed` | fact | structure | agent | section tree with absolute intervals |
| `StructureVerified` | decision | structure | human; harness (class A, identical tree by path and type) | tree id; evidence: reviewer note or reconfirmed tree id |
| `ClaimProposed` | fact | claims | agent; human (manual addition) | claim id, lineage id, subject key, normalized value, spans, section path |
| `ClaimVerified` | decision | claims | human; harness (class A only); import (priors) | claim id; evidence: note / reconfirmed belief id + batch id + probe result / source record |
| `ClaimContested` | decision | claims | harness | claim id, conflicting claim id, dimension (same subject, different value); evidence: both values and spans |
| `ClaimSuperseded` | decision | claims | human; harness (reconfirmation chain, identical value) | claim id, successor id; evidence: reason |
| `EntityProposed` | fact | entities | agent | mention → candidate entity |
| `EntityResolved` | decision | entities | human; harness (unambiguous catalogue lookup) | claim id, entity id; evidence |
| `EntityMerged` | decision | entities | human | surviving id, merged ids; evidence |
| `PolicyProposed` | fact | policies | agent | condition, effect, exception, referenced claim ids, applicability |
| `PolicyVerified` / `PolicyContested` / `PolicySuperseded` | decision | policies | human only (verify, supersede); harness (contest) | policy id, successor; evidence |
| `WorkflowStepProposed` | fact | workflow | agent | position, preconditions, effects, inputs, outputs |
| `WorkflowStepVerified` / `WorkflowStepSuperseded` | decision | workflow | human only | step id, successor; evidence: golden test output |
| `ACLRejected` | fact | any | process | upstream event id, missing fields |
| `CursorAdvanced` | fact | any | agent | extractor, last consumed seq |
| `EvalCompleted` | decision | harness | harness | extractor version, golden-set version, TP/FP/FN, precision, recall, per-item outcomes |
| `ExtractorVersionPromoted` | decision | harness | harness; human (bootstrap of the initial version) | extractor version; evidence: the four criteria values, or "initial version" |
| `BatchRejected` | decision | harness | harness | batch id; evidence: probe counts, critical errors |

The contract "layer n consumes only verified artifacts of layer n−1" is checked mechanically: every `*Proposed` event's `causationId` must point at a `*Verified` event of the previous layer.

## 5. Lifecycle (Claim)

| From | To | Event | Actor | Requirement |
| --- | --- | --- | --- | --- |
| — | proposed | `ClaimProposed` | agent or human | ≥ 1 Span |
| proposed | verified | `ClaimVerified` | human; harness in class A only | no verified claim in conflict on the same subject |
| proposed / verified | contested | `ClaimContested` | harness | reference to the conflicting claim |
| contested | verified / superseded | `ClaimVerified` / `ClaimSuperseded` | human only | superseded carries the successor |
| verified | superseded | `ClaimSuperseded` | human; harness only for identical-value reconfirmation | successor mandatory |

Three-class rule (comparator, deterministic code): A reconfirmation — belief exists with the same normalized value → harness verifies with evidence (`esercizi.consecutivi` 2 in both versions); B novelty — no belief → stays proposed, human queue (`cessazione.esercizi`, `assemblea.termine` when first seen); C conflict — belief with a different value → harness contests, human resolves (`ricavi.limite` 2,000,000 → 4,000,000 EUR). Policies and Workflow are always B or C. Audit sampling of class A: illustrative 5 % (20 % when the reconfirmed belief is import-rooted; 100 % below the golden-set minimum, run sheet revision 4).

## 6. Projections (all folds over the log; all droppable and rebuildable)

| Projection | Key | Content |
| --- | --- | --- |
| CurrentBeliefs | (lineage id, subject key) | the verified, non-superseded claim with actor and evidence chain; invariant: at most one per key |
| ClaimsByDocumentVersion | (document id, version) | all claims and their states |
| ConflictQueue | — | open contested claims |
| ReviewQueue | — | proposed claims in class B, ordered by catalogue expectation and extractor agreement |
| Timeline | claim id | state per date |
| BeliefsAtDate | date (valid time) or seq (transaction time) | CurrentBeliefs restricted to the document version in force on the date (`--at 2019-04-30` → the v8 thresholds), or folded up to the sequence |
| Projection per extractor version | extractor version | candidate projections coexist with the promoted one until `ExtractorVersionPromoted` |

The artifact an expertise-aware agent consumes, per lineage: CurrentBeliefs, Policies, WorkflowSteps, ConflictQueue, and the golden-set and extractor versions that produced them. Never raw documents.

## 7. The same model as TypeScript types (what is shown on screen on slides 7 and 17)

These are the types the repository's `src/domain/` and `src/events/` modules export; they are shown before any implementation. Strict TypeScript, ESM, discriminated unions, no classes.

```ts
// src/domain/ids.ts — identities are branded strings; all hashes are SHA-256 truncated to 16 hex chars
export type LineageId = string & { readonly __brand: 'LineageId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type ClaimId = string & { readonly __brand: 'ClaimId' };
export type EventId = string & { readonly __brand: 'EventId' };

// src/domain/document.ts
export type DocumentKind = 'consolidated-text' | 'amending-act' | 'system-of-record';
export interface DocumentVersion {           // value object
  readonly documentId: DocumentId;
  readonly lineageId: LineageId;             // 'cc-art2477'
  readonly version: string;                  // e.g. 'v8', 'v9' (Normattiva art.versione)
  readonly contentHash: string;
  readonly effectiveFrom: string;            // ISO date — valid time ('2019-03-16', '2019-06-18')
  readonly effectiveTo?: string;             // known once the successor is ingested
  readonly kind: DocumentKind;
}

// src/domain/span.ts — half-open, absolute document coordinates; never exists outside a Claim
export interface Span {
  readonly documentId: DocumentId;
  readonly version: string;
  readonly start: number;                    // inclusive
  readonly end: number;                      // exclusive
}

// src/domain/claim.ts
export type ClaimState = 'proposed' | 'verified' | 'contested' | 'superseded';
export type SubjectKey = `${string}.${string}`;          // 'attivo.limite', 'ricavi.limite', 'esercizi.consecutivi'
export type NormalizedValue =
  | { readonly type: 'money'; readonly amount: number; readonly currency: 'EUR' }
  | { readonly type: 'integer'; readonly value: number; readonly unit?: 'years' | 'days' | 'count' }
  | { readonly type: 'percent'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'enum'; readonly value: string }
  | { readonly type: 'date'; readonly value: string }
  | { readonly type: 'reference'; readonly lineageId: LineageId };   // 'limiti.riferimento' → art. 2435-bis (v7 only)

export interface Claim {                     // aggregate root
  readonly claimId: ClaimId;                 // hash(documentId, version, subjectKey, hash(normalizedValue))
  readonly lineageId: LineageId;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly [Span, ...Span[]];   // the invariant "≥ 1 Span" is the type, not a check
  readonly state: ClaimState;
  readonly successor?: ClaimId;              // mandatory when state === 'superseded' (enforced by transition)
}

// src/events/actor.ts
export type Actor =
  | { readonly kind: 'human';   readonly id: string; readonly note?: string }
  | { readonly kind: 'agent';   readonly id: string; readonly modelId: string;
      readonly promptVersion: string; readonly extractorVersion: string }   // 'claims@v1'
  | { readonly kind: 'harness'; readonly id: string; readonly rule: 'class-A' | 'contest' | 'eval' | 'gate' | 'bootstrap' }
  | { readonly kind: 'import';  readonly id: string; readonly source: string }
  | { readonly kind: 'process'; readonly id: 'ingest' | 'log-init' | 'acl' | 'cursor' };   // run sheet rev. 11

// src/events/envelope.ts — fact events carry no evidence; decision events must
export type Layer = 'source' | 'structure' | 'claims' | 'entities' | 'policies' | 'workflow' | 'harness';
interface Envelope<TType extends string, TPayload> {
  readonly eventId: EventId;                 // deterministic: the idempotency key
  readonly seq: number;
  readonly aggregateVersion: number;
  readonly type: TType;
  readonly layer: Layer;
  readonly aggregateId: string;
  readonly actor: Actor;
  readonly causationId?: EventId;
  readonly correlationId: string;
  readonly occurredAt: string;               // transaction time
  readonly payload: TPayload;
}
export type FactEvent<T extends string, P>     = Envelope<T, P> & { readonly evidence?: never };
export type DecisionEvent<T extends string, P, E> = Envelope<T, P> & { readonly evidence: E };

// src/events/catalogue.ts — the Claims layer subset; the other layers follow the same shape
export type ClaimProposed  = FactEvent<'ClaimProposed', { claim: Omit<Claim, 'state' | 'successor'> }>;
export type ClaimVerified  = DecisionEvent<'ClaimVerified', { claimId: ClaimId },
  | { kind: 'human';   note: string }
  | { kind: 'class-A'; reconfirmedBeliefId: ClaimId; batchId: string; probeResult: 'passed' | 'not-applicable' }
  | { kind: 'import';  sourceRecord: string }>;
export type ClaimContested = DecisionEvent<'ClaimContested', { claimId: ClaimId; conflictingClaimId: ClaimId },
  { dimension: 'same-subject-different-value'; values: [NormalizedValue, NormalizedValue]; spans: [Span, Span] }>;
export type ClaimSuperseded = DecisionEvent<'ClaimSuperseded', { claimId: ClaimId; successor: ClaimId },
  { reason: 'human-resolution' | 'reconfirmation-chain'; note?: string }>;

export type ClaimEvent = ClaimProposed | ClaimVerified | ClaimContested | ClaimSuperseded;

// src/domain/transition.ts — the state machine as a pure function; the allowed table is §5 of this file
export type TransitionError = { readonly reason: string };
export declare function transition(state: ClaimState, event: ClaimEvent): ClaimState | TransitionError;

// src/events/append.ts — idempotent append: a duplicate eventId returns the existing seq, never throws
export declare function append(log: Log, event: ClaimEvent): { seq: number; duplicate: boolean };

// src/projections/currentBeliefs.ts — a fold; key (lineageId, subjectKey); at most one per key
export type BeliefKey = `${LineageId}|${SubjectKey}`;
export interface Belief {
  readonly claim: Claim;                     // state === 'verified'
  readonly verifiedBy: Actor;
  readonly evidenceChain: readonly ClaimId[];   // root first: the human (or import) decision the chain rests on
}
export declare function currentBeliefs(events: readonly ClaimEvent[]): ReadonlyMap<BeliefKey, Belief>;
```

What the types enforce by construction: a Claim without a Span does not compile (`[Span, ...Span[]]`); a decision event without evidence does not compile (`DecisionEvent`); an agent actor must carry model id, prompt version and extractor version; the `agents/` module cannot produce `ClaimVerified` because it does not import the decision-event constructors (a test asserts this). What they do not enforce and the transition function must: successor mandatory on `superseded`, no verify while a conflicting belief exists, harness verification only in class A.
