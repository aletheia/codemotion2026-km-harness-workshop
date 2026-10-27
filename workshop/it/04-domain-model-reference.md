# Reference del modello di dominio

Traduzione italiana di `04-domain-model-reference.md`; in caso di divergenza prevale l'inglese.

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revisione 4, 27 ott 2026. Estratto dai capitoli 2, 4 e 5 dell'handbook; questo file è il reference di una pagina a cui rimandano l'handout e il README del repository. Esempio di riferimento: art. 2477 c.c., tre versioni in vigore nel corso del 2019 (`00-running-example.md`). Il vocabolario è quello dell'abstract; non si usano altri termini.

## 1. Entità, identità, invarianti

| Entità | Tipo | Identità | Invarianti |
| --- | --- | --- | --- |
| Lineage | entità | lineage id (es. `cc-art2477`) | Raggruppa le versioni successive di uno stesso documento — qui le versioni di un articolo del Codice civile; assegnato all'ingestione; è l'ambito entro cui le credenze vengono confrontate. |
| Document / DocumentVersion | entità / valore | lineage id + document id; versione = (etichetta di versione, hash del contenuto, data di efficacia, kind ∈ {consolidated-text, amending-act, system-of-record}) | Una versione appartiene a un solo lineage; immutabile dopo l'ingestione; hash del contenuto duplicato entro lo stesso lineage rifiutato. |
| Span | value object | document id, versione, intervallo semiaperto `[start, end)` in coordinate assolute del documento | Non esiste mai senza una Claim che lo possiede; campi uguali = la stessa evidenza, non due. |
| Claim | radice dell'aggregato | claim id = hash(document id, versione, chiave di soggetto canonica, hash del valore normalizzato) | ≥ 1 Span; stato ∈ {proposed, verified, contested, superseded}; ogni transizione è un evento con un attore; una claim verified è immutabile; una claim superseded riferisce il suo successore; al più una claim verified non superseded per (lineage, chiave di soggetto). |
| SectionTree / SectionNode | entità (livello Structure) | (document id, versione) / percorso del nodo (`header`, `c1`, `abrogato`, `c2` … `c6`) | Intervalli non sovrapposti che coprono il documento; ogni nodo tipizzato (comma, note, index); percorsi univoci; estensione totale = lunghezza del documento. |
| Entity | entità | entity id canonico dal catalogo dei soggetti (`organo-di-controllo`, `revisore`, `societa-srl`, `assemblea`, `tribunale`, `registro-imprese`) | Ha almeno una Claim verified che la menziona; le fusioni sono registrate con entrambi i predecessori. |
| Policy | entità | policy id (es. `nomina-obbligatoria`) | Tripla condizione / effetto / eccezione, ogni elemento riferito a Claim verified ed Entity risolte; effetto tipizzato; applicabilità (lineage, periodo di efficacia). |
| WorkflowStep | entità | step id + posizione (workflow `obbligo-nomina`) | Le precondizioni riferiscono Policy verified; i passi formano una sequenza aciclica; ogni input richiesto è un output precedente o è dichiarato esterno; eseguibile su un input di test del golden set. |

Chiave di soggetto: la coppia canonica (soggetto, grandezza), es. `ricavi.limite`, `esercizi.consecutivi`, prodotta da una ricerca deterministica nel catalogo dei soggetti (soggetti e grandezze con sinonimi: "ricavi delle vendite e delle prestazioni" → `ricavi.limite`, "dipendenti occupati in media" → `dipendenti.limite`). Valore normalizzato: importo con valuta, intero con unità (anni, giorni, conteggio), percentuale, booleano, enumerato, data, oppure riferimento a un altro lineage (`limiti.riferimento` nel testo del 2014, che rinvia all'art. 2435-bis); le forme non supportate falliscono la normalizzazione e vengono segnalate, mai indovinate. Sottoinsieme critico (per l'harness): le classi di chiave di soggetto monetary (`attivo.limite`, `ricavi.limite`), count (`dipendenti.limite`) e time-limit (`esercizi.consecutivi`, `cessazione.esercizi`, `assemblea.termine`).

## 2. Bounded context e anti-corruption layer

Sei contesti in ordine — Source, Structure, Claims, Entities, Policies, Workflow — più l'Harness come settimo. Il log è infrastruttura condivisa, non un contesto. Il catalogo degli eventi di un contesto è il suo linguaggio pubblicato; un contesto a valle legge solo gli eventi verified del contesto precedente, attraverso una ACL che filtra, traduce, imprime la causazione e registra i rifiuti come `ACLRejected`.

| Confine | Filtro | Traduzione | Note |
| --- | --- | --- | --- |
| Source → Structure | `DocumentVersionIngested` | (document id, versione, testo) | — |
| Structure → Claims | `StructureVerified` | una unità di estrazione per ogni nodo di tipo comma: (document id, versione, percorso della sezione, testo della sezione, base offset, tipo della sezione); span locali alla sezione → assoluti sommando il base offset (il c2 della v8 inizia al carattere 720, quindi il locale `[280, 342)` è l'assoluto `[1000, 1062)`); i nodi `note` e `index` (il comma abrogato, l'intestazione) non diventano mai unità | La ACL di riferimento, mostrata live. Senza di essa il prompt di Claims è accoppiato alla forma dell'albero di Structure: due versioni accoppiate, deriva non attribuibile. |
| Claims → Entities | `ClaimVerified` | candidati di menzione (testo del soggetto, span, contesto della sezione) | — |
| Entities → Policies | `EntityResolved` | claim verified raggruppate per entità | — |
| Policies → Workflow | `PolicyVerified` | precondizioni ed effetti ordinabili | — |

## 3. Busta dell'evento

| Gruppo | Campi |
| --- | --- |
| Identità | `eventId` (deterministico: hash di produttore, id dell'artefatto di input, versione dell'estrattore, tipo di evento, id dell'aggregato — la chiave di idempotenza), `seq` (globale), `aggregateVersion` |
| Classificazione | `type`, `layer`, `aggregateId` |
| Attore | `kind` ∈ {human, agent, harness, import, process}, `id`; per agent anche `modelId`, `promptVersion`, `extractorVersion` |
| Tracciabilità | `causationId` (l'evento consumato), `correlationId` (l'esecuzione di estrazione) |
| Payload | specifico per tipo |
| Evidenza | obbligatoria su ogni evento di decisione, vietata sugli eventi di fatto |

`process` è il tipo di attore dei passi deterministici di sistema (ingestione, inizializzazione del log, ACL, cursori); si veda la revisione 11 del run sheet — da confermare. L'append rifiuta silenziosamente un `eventId` duplicato e lo conteggia.

## 4. Catalogo degli eventi

| Evento | Famiglia | Livello | Produttore | Payload (oltre la busta) |
| --- | --- | --- | --- | --- |
| `LogInitialised` | fatto | source | process | log id, data di creazione |
| `DocumentVersionIngested` | fatto | source | process (o import per system-of-record) | lineage id, document id, versione, hash del contenuto, efficacia dal, efficacia al (se nota), kind, riferimento alla fonte (atto Normattiva e `art.versione`) |
| `StructureProposed` | fatto | structure | agent | albero delle sezioni con intervalli assoluti |
| `StructureVerified` | decisione | structure | human; harness (classe A, albero identico per percorso e tipo) | tree id; evidenza: nota del revisore o id dell'albero riconfermato |
| `ClaimProposed` | fatto | claims | agent; human (aggiunta manuale) | claim id, lineage id, chiave di soggetto, valore normalizzato, span, percorso della sezione |
| `ClaimVerified` | decisione | claims | human; harness (solo classe A); import (prior) | claim id; evidenza: nota / id della credenza riconfermata + batch id + esito delle sonde / record di origine |
| `ClaimContested` | decisione | claims | harness | claim id, id della claim in conflitto, dimensione (stesso soggetto, valore diverso); evidenza: entrambi i valori e gli span |
| `ClaimSuperseded` | decisione | claims | human; harness (catena di riconferma, valore identico) | claim id, id del successore; evidenza: motivo |
| `EntityProposed` | fatto | entities | agent | menzione → entità candidata |
| `EntityResolved` | decisione | entities | human; harness (ricerca nel catalogo non ambigua) | claim id, entity id; evidenza |
| `EntityMerged` | decisione | entities | human | id superstite, id fusi; evidenza |
| `PolicyProposed` | fatto | policies | agent | condizione, effetto, eccezione, id delle claim riferite, applicabilità |
| `PolicyVerified` / `PolicyContested` / `PolicySuperseded` | decisione | policies | solo human (verifica, supersessione); harness (contestazione) | policy id, successore; evidenza |
| `WorkflowStepProposed` | fatto | workflow | agent | posizione, precondizioni, effetti, input, output |
| `WorkflowStepVerified` / `WorkflowStepSuperseded` | decisione | workflow | solo human | step id, successore; evidenza: output del test del golden set |
| `ACLRejected` | fatto | qualsiasi | process | id dell'evento a monte, campi mancanti |
| `CursorAdvanced` | fatto | qualsiasi | agent | estrattore, ultimo seq consumato |
| `EvalCompleted` | decisione | harness | harness | versione dell'estrattore, versione del golden set, VP/FP/FN, precision, recall, esiti per elemento |
| `ExtractorVersionPromoted` | decisione | harness | harness; human (bootstrap della versione iniziale) | versione dell'estrattore; evidenza: i valori dei quattro criteri, oppure "initial version" |
| `BatchRejected` | decisione | harness | harness | batch id; evidenza: conteggi delle sonde, errori critici |

Il contratto "il livello n consuma solo artefatti verified del livello n−1" è verificato meccanicamente: il `causationId` di ogni evento `*Proposed` deve puntare a un evento `*Verified` del livello precedente.

## 5. Ciclo di vita (Claim)

| Da | A | Evento | Attore | Requisito |
| --- | --- | --- | --- | --- |
| — | proposed | `ClaimProposed` | agent o human | ≥ 1 Span |
| proposed | verified | `ClaimVerified` | human; harness solo in classe A | nessuna claim verified in conflitto sullo stesso soggetto |
| proposed / verified | contested | `ClaimContested` | harness | riferimento alla claim in conflitto |
| contested | verified / superseded | `ClaimVerified` / `ClaimSuperseded` | solo human | superseded porta il successore |
| verified | superseded | `ClaimSuperseded` | human; harness solo per riconferma a valore identico | successore obbligatorio |

Regola delle tre classi (comparatore, codice deterministico): A riconferma — esiste una credenza con lo stesso valore normalizzato → l'harness verifica con evidenza (`esercizi.consecutivi` 2 in entrambe le versioni); B novità — nessuna credenza → resta proposed, coda umana (`cessazione.esercizi`, `assemblea.termine` quando compaiono per la prima volta); C conflitto — credenza con valore diverso → l'harness contesta, l'umano risolve (`ricavi.limite` 2.000.000 → 4.000.000 EUR). Policies e Workflow sono sempre B o C. Campionamento di audit della classe A: 5 % illustrativo (20 % quando la credenza riconfermata ha radice in un import; 100 % sotto il minimo del golden set, revisione 4 del run sheet).

## 6. Proiezioni (tutte fold sul log; tutte cancellabili e ricostruibili)

| Proiezione | Chiave | Contenuto |
| --- | --- | --- |
| CurrentBeliefs | (lineage id, chiave di soggetto) | la claim verified non superseded con attore e catena di evidenza; invariante: al più una per chiave |
| ClaimsByDocumentVersion | (document id, versione) | tutte le claim e i loro stati |
| ConflictQueue | — | claim contested aperte |
| ReviewQueue | — | claim proposed di classe B, ordinate per attesa del catalogo e accordo fra estrattori |
| Timeline | claim id | stato per data |
| BeliefsAtDate | data (valid time) o seq (transaction time) | CurrentBeliefs ristretta alla versione del documento in vigore alla data (`--at 2019-04-30` → le soglie della v8), oppure fold fino alla sequenza |
| Proiezione per versione dell'estrattore | versione dell'estrattore | le proiezioni candidate convivono con quella promossa fino a `ExtractorVersionPromoted` |

L'artefatto che un agente esperto del dominio consuma, per lineage: CurrentBeliefs, Policies, WorkflowSteps, ConflictQueue, e le versioni del golden set e degli estrattori che li hanno prodotti. Mai i documenti grezzi.

## 7. Lo stesso modello come tipi TypeScript (ciò che va a schermo sulle slide 7 e 17)

Questi sono i tipi che i moduli `src/domain/` e `src/events/` del repository esportano; si mostrano prima di qualsiasi implementazione. TypeScript strict, ESM, discriminated union, niente classi.

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

Ciò che i tipi impongono per costruzione: una Claim senza Span non compila (`[Span, ...Span[]]`); un evento di decisione senza evidenza non compila (`DecisionEvent`); un attore agent deve portare model id, prompt version ed extractor version; il modulo `agents/` non può produrre `ClaimVerified` perché non importa i costruttori degli eventi di decisione (un test lo asserisce). Ciò che non impongono e che la funzione di transizione deve imporre: successore obbligatorio su `superseded`, nessuna verifica mentre esiste una credenza in conflitto, verifica dell'harness solo in classe A.
