# Outline slide per slide — "Documents Are Not Knowledge: Modelling Extraction as an Event-Driven Domain"
Traduzione italiana di `02-slide-outline.md`; in caso di divergenza prevale l'inglese.
Revisione 4, 27 ott 2026 (esempio corrente: art. 2477 c.c., vedi `00-running-example.md`). Template Codemotion, 16:9, font Codemotion, nessuna slide di copertina. 31 slide visibili, un'idea ciascuna. Ogni slide live (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23, 24, 25, 26, 27, 29) è seguita da una slide nascosta con lo screenshot dell'output corrispondente in `fallback/segN/`; la slide nascosta si mostra solo se il comando live fallisce. Tutte le soglie, i conteggi e le percentuali dell'harness sono illustrativi, come nell'handbook; le date e gli importi dell'art. 2477 sono il testo ufficiale (Normattiva).

## Indice delle slide

| # | Segmento | Titolo | Forma |
| --- | --- | --- | --- |
| 1 | 1 | Chunk → embed → retrieve → hope: cosa si perde (identità, provenienza, tempo) | diagramma |
| 2 | 1 | Il dominio: art. 2477 c.c., tre versioni in vigore nel 2019, cosa cambia | tabella |
| 3 | 1 | Guasto (a): conflitto irrisolvibile | live + screenshot |
| 4 | 1 | Guasto (b): nessuna ritrattazione | live + screenshot |
| 5 | 1 | Guasto (c): nessuna valutazione per livello | live + screenshot |
| 6 | 2 | Sei entità: identità e invarianti | tabella |
| 7 | 2 | Claim come aggregato: Span interni, coordinate assolute, versione | diagramma |
| 8 | 2 | Concetti di domain design usati e il loro effetto | tabella |
| 9 | 2 | Ciclo di vita: la macchina a stati | diagramma |
| 10 | 2 | Chi può emettere cosa; perché non il merge | tabella |
| 11 | 2 | Checkpoint: 2.000.000 verified, arriva 4.000.000 | domanda |
| 12 | 3 | Context map: sei contesti, ACL, log, harness | diagramma |
| 13 | 3 | ACL Structure → Claims in cinque passi | lista |
| 14 | 3 | Perché anti-corruzione: due versioni accoppiate | testo portante |
| 15 | 3 | Le tre classi: CurrentBeliefs e il comparatore | tabella |
| 16 | 3 | Prior come sorgente; l'umano rivede i delta (300 → 60 / 50 / 12, illustrativo) | tabella |
| 17 | 4 | Struttura di un evento | tabella |
| 18 | 4 | Due famiglie: fatto e decisione | tabella |
| 19 | 4 | Proiezioni: fold, cancella, ricostruisci | diagramma |
| 20 | 4 | Riproiezione su cambio di estrattore: due proiezioni che convivono | diagramma |
| 21 | 4 | Query temporale: cosa diceva l'articolo il 30 aprile 2019 | live |
| 22 | 5 | Golden set = una query sul log: quattro proprietà | testo |
| 23 | 5 | Esclusioni; offline e online (sonde) | testo |
| 24 | 5 | Allineamento, classificazione, conteggio | lista |
| 25 | 5 | Eval v1: tabella e metriche | tabella |
| 26 | 5 | Deriva v1 → v2: matrice per elemento | tabella |
| 27 | 5 | Criteri di promozione e gate dei batch | lista |
| 28 | 6 | L'artefatto consumato dall'agente | diagramma |
| 29 | 6 | Policy di consumo e una risposta che cita la credenza | testo |
| 30 | 6 | Checkpoint: cosa può usare l'agente | domanda |
| 31 | chiusura | Tre decisioni e cosa costano; QR handout e repository | tabella |

---

## Segmento 1 — Perché i documenti non sono conoscenza (15:20–15:32)

### Slide 1 — Chunk → embed → retrieve → hope: cosa si perde (identità, provenienza, tempo)
**Punto.** La pipeline standard è un sistema di retrieval, non un modello di conoscenza, perché il suo modello dei dati non ha posto per identità, provenienza o tempo.

**Diagramma.** Quattro riquadri in fila, da sinistra a destra: "Documento" → "Chunk" → "Vettore" → "Risposta", uniti da frecce. Sotto ogni freccia, in rosso, ciò che si perde in quel passo: sotto la prima freccia "identità (a quale claim appartiene)"; sotto la seconda "provenienza (versione, intervallo di caratteri)"; sotto la terza "tempo (vero da quando, fino a quando)". Nessun altro elemento.

**Note per lo speaker.** L'estrazione è un dominio, non una pipeline; questa frase è la tesi e i prossimi ottanta minuti la difendono con meccanismi. Un chunk è una stringa con un vettore attaccato. Non ha identità oltre la sua posizione in un indice, porta al più il nome di un documento e non ha alcuna nozione di quando ciò che dice fosse vero. Queste tre cose si perdono nel momento del chunking e nessun reranker o prompt le recupera, perché sono proprietà del modello dei dati, non della sua qualità. Lewis e colleghi, che hanno introdotto la retrieval-augmented generation, non hanno mai sostenuto che i passaggi recuperati fossero conoscenza; le rassegne sui modi di guasto della RAG catalogano esattamente queste conseguenze. Mostrerò tre guasti su un piccolo insieme di documenti; ciascuno richiede meno di un minuto e ciascuno è la conseguenza di una delle tre perdite.

### Slide 2 — Il dominio: art. 2477 c.c., tre versioni in vigore nel 2019, cosa cambia
**Punto.** Un articolo del Codice civile, tre versioni in vigore nell'arco di un anno, basta a produrre conflitto, supersessione e una regola eseguibile, su un testo che nessuno in sala può liquidare come inventato.

**Tabella.**

| Versione (Normattiva) | In vigore | Atto modificativo | Lett. c) del comma sulla nomina obbligatoria |
| --- | --- | --- | --- |
| v7 | 21 ago 2014 – 15 mar 2019 | D.L. 91/2014, art. 20 c. 8, conv. L. 116/2014 | "per due esercizi consecutivi ha superato **due** dei limiti indicati dal primo comma dell'articolo 2435-bis" |
| v8 | 16 mar 2019 – 17 giu 2019 | D.Lgs. 14/2019, art. 379 | "almeno **uno** dei seguenti limiti": attivo **2 milioni** · ricavi **2 milioni** · **10** unità |
| v9 | dal 18 giu 2019 | D.L. 32/2019, art. 2-bis, conv. L. 55/2019 | attivo **4 milioni** · ricavi **4 milioni** · **20** unità |

Sotto la tabella: *Fonte: Normattiva, R.D. 262/1942, art. 2477, versioni dell'articolo 7, 8, 9, consultate il 27 ott 2026. Lineage `cc-art2477`; v8 e v9 vengono ingerite live, v7 si usa solo nella baseline di retrieval.*

**Note per lo speaker.** L'esempio corrente per tutta la sessione è l'articolo 2477 del Codice civile, la norma che dice quando una s.r.l. deve nominare l'organo di controllo o il revisore. Nel 2019 le sue soglie sono cambiate due volte in tre mesi: il Codice della crisi, in vigore dal 16 marzo, ha sostituito "due dei tre limiti dell'articolo 2435-bis" con "almeno uno" fra due milioni, due milioni, dieci dipendenti; la legge di conversione del decreto sblocca cantieri, in vigore dal 18 giugno, li ha raddoppiati a quattro milioni, quattro milioni, venti. Il testo è ufficiale, pubblico e italiano, e Normattiva pubblica ogni versione con il suo periodo di vigenza. L'ho scelto perché ha le tre proprietà che rendono difficile l'estrazione: tre fonti dichiarano valori diversi per la stessa grandezza, ogni versione supera la precedente a una data reale, e la regola deve essere eseguibile per decidere se una data società ha l'obbligo. Gli importi sono quelli della legge; le soglie dell'harness, più avanti, sono illustrative.

### Slide 3 — Guasto (a): conflitto irrisolvibile
**Punto.** Il retrieval restituisce "due dei limiti dell'art. 2435-bis", "2 milioni" e "4 milioni" con punteggi comparabili e nessun campo che li distingua.

**A schermo.** Terminale, `npm run rag:query`; slide nascosta con `fallback/seg1/rag-query.txt`.

**Note per lo speaker.** Le tre versioni sono indicizzate. La query è "soglia ricavi nomina organo di controllo". Tornano tre passaggi della lett. c) con similarità comparabile: uno rinvia ai limiti di un altro articolo, uno dice due milioni, uno dice quattro milioni, e nulla in nessun risultato dice quale versione sia o da quando si applicasse. Il generatore ne sceglierà uno per posizione nel prompt, li fonderà, o li riporterà tutti e tre; nessuna di queste è una risposta. Le pezze consuete non lo risolvono: filtrare sui metadati di versione richiede che la query sappia già quale versione si applica, cioè ciò che il sistema dovrebbe sapere; riordinare per recenza confonde la data di ingestione con la data di efficacia; cancellare le versioni vecchie è il guasto successivo. Ora il checkpoint, prima di mostrare altro: un'assemblea del 30 aprile 2019 approva il bilancio 2018. Quale soglia di ricavi si applica, e su quale evidenza presente nel chunk? Prendetevi un momento. La risposta corretta è che nessuna evidenza è presente; il chunk non ha un campo per contenerla. È il buco che il segmento 2 riempie con uno span e una versione.

### Slide 4 — Guasto (b): nessuna ritrattazione
**Punto.** L'unica operazione su un indice vettoriale è la cancellazione, e la cancellazione distrugge il periodo in cui il vecchio testo era in vigore.

**A schermo.** Terminale, `npm run rag:delete-v8` poi la stessa query; slide nascosta con `fallback/seg1/rag-after-delete.txt`.

**Note per lo speaker.** La versione 9 supera la versione 8, che aveva superato la versione 7. L'unica cosa che posso fare all'indice è cancellare i chunk superati. Lo faccio, rilancio la stessa query, un risultato: quattro milioni. L'assemblea dell'aprile 2019 non ha più risposta; il suo periodo è sparito. Se invece tengo i chunk, il guasto (a) si ripresenta a ogni query che tocca un comma cambiato. Non c'è una terza opzione perché l'indice non ha uno stato in cui un passaggio non è più corrente ma è ancora vero per il suo periodo. La supersessione è una relazione tra due asserzioni nel tempo, e l'indice non ha né asserzioni né tempo.

### Slide 5 — Guasto (c): nessuna valutazione per livello
**Punto.** Un'estrazione in un colpo solo non può dire se l'errore stava nella lettura della struttura, del valore o dell'attribuzione, quindi la valutazione collassa nel controllo end-to-end della risposta.

**A schermo.** Terminale, `npm run rag:extract-c2`; slide nascosta con `fallback/seg1/rag-extract.txt`.

**Note per lo speaker.** Questo è un prompt di estrazione lanciato sul comma con le soglie in un colpo solo: un blocco di JSON. Supponiamo che uno di questi valori sia sbagliato. Dov'è l'errore? Il confine del comma è stato letto male, il modello ha contato il comma abrogato, il comma era giusto e il numero letto male, oppure il numero era giusto e attribuito alla grandezza sbagliata? Nessuno in sala può dirlo, e nemmeno il sistema, perché l'output è un artefatto prodotto da un unico passo opaco. La conseguenza operativa è che l'estrattore non può essere migliorato senza rivalutare tutto. Debrief: tre perdite, identità, provenienza, tempo. Tutte e tre sono l'assenza dello stesso oggetto, un'asserzione con un'identità, una provenienza e un ciclo di vita. Ora costruiamo quell'oggetto, e lo costruiamo a partire dalle entità, non dagli strumenti.

---

## Segmento 2 — Gli artefatti di conoscenza come aggregati di prima classe (15:32–15:45)

### Slide 6 — Sei entità: identità e invarianti
**Punto.** Sei entità con identità e invarianti espliciti sono l'intero modello; tutto il resto è derivato.

**Tabella.**

| Entità | Identità | Invarianti |
| --- | --- | --- |
| Document | lineage id + document id; DocumentVersion è un valore (etichetta, hash del contenuto, data di efficacia) | una lineage per versione; immutabile una volta ingerita |
| Span (valore) | document id, versione, intervallo semiaperto `[start, end)` in coordinate assolute | non esiste mai senza una Claim che lo possiede |
| Claim (radice dell'aggregato) | hash di (document id, versione, chiave di soggetto, valore normalizzato) | ≥ 1 Span; stato ∈ {proposed, verified, contested, superseded}; ogni transizione è un evento con un attore; verified è immutabile; superseded riferisce il successore |
| Entity | id canonico dal catalogo dei soggetti | ha ≥ 1 Claim verified che la menziona |
| Policy | policy id | condizione / effetto / eccezione, ciascuno riferito a Claim verified |
| WorkflowStep | step id + posizione | precondizioni ed effetti riferiscono Policy verified |

**Note per lo speaker.** Sei entità, lette dall'alto. Un Document appartiene a una lineage, qui `cc-art2477`, e le sue versioni sono valori: etichetta v8 o v9, hash del contenuto, data di efficacia. Uno Span è un value object, un intervallo semiaperto di caratteri in coordinate assolute del documento con la versione allegata, e non esiste mai da solo. Una Claim è la radice dell'aggregato: la sua identità è un hash deterministico di documento, versione, chiave di soggetto canonica e valore normalizzato, così la stessa asserzione estratta due volte ha lo stesso id. La chiave di soggetto è il nome canonico di una grandezza, `ricavi.limite`, `dipendenti.limite`, risolto attraverso un catalogo mantenuto a mano con i sinonimi. Entity, Policy e WorkflowStep stanno sopra e ciascuna riferisce solo claim o policy verified. Questi invarianti sono ciò che il log permette di verificare a posteriori.

### Slide 7 — Claim come aggregato: Span interni, coordinate assolute, versione
**Punto.** La provenienza non si può perdere perché uno Span è un valore dentro l'aggregato Claim, non una colonna annullabile altrove.

**Diagramma.** Un riquadro grande con etichetta "Claim" che contiene quattro righe di testo: "claim id", "chiave di soggetto: ricavi.limite", "valore normalizzato: 2.000.000 EUR", "stato: proposed". Nello stesso riquadro, un riquadro piccolo: "Span [1.067, 1.126) in cc-art2477-v8.txt". Dal riquadro piccolo una freccia verso un riquadro esterno a destra: "DocumentVersion v8 · hash 7f98bb0c… · in vigore dal 2019-03-16 al 2019-06-17", che a sua volta ha una freccia verso un riquadro "Lineage: cc-art2477".

**A schermo dopo il diagramma.** Terminale: `npm run log:init`, `npm run ingest:v8`, `npm run extract:structure-v8`, `npm run review`, `npm run extract:claims-v8`, `npm run show:ricavi-v8`; slide nascosta con `fallback/seg2/log-after-extract.txt`.

**Note per lo speaker.** Una Claim non può essere costruita senza almeno uno Span; l'invariante è strutturale, applicato dove la Claim viene creata, non una regola di validazione che si può saltare. Due estrazioni che producono lo stesso Span sulla stessa versione producono la stessa evidenza, perché i value object sono uguali quando i loro campi sono uguali. Ora il log. `npm run log:init`: nel tail, `LogInitialised` e una decisione di bootstrap, `ExtractorVersionPromoted` per la versione 1 di claims, attore human, evidenza "initial version"; ci servirà più avanti. `npm run ingest:v8`, poi l'estrattore di struttura, poi `npm run review` dove verifico l'albero dei commi, perché il livello Claims accetta solo struttura verified. Poi l'estrattore delle claim sul comma 2: quattro `ClaimProposed` da claims@v1. `npm run show:ricavi-v8` stampa per esteso la proposta sui ricavi: span assoluto [1.067, 1.126), attore agent con model id e prompt version, causazione che punta alla `StructureVerified`.

### Slide 8 — Concetti di domain design usati e il loro effetto
**Punto.** Ogni concetto di domain design è mantenuto solo perché produce un effetto osservabile nel log.

**Tabella.**

| Concetto | Uso qui | Effetto osservabile |
| --- | --- | --- |
| Aggregato e radice | Claim è la radice, gli Span sono interni | la provenienza non si può perdere |
| Entità vs value object | Document, Claim, Entity, Policy, WorkflowStep hanno identità; Span, DocumentVersion sono valori | span uguali sono una sola evidenza |
| Invariante | applicato alla costruzione e alla transizione | verificabile dal log a posteriori |
| Evento di dominio | ogni transizione è un fatto con un attore, mai un comando | il log è rigiocabile |
| Proiezione | la knowledge base è una vista sul log | nessuna migrazione: si ricostruisce |
| Bounded context | ogni livello ne è uno; l'Harness è un settimo; il log è infrastruttura | "comma" significa una cosa sola per contesto |
| Linguaggio pubblicato | il catalogo degli eventi di un contesto è la sua unica interfaccia | a valle non si leggono mai gli interni di monte |
| Anti-corruption layer | traduzione all'ingresso di ogni contesto | le versioni degli estrattori restano indipendenti |

**Note per lo speaker.** Questi sono i termini di domain design che userò, e solo questi. Le definizioni di Evans, ciascuna con l'effetto che potete osservare nel log sulla destra. Aggregato e radice ci danno l'invariante di provenienza appena visto. Entità contro value object rende span uguali una sola evidenza invece di due. Gli eventi di dominio sono fatti accaduti con un attore, mai comandi, ed è questo che rende il log rigiocabile. Proiezione significa che la knowledge base è una vista, cancellabile e ricostruibile, quindi non c'è nulla da migrare. Bounded context: ciascuno dei sei livelli ne è uno, l'Harness è un settimo, il log è infrastruttura condivisa e non un contesto; senza confini espliciti "comma" è un nodo dell'albero, un'asserzione e una regola nello stesso codice. Linguaggio pubblicato e anti-corruption layer tornano nel segmento 3, dove l'ACL è mostrata per esteso.

### Slide 9 — Ciclo di vita: la macchina a stati
**Punto.** Quattro stati, ogni transizione un evento con un attore; l'agente di estrazione produce sempre e solo il primo.

**Diagramma.** Macchina a stati, da sinistra a destra. Un punto di partenza pieno con una freccia verso un riquadro arrotondato "proposed", etichetta della freccia "ClaimProposed (agent o human)". Da "proposed" due frecce: una verso "verified", etichetta "ClaimVerified (human; harness in classe A)"; una verso "contested", etichetta "ClaimContested (harness)". Da "verified" una freccia verso "contested", etichetta "ClaimContested (harness)", e una freccia verso "superseded", etichetta "ClaimSuperseded (human; harness per riconferma a valore identico)". Da "contested" due frecce: verso "verified", etichetta "ClaimVerified (human)"; verso "superseded", etichetta "ClaimSuperseded (human)". Da "superseded" una freccia verso un punto finale. Colori: "proposed" grigio, "verified" verde, "contested" ambra, "superseded" grigio-blu. Nessuna freccia esce da "superseded" se non verso la fine.

**Note per lo speaker.** Proposed, verified, contested, superseded. Leggete le etichette sulle frecce, perché l'attore è il punto. `ClaimProposed` viene da un agente, con model id, prompt version ed extractor version, oppure da un umano. `ClaimVerified` viene da un umano, o dall'harness in un caso ben definito che incontreremo nel segmento 3. `ClaimContested` è sempre l'harness: la rilevazione è meccanica. Uscire da contested è solo umano. `ClaimSuperseded` porta un successore obbligatorio. Invarianti: una claim verified è immutabile; una claim superseded riferisce sempre il suo successore; una claim proposed mai verificata resta proposed, e l'harness misura quel backlog invece di nasconderlo. Ogni transizione registra chi l'ha causata, così più avanti possiamo chiedere quale versione dell'estrattore ha prodotto questa claim sbagliata e chi l'ha verificata.

### Slide 10 — Chi può emettere cosa; perché non il merge
**Punto.** Il conflitto è mantenuto come stato esplicito con risoluzione umana perché la risoluzione è un giudizio, non una funzione.

**Tabella.**

| Evento | Agent | Human | Harness |
| --- | --- | --- | --- |
| ClaimProposed | sì | sì | no |
| ClaimVerified | mai | sì | solo classe A (evidenza: id della credenza riconfermata + id del batch) |
| ClaimContested | no | no | sì (rilevazione) |
| ClaimSuperseded | no | sì (successore obbligatorio) | solo catena di riconferma a valore identico |

Sotto la tabella una riga: *Alternativa non scelta: merge deterministico / CRDT / last-writer-wins — il disaccordo è esso stesso conoscenza; data di ingestione ≠ data di efficacia.*

**A schermo dopo la tabella.** Terminale: `npm run review`; slide nascosta con `fallback/seg2/log-after-verify.txt`.

**Note per lo speaker.** L'agente propone e nient'altro; nel repository è un'impossibilità a livello di tipi, il modulo degli agenti non può importare i costruttori degli eventi di decisione. Perché non fondere le due soglie dei ricavi in un solo valore con una funzione di risoluzione? Perché nei testi normativi la risoluzione è un giudizio: quale versione si applica a quale data, se un atto successivo sostituisce o aggiunge, se si applica una norma transitoria. Un giudizio va registrato con un attore e una data. I CRDT sono lo strumento giusto quando scritture concorrenti hanno un merge lecito; qui distruggerebbero silenziosamente il disaccordo, e il disaccordo è conoscenza. Last-writer-wins è sbagliato per principio perché la data di ingestione non è la data di efficacia: ingeriamo un testo del 2019 nel 2026. Il costo, dichiarato: una claim contested non è consumabile finché un umano non la risolve, quindi c'è una coda di revisione e c'è latenza. Ora la revisione vera e propria, e guardate cosa ha sbagliato l'agente.

### Slide 11 — Checkpoint: 2.000.000 verified, arriva 4.000.000
**Punto.** La sala prevede gli stati e gli attori prima che il comparatore esista.

**Sulla slide, solo questo testo.** "`ricavi.limite` 2.000.000 EUR è verified. Un'estrazione successiva propone 4.000.000 EUR sullo stesso soggetto. Dopo l'evento: qual è lo stato di ciascuna claim, e chi può emettere l'evento?"

**Note per lo speaker.** La risposta, data solo dopo che la sala si è esposta: 2.000.000 resta verified, perché una claim verified è immutabile e nulla l'ha ancora superata. 4.000.000 nasce proposed e diventa contested, e l'attore di quella transizione è l'harness, perché rilevare un valore diverso sullo stesso soggetto è meccanico. La risoluzione, verificare 4.000.000 e dichiarare superseded 2.000.000 con quello come successore, è solo umana. Poi la revisione live sullo schermo della slide 10, che è il debrief di questo segmento: claims@v1 ha proposto quattro claim; il revisore ne verifica due, `attivo.limite` 2.000.000 e `ricavi.limite` 2.000.000; ne lascia due proposed, `esercizi.consecutivi` 3 perché il valore è sbagliato — il modello ha confuso la regola di cessazione a tre anni con l'innesco a due anni — e `capitale.soglia` perché riproduce l'innesco sul capitale abrogato nel 2014, che non è in questo testo; e ne aggiunge due a mano, `esercizi.consecutivi` 2 e `dipendenti.limite` 10, ciascuna come `ClaimProposed` umana seguita da una `ClaimVerified`. Quattro claim verified con attore human e una nota; due proposte lasciate nel backlog, visibili, non cancellate. L'agente propone, l'umano decide, l'evento registra chi.

---

## Segmento 3 — I sei livelli, l'ACL e le tre classi (15:45–15:57)

### Slide 12 — Context map: sei contesti, ACL, log, harness
**Punto.** Ogni livello è un bounded context che consuma solo gli eventi verified del precedente, attraverso una ACL, e tutti condividono un solo log.

**Diagramma.** In alto, sei riquadri in fila: "1 Source", "2 Structure", "3 Claims", "4 Entities", "5 Policies", "6 Workflow". Fra ogni coppia adiacente un riquadro piccolo con etichetta "ACL", con una freccia che vi entra dal riquadro di sinistra etichettata "eventi Verified" e una freccia che ne esce verso il riquadro di destra. Sotto la fila, un riquadro largo che occupa tutta la larghezza: "Log append-only (infrastruttura condivisa)". Una freccia verticale a doppia punta da ciascuno dei sei riquadri verso il log. In basso a destra, un riquadro "Harness" con una freccia dal log etichettata "eventi di decisione" e una freccia di ritorno verso il log etichettata "ExtractorVersionPromoted / BatchRejected". Nessuna freccia fra livelli non adiacenti.

**Note per lo speaker.** Sei bounded context in ordine: source, structure, claims, entities, policies, executable workflow. L'Harness è un settimo contesto; il log è infrastruttura condivisa da tutti, non un contesto. L'unico contratto fra livelli, il livello n consuma solo artefatti verified del livello n meno 1, vive nell'ACL a ogni confine. Ogni ACL fa tre cose: filtra, accettando solo eventi verified; traduce, dalla forma dell'evento di monte al tipo di input proprio del contesto; e marca la causazione, così l'id dell'evento consumato diventa l'id di causazione di tutto ciò che ne viene prodotto. Quel contratto è verificabile dal log seguendo gli id di causazione: ogni `ClaimProposed` deve puntare a una `StructureVerified`. Oggi eseguiamo live i primi tre livelli e mostriamo gli ultimi tre come estratto precomputato.

### Slide 13 — ACL Structure → Claims in cinque passi
**Punto.** L'ACL traduce forma e coordinate, nient'altro, ed è lì che l'invariante di provenienza viene applicato.

**Lista.**
1. Filtro — accetta solo `StructureVerified`; `StructureProposed` e tutto il resto viene ignorato.
2. Selezione — un'unità di estrazione per ogni nodo di tipo comma; i nodi header e note (la riga "COMMA ABROGATO") non diventano unità.
3. Traduzione e coordinate — copia il testo del comma, fissa l'offset di base; span locale al comma 2 `[280, 342)` + base 720 → assoluto `[1.000, 1.062)`.
4. Causazione — l'id della `StructureVerified` diventa l'id di causazione di ogni unità e di ogni `ClaimProposed`.
5. Rifiuto — un albero senza intervalli o senza versione produce `ACLRejected`, non un'eccezione.

Sotto la lista: *Nota sulla numerazione: la v8 dice "lettera c) del terzo comma" (il redattore ha contato il comma abrogato); la v9 l'ha corretta in "secondo comma". L'albero adotta la lettura della v9; il nodo note mantiene visibile la discrepanza.*

**A schermo dopo la lista.** Terminale: `npm run ingest:v9`, `npm run extract:v9`; slide nascosta con `fallback/seg3/log-after-extract-v9.txt`.

**Note per lo speaker.** A monte, il contesto Structure pubblica un albero di commi con percorsi, tipi e intervalli assoluti. A valle, il contesto Claims lavora sul proprio tipo di input, l'unità di estrazione: testo, offset di base, percorso. L'ACL in cinque passi. Filtro: questo è l'unico punto in cui si applica "solo verified dal livello precedente". Selezione: cosa è estraibile lo decide il contesto Claims, non Structure; il comma abrogato è un nodo note e non diventa mai un'unità. Coordinate: l'estrattore restituisce span locali al comma, l'ACL aggiunge l'offset di base, 720 per il comma 2 della v8, e l'invariante di provenienza dipende da quella conversione. Causazione. Rifiuto come fatto registrato. L'ACL non giudica il contenuto, quello è l'harness, e non interpreta il significato, quello è l'estrattore. La nota sulla numerazione è reale: la versione 8 conta il comma abrogato, la versione 9 no; una decisione di struttura, registrata, non nascosta. Ora la versione 9: ingestione, estrazione di struttura e claim insieme, unità commi 2, 3 e 5. Nel tail, `StructureVerified` con attore harness, perché l'albero della v9 ha gli stessi percorsi e tipi dell'albero verified della v8; poi le unità dell'ACL e sei `ClaimProposed`. Mi fermo prima del comparatore.

### Slide 14 — Perché anti-corruzione: due versioni accoppiate
**Punto.** Senza una ACL, un cambiamento nell'estrattore di Structure cambia il prompt di Claims senza un cambio di versione di Claims, e la deriva che ne risulta non è attribuibile a nessuno.

**Sulla slide.** Due brevi colonne di testo. A sinistra, intestazione "Senza ACL": "Prompt di Claims costruito sulla forma dell'albero di Structure → Structure v2 aggiunge il tipo di nodo *lettera* → il prompt di Claims cambia, la versione dell'estrattore di Claims resta invariata → due versioni accoppiate, deriva attribuibile a nessuna delle due." A destra, intestazione "Con ACL": "L'estrattore di Claims vede solo unità di estrazione → il nuovo tipo di nodo è gestito nell'ACL → la modifica dell'ACL è versionata come tale → estrattore di Claims identico, deriva attribuibile."

**Note per lo speaker.** Questo è il passaggio portante, quindi lo dirò lentamente. Senza una ACL, il prompt dell'estrattore di Claims è costruito direttamente sulla forma dell'albero di Structure. Quando l'estrattore di Structure cambia e introduce un nuovo tipo di nodo, diciamo che comincia a spezzare un comma nelle sue lettere, il prompt di Claims cambia benché nessuno abbia cambiato la versione dell'estrattore di Claims. Due versioni accoppiate, e una deriva nelle claim che non può essere attribuita a nessuna delle due. Con l'ACL, adattarsi al nuovo tipo di nodo è una modifica dell'ACL, versionata come tale, e l'estrattore di Claims resta identico. Questo è il meccanismo dietro la valutazione per livello del segmento 5: una versione di estrattore può essere ritenuta responsabile del suo output solo se il suo contratto di input è fissato e versionato indipendentemente dall'estrattore a monte.

### Slide 15 — Le tre classi: CurrentBeliefs e il comparatore
**Punto.** Una proposta diventa verified attraverso una di tre classi decise da codice deterministico contro CurrentBeliefs, mai da un modello.

**Tabella.**

| Classe | Condizione | Chi decide | Evento |
| --- | --- | --- | --- |
| A — riconferma | credenza verificata da umano sullo stesso soggetto, stesso valore normalizzato, batch che ha superato le sonde | harness | `ClaimVerified(actor=harness, evidence = id della credenza + id del batch)`; la claim riconfermata dichiarata superseded come contabilità |
| B — novità | nessuna credenza sul soggetto | umano | resta proposed, coda di revisione |
| C — conflitto | credenza con un valore diverso | l'harness contesta, l'umano risolve | `ClaimContested`, poi `ClaimVerified` / `ClaimSuperseded` umane |

Sotto la tabella: *Comparatore: lineage → soggetto canonico (non risolto = novità inattesa, alta priorità) → ricerca in CurrentBeliefs → confronto dei valori → IoU degli span ≥ θ nella stessa versione per la classe A. Livelli Policies e Workflow: sempre B o C. Campionamento di audit della classe A: 5 % (20 % contro prior importati; 100 % sotto il minimo del golden set), illustrativo.*

**A schermo dopo la tabella.** Checkpoint, poi `npm run compare`, poi `npm run review`; slide nascosta con `fallback/seg3/log-after-compare.txt`.

**Note per lo speaker.** CurrentBeliefs è una proiezione con chiave lineage e chiave di soggetto, che contiene la claim verified non superseded con il suo attore e la sua evidenza; al più una per chiave, e se un fold ne trova due, il bug è nel comparatore. Il comparatore è codice, mai un modello di linguaggio: risolve la lineage, canonicalizza il soggetto attraverso il catalogo, cerca, confronta i valori normalizzati. Checkpoint: sei proposte dalla versione 9 sono sullo schermo; classificate ciascuna in A, B o C prima che il comparatore giri. Dopo che la sala si è esposta: `esercizi.consecutivi` 2 è A; `attivo.limite` 4.000.000, `ricavi.limite` 4.000.000 e `dipendenti.limite` 20 sono C; `cessazione.esercizi` 3 e `assemblea.termine` 30 giorni sono B, perché i commi 3 e 5 non sono stati estratti nel segmento 2 e non esiste alcuna credenza su quei soggetti. `npm run compare`: una `ClaimVerified` con attore harness ed evidenza, tre `ClaimContested`, due proposte in coda. Leggete la riga del gate: batch gate non applicabile, un golden set di quattro elementi attesi è sotto il minimo illustrativo di dieci, quindi la classe A è decisa dal solo comparatore e ogni riconferma di classe A è campionata per audit umano finché il minimo non è raggiunto. `npm run review`: verifico i tre valori della v9 e dichiaro superseded le tre claim della v8 con i loro successori della v9.

### Slide 16 — Prior come sorgente; l'umano rivede i delta (300 → 60 / 50 / 12, illustrativo)
**Punto.** La regola delle tre classi rende il costo umano proporzionale a novità più conflitto invece che al volume, al costo dichiarato di riconfermare un errore umano iniziale.

**Tabella.** (illustrativa, documento da 300 claim)

| Scenario | L'umano verifica tutto | Regola delle tre classi |
| --- | --- | --- |
| Prima ingestione, nessun prior | 300 | 300 |
| Prima ingestione con un prior da sistema di riferimento (240 riconferme, 40 novità, 20 contraddizioni) | 300 | 60 |
| Nuova versione: 250 invariate, 30 cambiate, 20 nuove | 300 | 50 |
| Estrattore v2 sul corpus esistente, 12 disaccordi con v1 | 300 | 12 |

Sotto la tabella: *I prior entrano nel log come sorgenti con un attore e un'evidenza (import da sistema di riferimento — qui il registro di compliance di un'azienda con le soglie che applica, illustrativo; una versione di riferimento verificata; il catalogo dei soggetti), mai come configurazione. Costo nascosto: un errore umano iniziale viene riconfermato in classe A a ogni riproiezione; mitigato dal campionamento, non eliminato.*

**Note per lo speaker.** L'alternativa alle tre classi è un umano che verifica tutto, e il suo costo è proporzionale al volume: ogni riproiezione, una nuova versione o un nuovo estrattore, riproduce l'intero volume. Con la regola delle tre classi l'umano rivede i delta, e i delta sono esattamente i casi interessanti. Illustrativo, su un documento da 300 claim: 300 contro 300 a freddo, ma 60 con un prior da sistema di riferimento, 50 per la versione successiva, 12 per una nuova versione di estrattore. Cambiare un estrattore, che con la revisione integrale è così costoso da non farsi mai, diventa economico. I prior sono modellati come sorgenti nel log, con un attore e un'evidenza, perché un prior deve poter essere superato come ogni credenza; in questo dominio il sistema di riferimento è il registro di compliance dell'azienda stessa con le soglie che applica, e verified da import è più debole di verified da umano. Il costo nascosto appartiene alla slide di chiusura: la classe A assume che il primo umano avesse ragione, e un errore precoce viene riconfermato per sempre a meno che il campionamento o una supersessione non lo intercettino. Debrief: `npm run layers-4-6`, trenta secondi di eventi precomputati di Entities, Policies e Workflow — la policy "nomina obbligatoria" con la sua condizione, il suo effetto e la sua eccezione, e il workflow che decide l'obbligo per una data società — stesso schema di ACL, stessa regola proposed poi verified, mai eseguiti live perché non ci stanno.

---

## Segmento 4 — La knowledge base come proiezione rigiocabile (15:57–16:09)

### Slide 17 — Struttura di un evento
**Punto.** Ogni evento porta identità, classificazione, attore, tracciabilità, payload e, per le decisioni, evidenza; l'id dell'evento è la chiave di idempotenza.

**Tabella.**

| Gruppo | Campi | Nota |
| --- | --- | --- |
| Identità | id dell'evento, sequenza globale, versione dell'aggregato | id dell'evento deterministico da (produttore, id dell'artefatto di input, versione dell'estrattore): i duplicati sono rifiutati all'append |
| Classificazione | tipo, livello, id dell'aggregato | |
| Attore | kind (human / agent / harness / import / process), id; per agent: model id, prompt version, extractor version | `process` per ingestione, inizializzazione del log, ACL, cursori |
| Tracciabilità | id di causazione, id di correlazione | causazione = l'evento consumato; correlazione = l'esecuzione di estrazione |
| Payload | specifico per tipo | |
| Evidenza | solo eventi di decisione, obbligatoria | span, risultati delle sonde, nota del revisore, id della claim in conflitto, id della credenza riconfermata |

**Note per lo speaker.** Questa è la forma di ogni riga nel tail. Prima l'identità: l'id dell'evento è deterministico dal produttore, dall'artefatto di input e dalla versione dell'estrattore, così una riesecuzione della stessa versione sullo stesso input produce lo stesso id e l'append lo scarta silenziosamente. È questo che rende sicuri agenti paralleli e riavviabili. Una versione diversa produce id diversi e viene appesa per costruzione. Attore: human, agent, harness, import o process, e per un agent il model id, la prompt version e l'extractor version. Tracciabilità: la causazione è l'evento consumato, la correlazione è l'esecuzione. L'evidenza è obbligatoria sugli eventi di decisione e vietata sugli eventi di fatto, applicato nello schema. Oggi lo storage è un file; gli unici requisiti sono append ordinato e idempotente, quindi uno stream distribuito è un cambio di adattatore, non di modello.

### Slide 18 — Due famiglie: fatto e decisione
**Punto.** Le decisioni sono importanti quanto i fatti e portano sempre un'evidenza; rigiocare il log ricostruisce non solo cosa si credeva ma perché e chi ha deciso.

**Tabella.**

| Famiglia | Eventi | Livello |
| --- | --- | --- |
| Fatto | `LogInitialised`, `DocumentVersionIngested` | Source |
| Fatto | `StructureProposed`, `ClaimProposed`, `EntityProposed`, `PolicyProposed`, `WorkflowStepProposed` | Structure … Workflow |
| Fatto | `ACLRejected`, `CursorAdvanced` | tutti |
| Decisione | `StructureVerified`, `ClaimVerified`, `ClaimContested`, `ClaimSuperseded`, `EntityResolved`, `EntityMerged`, `PolicyVerified`, `WorkflowStepVerified` | per livello |
| Decisione | `ExtractorVersionPromoted`, `BatchRejected`, `EvalCompleted` | Harness |

**Note per lo speaker.** Due famiglie. Fatti: qualcosa è stato ingerito, proposto, rifiutato da una ACL, oppure un cursore si è spostato. Decisioni: qualcosa è stato verificato, contestato, superato, risolto, fuso, promosso o rifiutato, e ogni decisione porta la sua evidenza. L'evento di bootstrap che abbiamo visto a `log:init`, `ExtractorVersionPromoted` per claims@v1, è anch'esso una decisione, con "initial version" come evidenza, ed è il motivo per cui la proiezione che stiamo per ricostruire è etichettata "v1 promossa". Il contratto fra livelli si verifica meccanicamente su questa tabella: ogni causazione di un evento Proposed deve puntare a un evento Verified del livello precedente. Il replay ricostruisce cosa si credeva a una data, perché, e chi l'ha deciso.

### Slide 19 — Proiezioni: fold, cancella, ricostruisci
**Punto.** La knowledge base è un fold sul log; si può cancellare e ricostruire identica, quindi non c'è migrazione.

**Diagramma.** A sinistra una colonna verticale alta con etichetta "log", fatta di righe numerate "1, 2, 3 … n". Dalla colonna tre frecce verso destra, ciascuna etichettata "fold", che terminano in tre riquadri impilati verticalmente: "CurrentBeliefs", "ConflictQueue", "Timeline". Una X rossa disegnata sui tre riquadri con la didascalia "cancellabili". Sotto, un secondo insieme di tre frecce etichettate "fold" dalla stessa colonna del log che rigenera gli stessi tre riquadri, disegnati identici, con la didascalia "ricostruiti identici".

**A schermo dopo il diagramma.** Terminale: `npm run log:cat`, `npm run projections:drop`, `npm run projections:build`; slide nascosta con `fallback/seg4/projections-rebuilt.txt`.

**Note per lo speaker.** Cinque proiezioni nel repository, tutte fold: CurrentBeliefs con chiave lineage e soggetto; ClaimsByDocumentVersion; ConflictQueue, le claim contested aperte; ReviewQueue, le proposte di classe B ordinate per attesa del catalogo; Timeline, stato per data per claim. `npm run log:cat` stampa l'intero log formattato, e seguo a voce una catena di causazione, da `DocumentVersionIngested` della versione 9 attraverso `StructureVerified`, la `ClaimProposed` per `ricavi.limite` 4.000.000, la `ClaimContested`, la `ClaimVerified` umana, fino alla `ClaimSuperseded` della claim v8 con il suo successore. Poi `npm run projections:drop`, le proiezioni sono sparite, e `npm run projections:build`, CurrentBeliefs è identica byte per byte. Nulla è stato migrato. È l'intera affermazione del "not a database to be migrated" dell'abstract, ed è un comando di una riga.

### Slide 20 — Riproiezione su cambio di estrattore: due proiezioni che convivono
**Punto.** Quando cambia l'estrattore e nessun documento cambia, il log viene rigiocato attraverso la nuova versione e la nuova proiezione convive con la vecchia finché non viene promossa; nulla viene sovrascritto.

**Diagramma.** La stessa colonna del log a sinistra. Due frecce verso destra, etichettate "replay con estrattore v1" e "replay con estrattore v2", che terminano in due riquadri affiancati: "Proiezione v1 (promossa)" e "Proiezione v2 (candidata)". Fra i due riquadri una freccia a doppia punta etichettata "harness: deriva". Nessuna freccia da nessuno dei due riquadri verso il log.

**A schermo dopo il diagramma.** Checkpoint, poi `npm run replay:claims-v2`, `npm run projections:diff`; slide nascosta con `fallback/seg4/projections-diff.txt`.

**Note per lo speaker.** Questo è il caso che un design "propaga al cambio di documento" non copre: nessun documento cambia, cambia un prompt o una versione di estrattore. Con una knowledge base mutabile l'unica opzione è rieseguire e sovrascrivere, cioè la migrazione che stiamo eliminando. Qui gli eventi `StructureVerified` vengono rigiocati attraverso claims@v2, che emette nuove `ClaimProposed` etichettate v2. Checkpoint prima di lanciarlo: passiamo al prompt v2 e rigiochiamo; quali righe del log vengono modificate? Esponetevi con una risposta. Nessuna. Vengono appesi eventi etichettati v2, undici, cinque per la versione 8 e sei per la versione 9; CurrentBeliefs non cambia finché v2 non è promossa da un `ExtractorVersionPromoted`, e le proposte di v1 restano nel log, attribuibili alla loro versione. `npm run replay:claims-v2`, guardate il tail, poi `npm run projections:diff`: v1 promossa e v2 candidata affiancate. L'harness decide fra le due nel segmento 5.

### Slide 21 — Query temporale: cosa diceva l'articolo il 30 aprile 2019
**Punto.** "Cosa diceva l'articolo alla data D" è una query in valid time sulla versione in vigore a D; il transaction time è la sequenza del log; entrambi sono conservati ed entrambi interrogabili.

**A schermo.** Terminale: `npm run beliefs:at-2019-04-30`, `npm run beliefs`; slide nascosta con `fallback/seg4/beliefs-at-2019-04-30.txt`.

**Note per lo speaker.** `npm run beliefs:at-2019-04-30`: `ricavi.limite` 2.000.000, verified, dalla versione 8, perché la versione 8 era il testo in vigore il 30 aprile 2019, il giorno in cui una tipica assemblea approvava il bilancio 2018. `npm run beliefs` senza data: 4.000.000 dalla versione 9. Questo è ragionamento bitemporale nel senso di Snodgrass: il valid time è la data di efficacia del documento, il transaction time è la sequenza del log, e i due restano distinti. La query per data è valid time; il transaction time, "cosa asseriva questo sistema alla sequenza n", esiste come `--seq` e oggi non mostrerebbe nulla di interessante, perché ogni evento di questo log è stato appeso questo pomeriggio. Una risposta data alla data D può essere riprodotta un anno dopo facendo il fold fino alla stessa sequenza, con le stesse versioni di estrattore e di golden set registrate negli eventi `EvalCompleted` ed `ExtractorVersionPromoted` dell'epoca; questo è il record di audit. Debrief del segmento: niente da migrare, si rigioca; e il tail sulla destra è rimasto append-only per tutto il segmento, e potete verificarlo scorrendolo.

---

## Segmento 5 — L'harness (16:09–16:21)

### Slide 22 — Golden set = una query sul log: quattro proprietà
**Punto.** Il golden set di un livello è l'insieme degli eventi di decisione umani di quel livello fino a una sequenza di cut-off, il che gli dà quattro proprietà che un insieme di valutazione costruito a mano non ha.

**Sulla slide.** Riga di definizione: *Golden set (livello, versione k) = tutti gli eventi di decisione del livello con attore human, fino alla sequenza s_k.* Poi quattro righe numerate:
1. Prodotto come effetto collaterale dell'operatività: ogni decisione umana è un esempio etichettato.
2. Per livello per costruzione: ogni evento di decisione appartiene a un livello.
3. Segue la distribuzione reale: cresce con il corpus.
4. Contiene i casi più difficili: le risoluzioni dei conflitti, che un etichettatore esterno non produce mai perché non ha mai visto il conflitto.

**Note per lo speaker.** Questa è l'idea distintiva del talk. Un insieme di valutazione convenzionale è costruito a parte, da etichettatori, statico, separato dall'operatività, testa il modello end-to-end e si allontana dalla distribuzione reale man mano che il corpus cambia. Qui il golden set è una query: tutti gli eventi di decisione con attore human del livello Claims fino alla sequenza 12.430, diciamo, è una definizione riproducibile; la stessa query sullo stesso log restituisce lo stesso insieme. Ne seguono quattro proprietà. È prodotto come effetto collaterale del lavoro. È per livello perché ogni evento ha un livello. Segue la distribuzione reale perché cresce con il corpus. E contiene le risoluzioni dei conflitti, che sono esattamente gli esempi che nessuno scrive a mano. Gli utenti, risolvendo conflitti per fare il loro lavoro, scrivono l'insieme di valutazione.

### Slide 23 — Esclusioni; offline e online (sonde)
**Punto.** Le claim verified da harness e da import e gli esempi del prompt sono esclusi per evitare circolarità, e lo stesso golden set serve alla promozione offline e al gate dei batch online.

**Sulla slide.** Due brevi blocchi. "Esclusioni: claim verified da harness e da import (derivate da decisioni umane già presenti); elementi usati come esempi nel prompt dell'estrattore (elencati nel manifest della versione), altrimenti le sonde misurano il recall del prompt." Poi una tabella a due righe:

| Modalità | Input | Decide | Innesco |
| --- | --- | --- | --- |
| Offline | intero golden set | promozione di una versione di estrattore | ogni cambio di estrattore o di prompt |
| Online (sonde) | un sottoinsieme inserito in ogni batch di produzione | il batch è segnale o rumore | ogni batch |

**A schermo dopo.** Terminale: `npm run golden:claims-until-seg2`, poi `npm run golden:claims`; slide nascosta con `fallback/seg5/golden-claims.txt`.

**Note per lo speaker.** Due esclusioni obbligatorie. Le claim verified da harness e da import non entrano nel golden set perché derivano da decisioni umane già presenti; includerle sarebbe circolare. Gli elementi usati come esempi nel prompt di un estrattore vengono sottratti alle sonde di quell'estrattore; altrimenti la sonda misura il recall del prompt, non dell'estrattore. Stesso insieme, due modalità: offline, l'intero insieme, per la promozione; online, un sottoinsieme inserito come sonde in ogni batch di produzione, per il gate. Ora la query sul log di oggi. `npm run golden:claims-until-seg2`, la sequenza dopo il segmento 2: quattro elementi, le verifiche umane sul comma 2 della versione 8. Lo stesso comando senza il cut-off: sette elementi, e i tre nuovi sono le risoluzioni dei tre conflitti che mi avete visto fare venti minuti fa. Questa è la proprietà 4 sul log di questa stessa sessione.

### Slide 24 — Allineamento, classificazione, conteggio
**Punto.** Le metriche si derivano in quattro passi meccanici su span semiaperti con una soglia di IoU, in micro-media su tutti gli elementi del golden set.

**Lista.**
1. Allineamento — per ogni elemento atteso, la proposta con la stessa chiave di soggetto canonica; se più d'una → IoU degli span più alto, le altre restano non allineate.
2. Classificazione — valore corretto se i valori normalizzati sono uguali; provenienza corretta se IoU ≥ θ (illustrativo 0,8); esito: corretto / valore errato / provenienza errata.
3. Conteggio — coppia corretta = VP; ogni altra coppia = un FP e un FN; atteso senza coppia = FN; proposta senza coppia = FP.
4. Metriche — precision = VP / (VP + FP), recall = VP / (VP + FN); conteggi sommati su tutti gli elementi prima di dividere (micro-media).

**Note per lo speaker.** Gli span sono intervalli semiaperti di caratteri e l'IoU è intersezione su unione in caratteri; θ è 0,8, illustrativo. Il passo uno allinea sulla chiave di soggetto canonica, ed è per questo che il catalogo conta: senza, non c'è nulla su cui allineare. Il passo due classifica ogni coppia allineata sul valore e sulla provenienza separatamente, così "posto giusto, numero sbagliato" è un esito distinto da "numero giusto, posto sbagliato". Il passo tre conta: una coppia non corretta costa un falso positivo e un falso negativo, perché la proposta è sbagliata e l'elemento atteso non è stato soddisfatto. Il passo quattro è in micro-media perché i commi hanno dimensioni diverse; una media per unità peserebbe un comma da due claim come uno da quaranta.

### Slide 25 — Eval v1: tabella e metriche
**Punto.** Sulle quattro claim attese del comma 2 della versione 8, claims@v1 ottiene VP 2, FP 2, FN 2: precision 0,50, recall 0,50.

**Tabella.**

| Atteso (chiave, valore, span) | Proposta v1 | IoU | Esito | Conteggi |
| --- | --- | --- | --- | --- |
| attivo.limite, 2.000.000 EUR, [280, 342) | attivo.limite, 2.000.000 EUR, [278, 342) | 62/64 = 0,97 | corretto | VP |
| ricavi.limite, 2.000.000 EUR, [347, 406) | ricavi.limite, 2.000.000 EUR, [347, 406) | 1,00 | corretto | VP |
| esercizi.consecutivi, 2, [216, 244) | esercizi.consecutivi, 3, [216, 244) | 1,00 | valore errato | FP + FN |
| dipendenti.limite, 10, [411, 469) | — | — | mancante | FN |
| — | capitale.soglia, "minimo s.p.a.", [0, 79) | — | inatteso (non in catalogo) | FP |

Sotto la tabella: *VP 2 · FP 2 · FN 2 · precision 2/4 = 0,50 · recall 2/4 = 0,50.* (Span locali al comma 2 per leggibilità, offset di base 720; il log contiene coordinate assolute, e `npm run eval:claims-v1` le stampa entrambe.)

**A schermo.** Terminale: `npm run eval:claims-v1`; slide nascosta con `fallback/seg5/eval-v1.txt`.

**Note per lo speaker.** `npm run eval:claims-v1` contro il golden set a quattro elementi. Coppia uno a voce: lunghezza attesa 62, lunghezza proposta 64 perché l'estrattore ha incluso l'"1) " prima della grandezza, intersezione 62, unione 64, IoU 0,97, sopra 0,8, valore uguale, corretto. Coppia due perfetta. Coppia tre: span perfetto, numero sbagliato, l'estrattore ha guardato nel posto giusto e ha letto "tre" dalla regola di cessazione invece di "due"; un FP e un FN. La soglia dei dipendenti non è mai stata proposta: FN. `capitale.soglia`, l'innesco sul capitale abrogato nel 2014, non è in questo testo e non è nel catalogo: FP. Sono esattamente le quattro proposte che avete visto nel segmento 2 e le due che ho aggiunto a mano. Totali VP 2, FP 2, FN 2; precision 0,50, recall 0,50. Notate cosa dice la tabella che un aggregato non dice: quali elementi, e se l'errore è nel valore o nella provenienza.

### Slide 26 — Deriva v1 → v2: matrice per elemento
**Punto.** La deriva si misura per elemento del golden set, mai confrontando percentuali aggregate, perché un miglioramento aggregato può nascondere una regressione esattamente sugli elementi che contano.

**Tabella.**

| Atteso | v1 | v2 | Cella |
| --- | --- | --- | --- |
| attivo.limite | corretto | corretto | stabile |
| ricavi.limite | corretto | valore errato (2.000 EUR) | **regressione** |
| esercizi.consecutivi | valore errato | corretto | miglioramento |
| dipendenti.limite | mancante | corretto | miglioramento |

Sotto la tabella: *Aggregati di v2: VP 3 · FN 1 · FP 2 · precision 0,60 · recall 0,75. Tracciati anche: rumore introdotto (proposte in v2 assenti in v1 — qui `cessazione.esercizi` 3, vera per l'articolo ma non per questa unità), deriva di provenienza (span spostato oltre θ).*

**A schermo.** Terminale: `npm run eval:claims-v2-summary`, checkpoint, poi `npm run drift:v1-v2`; slide nascoste con `fallback/seg5/eval-v2-summary.txt` e `fallback/seg5/drift-v1-v2.txt`.

**Note per lo speaker.** `npm run eval:claims-v2-summary` stampa solo gli aggregati: precision 0,60, recall 0,75, in salita di 0,10 e 0,25. Checkpoint: v2 è migliore su entrambi gli aggregati; supponiamo per un momento che entrambe le soglie siano rispettate: promuoviamo v2? Mi aspetto che la maggior parte della sala dica sì. La risposta è no, e il motivo è visibile solo per elemento. `npm run drift:v1-v2` mostra perché: v2 ha corretto gli esercizi consecutivi e trovato la soglia dei dipendenti, due miglioramenti, e ha letto la soglia dei ricavi come 2.000 euro, perdendo "milioni" nella normalizzazione, una regressione su un valore monetario, nel sottoinsieme critico. L'aggregato l'ha nascosta. La matrice ha quattro celle, stabile, regressione, miglioramento, stabilmente errato, più due liste, rumore introdotto e deriva di provenienza. La deriva non è mai una differenza di percentuali.

### Slide 27 — Criteri di promozione e gate dei batch
**Punto.** La promozione richiede tutti e quattro i criteri; il gate dei batch è basato su conteggi perché i tassi su tre-dieci sonde sono instabili.

**Lista.** Promozione (offline, intero golden set, tutti devono valere; soglie illustrative):
1. precision(v2) ≥ soglia del livello (0,90 per Claims);
2. recall(v2) ≥ recall(v1) − ε (ε = 0,02);
3. zero regressioni sul sottoinsieme critico (monetary, count, time-limit);
4. coppie con provenienza errata ≤ 2 % delle coppie con valore corretto.

Gate dei batch (sonde online, illustrativo): sonde ≈ 5 % delle unità con elementi attesi per un totale ≥ 10; passa se ≤ 1 FN e ≤ 1 FP sulle sonde e zero errori critici; fallisce → `BatchRejected`, tutte le proposte restano proposed. Sotto la dimensione minima del golden set il gate non è applicabile e il campionamento di audit della classe A è al 100 %.

**Note per lo speaker.** v2 fallisce il criterio 3, `ricavi.limite` è monetario, quindi nessun `ExtractorVersionPromoted` viene emesso; le sue proposte restano nel log etichettate v2, l'harness non le usa mai per le riconferme, e la proiezione v2 resta candidata. Fallisce anche il criterio 1, ma il criterio 3 è quello che un aggregato avrebbe nascosto. Il gate dei batch in una frase: alcuni elementi del golden set vengono inseriti in ogni batch di produzione; poiché campioni così piccoli rendono instabili i tassi, una sonda mancata su tre fa scendere il recall a 0,67, il criterio è in conteggi, al più un FN e un FP e zero errori critici; fallire significa `BatchRejected` e tutto resta proposed. La riga del gate che avete visto nel segmento 3 era il caso a freddo: sotto il minimo, il gate non gira e ogni riconferma di classe A viene campionata. Debrief: la deriva si misura per elemento, e il golden set l'hanno scritto gli utenti risolvendo conflitti.

---

## Segmento 6 — Output e consumo (16:21–16:27)

### Slide 28 — L'artefatto consumato dall'agente
**Punto.** L'agente esperto del dominio consuma la proiezione, mai i documenti grezzi, e ogni risposta può essere tracciata dalla credenza allo span alla versione del documento.

**Diagramma.** A sinistra un riquadro "Agente esperto del dominio". Freccia verso un riquadro "Proiezione (CurrentBeliefs · Policies · WorkflowSteps · ConflictQueue · versioni)". Da lì una freccia verso un riquadro "Credenza (id, attore, catena di evidenza, date)". Da lì una freccia verso "Span". Da lì una freccia verso "DocumentVersion". All'estrema destra un riquadro "documenti grezzi" barrato, senza alcuna freccia entrante dall'agente.

**Note per lo speaker.** L'output dei sei livelli non è un insieme di documenti ripuliti e non è un indice vettoriale. Per la lineage `cc-art2477` è: CurrentBeliefs, le claim verified non superseded per soggetto con attore, catena di evidenza e date; Policies, qui "nomina obbligatoria" con la sua condizione, il suo effetto e la sua eccezione che poggiano sulle soglie verified e la sua applicabilità dal 18 giugno 2019; WorkflowSteps per il caso d'uso "la nomina è obbligatoria per questa società a questa data"; la ConflictQueue, ciò che il sistema non può ancora asserire; e le versioni, golden set ed estrattori promossi, che l'hanno prodotto. È riproducibile, dati il log e le versioni, e datato, a qualunque sequenza. L'agente legge questo e mai i documenti. Il retrieval sul testo grezzo conserva un ruolo, per domande a testo libero e per scoprire soggetti candidati, ma solo come strumento che l'agente può usare per proporre una claim, mai come fonte da cui asserire.

### Slide 29 — Policy di consumo e una risposta che cita la credenza
**Punto.** Una policy di consumo, applicata alla radice della catena di evidenza, stabilisce su quali verifiche un agente può fare affidamento, e la risposta cita l'id di una credenza, non un documento.

**Sulla slide.** Una piccola tabella:

| Classe di domanda | Credenze utilizzabili |
| --- | --- |
| Grandezze monetarie e limiti temporali | solo verified con radice umana |
| Altre claim | verified da umano o da harness |
| Qualunque classe | mai proposed, mai contested |
| Domande sulla data D | la proiezione in vigore a D |

Poi una riga di risposta: *ricavi.limite, assemblea del 2019-04-30 → 2.000.000 EUR · credenza <id> · verificata da umano · span [1.067, 1.126) in cc-art2477-v8.txt.*

**A schermo.** Terminale: `npm run ask:ricavi-2019-04-30`, poi `npm run ask:ricavi`; slide nascosta con `fallback/seg6/ask.txt`.

**Note per lo speaker.** Una policy di consumo è per livello e per classe di soggetto, e si applica alla radice della catena, non all'ultimo attore: una riconferma di classe A dell'harness porta con sé la credenza verificata da umano che riconferma. `npm run ask:ricavi-2019-04-30`, la domanda con la data dell'assemblea: 2.000.000 euro, id della credenza, attore human, data, span nel documento della versione 8. La stessa domanda senza data: 4.000.000 con la credenza della versione 9, verificata dopo contestazione, successore di quella della versione 8. Quando la credenza rilevante è contested, la risposta lo dice e cita il conflitto; la ConflictQueue fa parte dell'artefatto perché l'agente possa riferire ciò che è indeciso invece di tirare a indovinare. Per una domanda eseguibile l'agente esegue il workflow verified, non un prompt. Prendiamo una società illustrativa con totale dell'attivo di 2,5 e 2,6 milioni, ricavi di 1,5 e 1,6 milioni, otto e nove dipendenti nel 2017 e nel 2018. Interrogato il 30 aprile 2019, la nomina è obbligatoria: l'attivo ha superato i due milioni in entrambi gli anni. Interrogato il 30 giugno 2019, non lo è: nessun limite del regime a quattro milioni è superato. Stessa società, due mesi di distanza, due risposte, ciascuna con gli id delle credenze e delle policy su cui poggia.

### Slide 30 — Checkpoint: cosa può usare l'agente
**Punto.** La sala applica la policy di consumo alla catena di evidenza, non all'ultimo attore.

**Sulla slide, solo questo testo.** "Policy: per grandezze monetarie e limiti temporali, solo credenze verified con radice umana. Dopo l'ingestione di oggi della versione 9, l'agente può rispondere su `assemblea.termine` (i trenta giorni)? Su `esercizi.consecutivi` (i due anni)?"

**Note per lo speaker.** Dopo che la sala si è esposta: `assemblea.termine`, no; è ancora proposed, classe B, in attesa di un umano, perché il comma 5 non è mai stato revisionato. `esercizi.consecutivi`, sì; è stata riconfermata dall'harness in classe A, e l'evidenza di quella riconferma è la verifica umana della versione 8, quindi la catena ha radice in una decisione umana e la policy è soddisfatta. Se la policy avesse detto "ultimo attore umano", la risposta sarebbe stata no, e la regola delle tre classi non avrebbe reso nulla; la policy si applica alla radice proprio perché la riconferma resti economica senza indebolire la regola che gli agenti non verificano mai. Debrief in tre parole: proiezione, non documenti.

---

## Chiusura (16:27–16:30)

### Slide 31 — Tre decisioni e cosa costano; QR handout e repository
**Punto.** Tre decisioni di design, ciascuna con il suo costo dichiarato.

**Tabella.**

| Decisione | Costo |
| --- | --- |
| Stato contested esplicito risolto da un umano, invece del merge | latenza fra ingestione e disponibilità; una coda di revisione da gestire |
| Il log è il sistema di riferimento; la knowledge base è una proiezione | lo storage cresce con gli eventi, non con i documenti; calcolo di riproiezione a ogni cambio di estrattore |
| Golden set per livello derivati dal log | congelamento e manutenzione per livello; un catalogo dei soggetti mantenuto a mano |

In basso a destra: segnaposto QR → handout di una pagina (elenco delle entità, catalogo degli eventi, tabella delle tre classi, versioni dell'art. 2477, link al repository). In basso a sinistra: segnaposto per l'URL del repository.

**Note per lo speaker.** Tre decisioni, e cosa costa ciascuna, perché l'approccio costa più del retrieval su ogni asse tranne la correttezza nel tempo. Primo, uno stato contested esplicito con risoluzione umana: il costo è latenza e una coda di revisione, ridotta ai delta dalle tre classi e dai prior, non eliminata. Secondo, il log come sistema di riferimento e la knowledge base come proiezione: lo storage cresce con gli eventi e ogni cambio di estrattore rigioca quel livello e i successivi; in cambio, nessuna migrazione, query temporali e deriva attribuibile. Terzo, golden set per livello derivati dal log: vanno congelati e versionati per livello e il catalogo dei soggetti va mantenuto a mano; in cambio, il guasto è localizzato e l'insieme di valutazione segue la distribuzione reale e contiene i conflitti. Quando l'insieme di documenti non ha supersessione, non ha conflitti e non ha obblighi di audit, il retrieval semplice è sufficiente e costa un ordine di grandezza in meno. Il QR vi dà l'handout e il repository, con le tre versioni ufficiali dell'art. 2477; `npm run dry-run` riproduce offline tutto ciò che avete visto. Domande.
