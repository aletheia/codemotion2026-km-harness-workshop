# Documents Are Not Knowledge — handout di una pagina

Traduzione italiana di `07-handout.md`; in caso di divergenza prevale l'inglese.

Luca Bianchi · Codemotion Milano, 28 ott 2026 · Repository: `<URL del repository — da definire>` · Handbook: `handbook/` nel repository · Stack: TypeScript (Node ≥ 20), offline, ogni chiamata LLM riprodotta da fixture.

**L'idea in una riga.** Una base di conoscenza è una proiezione rigiocabile su un log immutabile di eventi relativi a Claim — asserzioni con identità, provenienza a livello di span e un ciclo di vita — non un database da migrare. Gli agenti propongono; l'harness verifica solo su evidenza già presente nel log; gli umani decidono conflitti e novità.

**Esempio di riferimento.** Art. 2477 c.c. (nomina dell'organo di controllo nelle s.r.l.), versioni Normattiva 7, 8 e 9: in vigore dal 21 ago 2014, dal 16 mar 2019 (D.Lgs. 14/2019: attivo 2 M, ricavi 2 M, 10 dipendenti) e dal 18 giu 2019 (L. 55/2019: 4 M, 4 M, 20). Un lineage, tre versioni, conflitti reali e date reali; i testi sono in `fixtures/documents/`.

## Entità

| Entità | Identità | Invariante |
| --- | --- | --- |
| Lineage / DocumentVersion | lineage id (`cc-art2477`); (versione, hash del contenuto, data di efficacia, kind) | una versione è immutabile; un solo lineage per versione |
| Span (valore) | document id, versione, `[start, end)` assoluto | non esiste mai senza una Claim |
| Claim (radice dell'aggregato) | hash(document id, versione, chiave di soggetto, valore normalizzato) — chiavi di soggetto come `ricavi.limite`, `esercizi.consecutivi` | ≥ 1 Span; stato ∈ {proposed, verified, contested, superseded}; verified è immutabile; superseded ha un successore; ≤ 1 verified non superseded per (lineage, chiave di soggetto) |
| Entity | id di catalogo (`organo-di-controllo`, `revisore`, `assemblea` …) | ≥ 1 Claim verified la menziona |
| Policy | policy id (`nomina-obbligatoria`) | condizione / effetto / eccezione, ciascuno su Claim verified; periodo di applicabilità |
| WorkflowStep | step id + posizione (`obbligo-nomina`) | precondizioni su Policy verified; aciclico; eseguibile su un input del golden set |

## Sei livelli (bounded context), ciascuno consuma solo gli eventi verified del livello precedente attraverso una ACL

source → structure → claims → entities → policies → executable workflow. La ACL filtra (solo Verified), traduce (es. span locali al comma → coordinate assolute), imprime la causazione, registra `ACLRejected`. Senza di essa, un cambio dell'estrattore a monte modifica silenziosamente il prompt a valle: due versioni accoppiate, deriva non attribuibile.

## Catalogo degli eventi

| Famiglia | Eventi | Produttore |
| --- | --- | --- |
| fatto | `LogInitialised`, `DocumentVersionIngested`, `ACLRejected`, `CursorAdvanced` | process / import |
| fatto | `StructureProposed`, `ClaimProposed`, `EntityProposed`, `PolicyProposed`, `WorkflowStepProposed` | agent (model id, prompt version, extractor version); `ClaimProposed` anche human |
| decisione (evidenza obbligatoria) | `StructureVerified`, `ClaimVerified`, `EntityResolved` | human; harness solo in classe A |
| decisione | `ClaimContested`, `PolicyContested` | harness |
| decisione | `ClaimSuperseded`, `EntityMerged`, `PolicyVerified`, `PolicySuperseded`, `WorkflowStepVerified`, `WorkflowStepSuperseded` | human (harness solo per catene di riconferma a valore identico) |
| decisione | `EvalCompleted`, `ExtractorVersionPromoted`, `BatchRejected` | harness |

Busta: `eventId` (deterministico = chiave di idempotenza) · `seq` · `aggregateVersion` · `type` · `layer` · `aggregateId` · `actor` · `causationId` · `correlationId` · `occurredAt` · `payload` · `evidence` (solo decisioni).

## Ciclo di vita e regola delle tre classi

proposed → verified (human; harness in classe A) · proposed/verified → contested (harness) · contested → verified | superseded (human) · verified → superseded (human; harness per riconferma a valore identico). Comparatore (codice deterministico) contro CurrentBeliefs con chiave (lineage, chiave di soggetto): **A** stesso valore → l'harness riconferma con evidenza = id della credenza + batch id (`esercizi.consecutivi` 2 in entrambi i testi del 2019) · **B** nessuna credenza → resta proposed, coda umana (`cessazione.esercizi`, `assemblea.termine`) · **C** valore diverso → contested, risolve l'umano (`ricavi.limite` 2 M → 4 M). Policies e Workflow sono sempre B o C.

## Proiezioni (fold sul log; cancella e ricostruisci)

CurrentBeliefs · ClaimsByDocumentVersion · ConflictQueue · ReviewQueue · Timeline · BeliefsAtDate (valid time per data di efficacia: `--at 2019-04-30` → il testo del 16 marzo; transaction time per sequenza) · una proiezione candidata per versione dell'estrattore fino alla promozione.

## Harness

Golden set di un livello = tutti gli eventi di decisione umani di quel livello fino a una sequenza di cut-off (esclusi decisioni harness/import ed esempi del prompt). Metriche di Claims: allineamento per chiave di soggetto; corretta se e solo se valore uguale e IoU dello span ≥ θ (0,8, illustrativo); coppia errata = FP + FN; P/R in micro-media. Deriva per elemento: stabile / regressione / miglioramento / stabile-errato. Promozione se e solo se P ≥ soglia, R ≥ R(prec) − ε, zero regressioni sul sottoinsieme critico (monetary, count, time-limit), errori di provenienza ≤ 2 %. Gate dei batch su sonde inserite, a conteggio: ≤ 1 FN, ≤ 1 FP, zero critici; fallito → `BatchRejected`, tutto resta proposed. Tutti i numeri sono illustrativi.

## Tre decisioni e cosa costa ciascuna

| Decisione | Costo |
| --- | --- |
| Stato contested esplicito, risolto da un umano (non merge / CRDT / last-writer-wins) | latenza di disponibilità e una coda di revisione |
| Il log è il sistema di riferimento; la base di conoscenza è una proiezione (non uno store mutabile con propagazione delle modifiche) | lo storage cresce con gli eventi; calcolo di riproiezione a ogni cambio di estrattore |
| Golden set per livello derivati dal log (non un insieme end-to-end costruito a parte) | congelamento e versionamento per livello; un catalogo dei soggetti mantenuto a mano |

Walkthrough, in ordine (script npm, argomenti fissati per passo): `npm run log:init` · `ingest:v8` · `extract:structure-v8` · `review` · `extract:claims-v8` · `ingest:v9` · `extract:v9` · `compare` · `log:cat` · `projections:drop` / `projections:build` · `replay:claims-v2` · `projections:diff` · `beliefs:at-2019-04-30` · `golden:claims` · `eval:claims-v1` · `eval:claims-v2-summary` · `drift:v1-v2` · `ask:ricavi-2019-04-30`. `npm run dry-run` riproduce l'intera sessione offline; `npm test` esegue i test unitari ed end-to-end.
