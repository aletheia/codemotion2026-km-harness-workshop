# Esempio conduttore — art. 2477 del Codice civile (tre versioni in vigore nel 2019)

Traduzione italiana di `00-running-example.md`; in caso di divergenza prevale l'inglese.

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revisione 4, 27 ott 2026 (sera). Questa scheda è l'unica fonte di verità per nomi, valori, span, date e numeri dell'esempio svolto; ogni altro file deve concordare con essa.

## 1. Perché questo documento

L'art. 2477 c.c. ("Sindaco e revisione legale dei conti") stabilisce quando una s.r.l. deve nominare l'organo di controllo o il revisore. Le sue soglie sono cambiate due volte in tre mesi del 2019: il Codice della crisi (D.Lgs. 14/2019, art. 379, in vigore dal 16 marzo 2019) ha sostituito il vecchio "due dei limiti dell'art. 2435-bis" con "almeno uno" fra totale attivo 2 milioni, ricavi 2 milioni, 10 dipendenti; la legge di conversione del decreto "sblocca cantieri" (L. 55/2019, art. 2-bis, in vigore dal 18 giugno 2019) li ha raddoppiati a 4 milioni, 4 milioni, 20 dipendenti. Il testo è pubblico (gli atti ufficiali dello Stato non sono protetti dal diritto d'autore, art. 5 L. 633/1941), ufficiale (Normattiva pubblica ogni versione con il suo periodo di vigenza), italiano, e rilevante per chiunque in sala gestisca o consigli una società. Ha tutte le proprietà che la spine richiede: conflitto (tre valori della stessa grandezza), supersessione con date di efficacia reali, ritrattazione, query temporali ("cosa diceva l'articolo il 30 aprile 2019?"), una regola con condizione, effetto ed eccezione (Policy) e una decisione eseguibile (Workflow: dati i bilanci di due esercizi, la nomina è obbligatoria?).

## 2. Fonte e versioni

Fonte: Normattiva, R.D. 16 marzo 1942, n. 262 (atto 042U0262), art. 2477, versioni dell'articolo 7, 8 e 9 come servite da `/atto/caricaArticolo?…&art.idArticolo=2477&art.versione=N`. Recuperate il 27 ott 2026. Le fixture riproducono il testo consolidato senza i marcatori di modifica `((…))` di Normattiva; la riga "COMMA ABROGATO DAL D.L. 24 GIUGNO 2014, N. 91 …" è mantenuta perché il testo consolidato la riporta e perché spiega la numerazione dei commi (sezione 7).

| File | Versione Normattiva | In vigore | Atto modificativo | Caratteri | Cosa cambia |
| --- | --- | --- | --- | --- | --- |
| `cc-art2477-v7.txt` | 7 | 21 ago 2014 – 15 mar 2019 | D.L. 91/2014, art. 20 c. 8, conv. L. 116/2014 | 1.697 | lett. c): "per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis"; cessazione dopo due esercizi; nessun comma sull'art. 2409 |
| `cc-art2477-v8.txt` | 8 | 16 mar 2019 – 17 giu 2019 | D.Lgs. 14/2019, art. 379 | 1.991 | lett. c): "almeno uno dei seguenti limiti": attivo 2 milioni, ricavi 2 milioni, 10 unità; cessazione dopo tre esercizi; il conservatore del registro può segnalare al tribunale; si applica l'art. 2409 |
| `cc-art2477-v9.txt` | 9 | dal 18 giu 2019 | D.L. 32/2019, art. 2-bis, conv. L. 55/2019 | 2.012 | 4 milioni, 4 milioni, 20 unità; rinvii corretti da "terzo comma" a "secondo comma" |

Entrata in vigore confermata nella scheda della Gazzetta Ufficiale del D.Lgs. 14/2019 (art. 379 elencato fra gli articoli in vigore dal 16/03/2019) e nel testo della L. 55/2019 (art. 1 c. 3, in vigore il giorno successivo alla pubblicazione in GU n. 140 del 17 giugno 2019).

Lineage: `cc-art2477`. Walkthrough live: v8 è ingerita nel segmento 2, v9 nel segmento 3. v7 è usata solo nella baseline di retrieval del segmento 1 (tre passaggi in conflitto) e resta nelle fixture per il lettore (la sua lett. c) è una claim per rinvio a un altro articolo, che il catalogo segnala come novità inattesa — un buon esercizio, non mostrato).

## 3. Struttura (livello 2)

Ogni file: cinque righe di intestazione (documento, sezione, titolo dell'articolo, vigenza, fonte), poi un paragrafo per comma. I percorsi delle sezioni seguono la numerazione del testo oggi in vigore (v9 dice "secondo comma" per il comma con le soglie); il comma abrogato è un nodo di tipo `note` e non diventa mai un'unità di estrazione.

| Percorso | Tipo | Intervallo v8 | Intervallo v9 | Contenuto |
| --- | --- | --- | --- | --- |
| header | index | [0, 328) | [0, 345) | documento, sezione, titolo, vigenza, fonte |
| c1 | comma | [330, 606) | [347, 623) | l'atto costitutivo può prevedere un organo di controllo o un revisore |
| abrogato | note | [608, 718) | [625, 735) | "COMMA ABROGATO DAL D.L. 24 GIUGNO 2014 …" |
| c2 | comma | [720, 1190) | [737, 1207) | nomina obbligatoria: a), b), c) con i tre limiti |
| c3 | comma | [1192, 1377) | [1209, 1396) | cessazione dopo tre esercizi consecutivi |
| c4 | comma | [1379, 1531) | [1398, 1550) | si applicano le disposizioni sul collegio sindacale delle s.p.a. |
| c5 | comma | [1533, 1889) | [1552, 1910) | l'assemblea nomina entro trenta giorni; altrimenti il tribunale |
| c6 | comma | [1891, 1990) | [1912, 2011) | si applica l'art. 2409 |

(Gli intervalli sono offset in caratteri, semiaperti, da `manifest.json`; l'intervallo dell'intestazione copre le cinque righe fino alla riga vuota; i paragrafi sono separati da una riga vuota, quindi ogni nodo inizia due caratteri dopo la fine del precedente.) Gli alberi v8 e v9 hanno gli stessi percorsi e tipi e differiscono solo negli offset; l'harness riconferma l'albero v9 come classe A rispetto all'albero v8 verificato da umano (l'uguaglianza degli alberi è per percorso e tipo; gli intervalli si confrontano per nodo solo all'interno della stessa versione).

Nota dal mondo reale per il segmento Structure: v8 dice "lettera c) del terzo comma" perché il redattore ha contato il comma abrogato; v9 lo ha corretto in "secondo comma". L'albero adotta la lettura di v9; il nodo note rende visibile la discrepanza invece di nasconderla.

## 4. Catalogo dei soggetti (livello Claims)

| Chiave di soggetto | Grandezza | Classe | Tipo normalizzato | Sinonimi |
| --- | --- | --- | --- | --- |
| `attivo.limite` | soglia sul totale dell'attivo | monetary (critica) | money EUR | "totale dell'attivo", "attivo dello stato patrimoniale" |
| `ricavi.limite` | soglia sui ricavi | monetary (critica) | money EUR | "ricavi delle vendite e delle prestazioni", "ricavi" |
| `dipendenti.limite` | soglia sui dipendenti medi | count (critica) | integer (count) | "dipendenti occupati in media", "unità" |
| `esercizi.consecutivi` | esercizi per cui la soglia deve essere superata | time-limit (critica) | integer (anni) | "esercizi consecutivi" |
| `cessazione.esercizi` | esercizi senza superamento dopo i quali l'obbligo cessa | time-limit (critica) | integer (anni) | "cessa quando, per … esercizi" |
| `assemblea.termine` | giorni entro cui l'assemblea deve nominare | time-limit (critica) | integer (giorni) | "entro trenta giorni" |
| `limiti.riferimento` | limiti definiti per rinvio a un altro articolo | reference | reference (lineage id) | "limiti indicati dal … articolo 2435-bis" (solo v7) |

Sottoinsieme critico (handbook §6.4, criterio 3): le classi **monetary** (`attivo.limite`, `ricavi.limite`), **count** (`dipendenti.limite`) e **time-limit** (`esercizi.consecutivi`, `cessazione.esercizi`, `assemblea.termine`); in questo dominio non esiste una classe "exclusion". `limiti.riferimento` non è critica.

Fuori catalogo (novità inattesa se proposta): `capitale.soglia` (il presupposto del capitale, anteriore al 2014), qualsiasi cosa riguardi il bilancio consolidato o il controllo di società soggette a revisione (le lett. a e b sono condizioni della policy, non grandezze). Una proposta inattesa va nella coda umana con priorità alta ed è mostrata come tale dalla CLI di revisione; per l'eval è una proposta non appaiata, un FP.

## 5. Claim attese (golden item dopo la revisione umana)

Gli span sono intervalli assoluti in caratteri; locale alla sezione = assoluto − offset base dell'unità (base di c2: v8 720, v9 737).

| Versione | Chiave di soggetto | Valore normalizzato | Span assoluto | Locale a c2 | Testo |
| --- | --- | --- | --- | --- | --- |
| v8 | `esercizi.consecutivi` | 2 | [936, 964) | [216, 244) | `per due esercizi consecutivi` |
| v8 | `attivo.limite` | 2.000.000 EUR | [1000, 1062) | [280, 342) | `totale dell'attivo dello stato patrimoniale: 2 milioni di euro` |
| v8 | `ricavi.limite` | 2.000.000 EUR | [1067, 1126) | [347, 406) | `ricavi delle vendite e delle prestazioni: 2 milioni di euro` |
| v8 | `dipendenti.limite` | 10 | [1131, 1189) | [411, 469) | `dipendenti occupati in media durante l'esercizio: 10 unità` |
| v9 | `esercizi.consecutivi` | 2 | [953, 981) | [216, 244) | `per due esercizi consecutivi` |
| v9 | `attivo.limite` | 4.000.000 EUR | [1017, 1079) | [280, 342) | `… 4 milioni di euro` |
| v9 | `ricavi.limite` | 4.000.000 EUR | [1084, 1143) | [347, 406) | `… 4 milioni di euro` |
| v9 | `dipendenti.limite` | 20 | [1148, 1206) | [411, 469) | `… 20 unità` |
| v9 | `cessazione.esercizi` | 3 | [1324, 1352) | c3 | `per tre esercizi consecutivi` |
| v9 | `assemblea.termine` | 30 giorni | [1664, 1683) | c5 | `entro trenta giorni` |

Golden item del segmento 2 (livello Claims): input = sezione c2 di v8 `StructureVerified`; attesi = le quattro righe v8 sopra. "Almeno uno dei seguenti limiti" non è una Claim: è il combinatore della Policy (sezione 9).

Golden set dopo il segmento 3 (senza cut-off): due golden item — c2 di v8 con quattro elementi attesi, c2 di v9 con tre elementi attesi (le risoluzioni umane dei conflitti su attivo, ricavi e dipendenti); `esercizi.consecutivi` di v9 è verificata dall'harness e quindi esclusa. `npm run golden:claims` stampa "2 items, 7 expected"; il walkthrough dice "sette elementi attesi su due sezioni".

## 6. Fixture degli estrattori e numeri dell'esempio svolto (handbook §6.2–6.4 — i conteggi non cambiano)

claims@v1 su c2 di v8 propone quattro claim:

| Proposta | Valore | Span (locale a c2) | Rispetto all'atteso | Esito |
| --- | --- | --- | --- | --- |
| `attivo.limite` | 2.000.000 EUR | [278, 342) — include "1) " | [280, 342) | corretta; IoU 62/64 = 0,97 |
| `ricavi.limite` | 2.000.000 EUR | [347, 406) | [347, 406) | corretta; IoU 1,00 |
| `esercizi.consecutivi` | **3** | [216, 244) | valore 2 | valore errato, span giusto: il modello ha confuso la regola di cessazione ("tre esercizi") con il presupposto ("due esercizi") |
| `capitale.soglia` | "minimo s.p.a." (enum) | [0, 79) | — | inattesa: il modello ha riprodotto il presupposto del capitale abrogato nel 2014, ancorandolo alla frase di apertura; il catalogo non risolve il soggetto |
| `dipendenti.limite` | — | — | atteso 10 | mancante |

Conteggi: VP 2, FP 2, FN 2; precision 0,50, recall 0,50. Revisione umana (segmento 2): verifica attivo e ricavi; lascia `esercizi.consecutivi 3` e `capitale.soglia` proposed; aggiunge a mano `esercizi.consecutivi 2` e `dipendenti.limite 10` (`ClaimProposed(actor=human)`, poi `ClaimVerified`). Golden set: quattro elementi.

claims@v2 sulla stessa unità: attivo corretta (span [280, 342), IoU 1,00); esercizi 2 corretta; dipendenti 10 corretta; **`ricavi.limite` = 2.000 EUR** (valore errato: "milioni" perso nella normalizzazione — monetary, sottoinsieme critico); `cessazione.esercizi 3` inattesa, ancorata a [216, 244) (un'affermazione vera dell'articolo, ma non in questa unità e non in questo item). Conteggi: VP 3, FP 2, FN 1; precision 0,60, recall 0,75. Matrice di deriva per elemento: attivo stabile; ricavi **regressione**; esercizi miglioramento; dipendenti miglioramento. Promozione rifiutata: criterio 3 (regressione su un elemento critico) e criterio 1 (0,60 < 0,90 illustrativo). La fixture di v2 su v9 produce sei proposte corrette (non valutate; nel replay compaiono undici righe v2: cinque per v8, sei per v9). `npm run projections:diff` confronta la proiezione candidata di claims@v2 con quella promossa di claims@v1 per versione di documento, così la regressione sui ricavi (2.000 EUR contro 2.000.000 EUR) è visibile nella riga v8 anche se le credenze v8 sono superseded in CurrentBeliefs.

claims@v1 su v9 (segmento 3; unità c2, c3, c5) propone sei claim corrette — la fixture è scelta perché sia il comparatore, non l'estrattore, a essere in scena:

| Proposta | Valore | Credenza in CurrentBeliefs | Classe |
| --- | --- | --- | --- |
| `esercizi.consecutivi` | 2 | 2 (human, v8) | **A** riconferma |
| `attivo.limite` | 4.000.000 EUR | 2.000.000 (human, v8) | **C** conflitto |
| `ricavi.limite` | 4.000.000 EUR | 2.000.000 (human, v8) | **C** conflitto |
| `dipendenti.limite` | 20 | 10 (human, v8) | **C** conflitto |
| `cessazione.esercizi` | 3 | nessuna (c3 non estratto nel segmento 2) | **B** novità |
| `assemblea.termine` | 30 giorni | nessuna (c5 non estratto nel segmento 2) | **B** novità |

Revisione del segmento 3: il revisore verifica le tre claim v9 e dichiara superseded le tre claim v8 con i rispettivi successori v9 (tre decisioni, una schermata). Le due claim di classe B restano proposed.

Structure nel segmento 3: `StructureVerified(actor=harness)` classe A — stessi percorsi e tipi dell'albero v8 verificato (fra versioni, l'uguaglianza degli alberi è per percorso e tipo; gli intervalli dei nodi si confrontano solo nella stessa versione, perché gli offset differiscono per costruzione). L'esenzione a freddo vale anche per Structure (il suo golden set contiene un solo elemento). `npm run compare` sulle sei claim emette una `ClaimVerified(actor=harness)` (esercizi, con la supersessione della claim v8 come catena di riconferma), tre `ClaimContested` e lascia due proposte in coda. Regola a freddo (run sheet rev. 4): il gate dei batch non è applicabile (golden set 4 < 10), la classe A è decisa dal comparatore, campionamento di audit 100 %; `npm run compare` stampa la riga.

## 7. Date, query e risposte

| Query | Semantica temporale | Risposta | Credenza citata |
| --- | --- | --- | --- |
| "Soglia dei ricavi per la nomina obbligatoria, assemblea del 30 aprile 2019 che approva il bilancio 2018" | valid time, `--at 2019-04-30` | 2.000.000 EUR | v8 `ricavi.limite`, verificata da umano, span [1067, 1126) in `cc-art2477-v8.txt` |
| stessa domanda, oggi | valid time, ora | 4.000.000 EUR | v9 `ricavi.limite`, verificata da umano dopo contestazione, successore della credenza v8 |
| "Quanti esercizi consecutivi?" | ora | 2 | v9 `esercizi.consecutivi`, riconferma di classe A dell'harness radicata nella verifica umana di v8 |
| "Entro quanti giorni deve provvedere l'assemblea?" | ora | non rispondibile sotto la policy monetary/time-limit: la credenza è proposed (classe B) | `assemblea.termine`, proposed |

Domanda della baseline del segmento 1: "L'assemblea del 30 aprile 2019 approva il bilancio 2018. Quale soglia di ricavi si applica, e su quale evidenza presente nel chunk?" — l'indice contiene v7, v8 e v9; la query "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo" restituisce tre passaggi con punteggi comparabili ("due dei limiti … 2435-bis", "2 milioni di euro", "4 milioni di euro"); nessun campo dice quale fosse in vigore.

Le query in transaction time (`--seq <n>`) esistono ma sul palco non mostrano nulla: ogni evento è appeso il 28 ott 2026.

## 8. Checkpoint

| Seg. | Domanda | Risposta corretta |
| --- | --- | --- |
| 1 | Assemblea del 30 aprile 2019, bilancio 2018: quale soglia di ricavi, su quale evidenza nel chunk? | Nessuna nel chunk; versione e vigenza sono state scartate al chunking. |
| 2 | `ricavi.limite 2.000.000` è verified; un'estrazione successiva propone 4.000.000 sullo stesso soggetto. Stato di ciascuna claim dopo l'evento, e chi può emetterlo? | 2.000.000 resta verified; 4.000.000 nasce proposed e diventa contested per mano dell'harness; la risoluzione è solo umana. |
| 3 | Sei proposte sullo schermo: classificate ciascuna in A, B o C prima che il comparatore giri. | A: esercizi 2 · C: attivo 4 M, ricavi 4 M, dipendenti 20 · B: cessazione 3, termine 30 giorni. |
| 4 | Passiamo al prompt v2 e rigiochiamo: quali righe del log vengono modificate? | Nessuna; le `ClaimProposed` v2 vengono appese; CurrentBeliefs invariata fino alla promozione. |
| 5 | v2 è migliore su entrambi gli aggregati; supponiamo le soglie rispettate: promuovere? | No: la deriva per elemento mostra una regressione su `ricavi.limite`, monetary, critica. |
| 6 | Policy: grandezze monetary e time-limit solo da credenze con radice umana. L'agente può rispondere su `assemblea.termine` e su `esercizi.consecutivi`? | termine: no (proposed, classe B). esercizi: sì (riconferma dell'harness la cui evidenza è la verifica umana di v8; la policy si applica alla radice della catena). |

## 9. Livelli 4–6 (estratto precomputato, `layers-4-6`)

Entità: `organo-di-controllo`, `revisore`, `societa-srl`, `assemblea`, `tribunale`, `registro-imprese` (id di catalogo); menzioni risolte dal testo del soggetto delle claim verificate. Due Policy, una per regime, perché una Policy fa riferimento a claim verificate e porta un periodo di applicabilità: `nomina-obbligatoria@v8` (16 mar 2019 – 17 giu 2019, riferita alle claim v8, superseded dalla successiva) e `nomina-obbligatoria@v9` (dal 18 giu 2019, riferita alle claim v9). Ciascuna: condizione = per `esercizi.consecutivi` esercizi consecutivi è superato almeno uno fra `attivo.limite`, `ricavi.limite`, `dipendenti.limite`; effetto = la nomina dell'organo di controllo o del revisore è obbligatoria; eccezione = l'obbligo cessa dopo `cessazione.esercizi` esercizi consecutivi senza superamento di alcun limite (comma 3). Workflow `obbligo-nomina` (caso d'uso: "la nomina è obbligatoria per questa s.r.l. alla data di questa assemblea?"): passo 1 risolvere policy e soglie in vigore alla data (valid time); passo 2 confrontare gli ultimi due bilanci con ciascuna soglia; passo 3 applicare il combinatore (almeno uno, entrambi gli esercizi); passo 4 applicare l'eccezione; output: obbligo sì/no con l'elenco degli id di credenze e policy. Input di test del golden item (società illustrativa): attivo 2,5 M / 2,6 M, ricavi 1,5 M / 1,6 M, dipendenti 8 / 9 per 2017 / 2018 → al 30 apr 2019: obbligatoria (attivo > 2 M in entrambi gli esercizi); al 30 giu 2019: non obbligatoria (nessun limite del regime v9 superato). La stessa società, a due mesi di distanza, due risposte: è l'esempio di chiusura del segmento 6.

## 10. Prior (handbook §3.6) in questo dominio

Import da un sistema di riferimento: `fixtures/documents/compliance-register.csv`, le soglie che un'impresa applica oggi (illustrativo: i valori v9), che entrano come `ClaimVerified(actor=import)`. Edizione di riferimento: v9 rivista integralmente una volta. Catalogo dei soggetti: sezione 4. Non usati live; presenti per la discussione sull'avvio a freddo e per i test.

## 11. Nomi usati ovunque

| Elemento | Nome |
| --- | --- |
| Lineage | `cc-art2477` |
| Versioni del documento | v7 (21 ago 2014, solo baseline), v8 (16 mar 2019), v9 (18 giu 2019) |
| Unità di estrazione mostrata live | comma 2 (`c2`), offset base 720 (v8) / 737 (v9) |
| Conflitto usato nei checkpoint 2, 4, 5, 6 | `ricavi.limite` 2.000.000 → 4.000.000 EUR |
| Classe A nel segmento 3 | `esercizi.consecutivi` 2 |
| Classe C nel segmento 3 | `attivo.limite`, `ricavi.limite`, `dipendenti.limite` |
| Classe B nel segmento 3 | `cessazione.esercizi` 3, `assemblea.termine` 30 giorni |
| Valore errato di v1 | `esercizi.consecutivi` 3 |
| Proposta inattesa di v1 | `capitale.soglia` (presupposto abrogato) |
| Mancante in v1 | `dipendenti.limite` 10 |
| Regressione di v2 | `ricavi.limite` 2.000 EUR |
| IoU detta a voce | 62/64 = 0,97 |
| Query temporale | "assemblea del 30 aprile 2019, bilancio 2018" / `--at 2019-04-30` |
| Query di retrieval | "soglia dei ricavi per la nomina obbligatoria dell'organo di controllo" |
| Prior (illustrativo, non live) | `compliance-register.csv` |
| Script npm | `rag:index`, `rag:query`, `rag:delete-v8`, `rag:extract-c2`, `log:init`, `log:reset`, `ingest:v8`, `ingest:v9`, `extract:structure-v8`, `extract:claims-v8`, `extract:v9`, `show:ricavi-v8`, `review`, `review:auto`, `compare`, `layers-4-6`, `log:cat`, `projections:drop`, `projections:build`, `replay:claims-v2`, `projections:diff`, `beliefs:at-2019-04-30`, `beliefs`, `golden:claims-until-seg2`, `golden:claims`, `eval:claims-v1`, `eval:claims-v2-summary`, `drift:v1-v2`, `ask:ricavi-2019-04-30`, `ask:ricavi`, `dry-run`, `tail`, `test` |
| File di fallback | `fallback/seg1/rag-query.txt`, `rag-after-delete.txt`, `rag-extract.txt`; `seg2/log-after-extract.txt`, `log-after-verify.txt`; `seg3/log-after-extract-v9.txt`, `log-after-compare.txt`, `layers-4-6.txt`; `seg4/log-cat.txt`, `projections-rebuilt.txt`, `projections-diff.txt`, `beliefs-at-2019-04-30.txt`; `seg5/golden-claims.txt`, `eval-v1.txt`, `eval-v2-summary.txt`, `drift-v1-v2.txt`; `seg6/ask.txt` |
| Sottoinsieme critico | monetary, count, time-limit |
