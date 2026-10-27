# Script del walkthrough live — "Documents Are Not Knowledge"

Traduzione italiana di `03-walkthrough-script.md`; in caso di divergenza prevale l'inglese.

Codemotion Milan 2026 · mer 28 ott 2026, 15:20–16:40 CET · Luca Bianchi
Documento di accompagnamento a `01-run-sheet.md` (orari, intervalli di slide), `00-running-example.md` (l'esempio: valori, span, fixture, checkpoint) e `AGENTS.md` §11 (script npm, file di fallback). Inglese, revisione 4, 27 ott 2026.

Tutti gli id di evento (`ev-0007`), gli id di claim (`clm-ricavi2m`), gli id di batch, gli hash, i model id e le soglie dell'harness in questo script sono **illustrativi**. Gli offset sono quelli reali dei file di fixture (`fixtures/documents/manifest.json`). Il repository stampa i propri id deterministici; ciò che deve coincidere sono le forme e i conteggi.

Formato delle righe del tail (da `npm run tail`): `seq · type · actor.kind(actor.id) · layer · aggregateId · ← causationId`, eventi di decisione preceduti da `★` con l'evidenza riassunta in ≤ 60 caratteri.

---

## Prima delle 15:20 (in sala entro le 15:05)

- Laptop alimentato dalla rete, schermo duplicato a 1920×1080, adattatore HDMI collegato; notifiche disattivate; font del terminale ≥ 18 pt, tema chiaro.
- Disposizione delle finestre: **due terzi a sinistra** = slide (vista relatore solo sullo schermo del laptop) oppure Terminale A; **terzo a destra** = Terminale B con `npm run tail` avviato dalle 15:15 su una directory di log nuova (`out/` vuota). Il Terminale A è nella radice del repository con `fallback/` aperto in una seconda scheda (lì `cd fallback`), così che qualsiasi `cat fallback/segN/<file>` sia a un cambio di scheda di distanza.
- `npm run dry-run` eseguito una volta alle 15:05 da una `out/` pulita: deve stampare `dry-run: OK (byte-identical with fallback/)`. Se non è verde, si esegue l'intera sessione da `fallback/` con `cat` e lo si dice una volta all'inizio ("oggi il repository è riprodotto dagli snapshot; i comandi sono quelli sulle slide").
- Dopo il dry-run, `npm run log:init` **non** va rieseguito fino alle 15:36: `out/events.jsonl` va cancellato (`npm run log:reset`, oppure `rm out/events.jsonl`) così che la sala veda `LogInitialised` come seq 1 dal vivo. Riavviare `npm run tail` dopo il reset.
- L'indice della baseline di retrieval (`src/rag-baseline/`, vettori precomputati) è costruito da `npm run rag:index` prima delle 15:20; contiene le tre versioni v7, v8, v9.
- Slide: slide nascosta con screenshot dopo ogni slide live (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23, 24–27, 29), così che il fallback possa essere mostrato anche senza toccare il terminale.
- Acqua, telecomando, timer visibile sul laptop; QR dell'handout provato su un telefono.

---

## Segmento 1 — Tre guasti live di chunk → embed → retrieve (15:20–15:32, slide 1–5)

**A schermo prima del passo.** Slide 1 (diagramma della pipeline con le tre perdite), poi slide 2 (la tabella del dominio: art. 2477 c.c., v7 / v8 / v9 con i periodi di vigenza e le soglie). Il Terminale B è visibile a destra ed è **vuoto**: il log non è ancora stato inizializzato. Dirlo una volta: "Il terzo di destra dello schermo è il sistema di registrazione; è vuoto perché non è ancora successo niente."

### 15:22 — `npm run rag:query` (slide 3)

Output atteso (Terminale A):

```
rag-query  index=cc-art2477  chunks=23  top_k=3  q="soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"
score  chunk                      text (trimmed)
0.244  cc-art2477-v8 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 2 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 2 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 10 unità.
0.242  cc-art2477-v9 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 4 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 4 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 20 unità.
0.205  cc-art2477-v7 #3           … c) per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis.
fields available per chunk: id, source_file, text, vector
```

Dire: "Tre passaggi, punteggi comparabili, tre regole diverse: per rinvio a un altro articolo, due milioni, quattro milioni. Guardate l'ultima riga: i campi di cui dispone il retriever. Non c'è versione, non c'è periodo di vigenza, non c'è asserzione. Il generatore a valle può scegliere per posizione, mescolare, o riportarli tutti e tre. Nessuna di queste è una risposta."

**Checkpoint (15:25, slide 3, 2 min).** Domanda testuale: *"L'assemblea dei soci del 30 aprile 2019 approva il bilancio 2018. Quale soglia di ricavi si applica, e su quale evidenza presente nel chunk?"*
Risposte attese dalla sala: "due milioni, perché è il file v8" (il nome del file non è tra i campi del chunk che il generatore vede, e anche se lo fosse, un nome di file non è un periodo di vigenza); "quattro milioni, perché è il più recente" (la recenza dell'ingestione non è vigenza; il 30 aprile 2019 il testo dei quattro milioni non esisteva ancora); "filtriamo sui metadati" (il filtro deve sapere quale versione era in vigore a quella data, che è esattamente ciò che volevamo sapesse il sistema).
Ragionamento corretto: nessuna evidenza è presente. Il chunk porta testo e un vettore; le informazioni necessarie per decidere — la versione a cui il testo appartiene, la data da cui e fino a cui era in vigore, l'asserzione che fa — sono state scartate al momento del chunking e nessun passo successivo può recuperarle. È il buco che il segmento 2 riempie con Span e DocumentVersion.

### 15:27 — `npm run rag:delete-v8` poi `npm run rag:query` (slide 4)

```
rag-delete  version=v8  removed=8 chunks  index=cc-art2477 (15 chunks left)
rag-query  index=cc-art2477  chunks=15  top_k=3  q="soglia dei ricavi per la nomina obbligatoria dell'organo di controllo"
score  chunk                      text (trimmed)
0.244  cc-art2477-v9 #3           … c) ha superato per due esercizi consecutivi almeno uno dei seguenti limiti: 1) totale dell'attivo dello stato patrimoniale: 4 milioni di euro; 2) ricavi delle vendite e delle prestazioni: 4 milioni di euro; 3) dipendenti occupati in media durante l'esercizio: 20 unità.
0.208  cc-art2477-v7 #3           … c) per due esercizi consecutivi ha superato due dei limiti indicati dal primo comma dell'articolo 2435-bis.
0.141  cc-art2477-v7 #5           Nel caso di nomina di un organo di controllo, anche monocratico, si applicano le disposizioni sul collegio sindacale previste per le società per azion …
```

Dire come affermazione: "L'unica operazione che l'indice offre per ritirare il testo di marzo è la cancellazione. La domanda sul 30 aprile 2019 non ha più risposta: il testo in vigore a quella data è sparito, e i due che restano sono sbagliati per quella data. L'indice non ha uno stato per 'non più corrente ma vero per il suo periodo', perché non ha né asserzioni né tempo."

### 15:29 — `npm run rag:extract-c2` (slide 5)

```
rag-extract  unit=v8/c2  extractor=one-shot  model=claude-<version> (illustrative)
{
  "soglie": { "attivo": 2000000, "ricavi": 2000000, "dipendenti": 10 },
  "esercizi_consecutivi": 3,
  "regola": "due dei tre limiti"
}
```

Chiedere alla sala dove sia l'errore (il comma dice due esercizi consecutivi, non tre; dice "almeno uno" dei limiti, non "due dei tre" — quella è la regola in vigore fino a marzo, che il modello conosce dall'addestramento e non dal testo). Poi: "Il confine del comma era sbagliato, il valore è stato letto male, o un valore corretto è stato attaccato alla regola sbagliata? Un passo opaco, un artefatto; l'output non lo può dire. Non c'è un posto dove affermare 'la struttura era giusta, le claim erano sbagliate', quindi non c'è niente da misurare per livello."

**Debrief (15:31).** Tre perdite: identità, provenienza, tempo. Le entità del segmento 2 sono le tre perdite trasformate in oggetti.

**Fallback.** `fallback/seg1/rag-query.txt`, `rag-after-delete.txt`, `rag-extract.txt` contengono i tre output qui sopra alla lettera. Frase mentre si passa al fallback: "Lo snapshot è ciò che il comando ha stampato stamattina; il punto sta nei campi, non nell'esecuzione."

**Tempi.** Ogni comando < 5 s. Se si sfora: saltare l'esecuzione di `rag-delete` e mostrare la sua slide con lo screenshot (risparmia 1 min).

---

## Segmento 2 — Entità, aggregato, ciclo di vita; estrazione del comma 2 di v8 (15:32–15:45, slide 6–11)

**A schermo prima del passo.** Slide 6–8 (tabella delle entità; diagramma dell'aggregato Claim; concetti di domain design). Terminale B ancora vuoto.

### 15:36 — `npm run log:init` (slide 7)

Terminale A:

```
log-init  out/events.jsonl created  (append-only; duplicate eventId → ignored)
```

Terminale B (tail):

```
0001 · LogInitialised            · process(log-init)   · source    · log           ·
0002 ★ ExtractorVersionPromoted  · human(luca)         · harness   · claims@v1     ·            evidence: initial version, no predecessor
```

Dire: "La seq 2 è una decisione: claims@v1 è l'estrattore promosso per il livello Claims. È nel log perché nel segmento 4 esisterà una seconda versione e 'promosso' deve essere qualcosa che il log dice, non una supposizione."

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

### `npm run review` (prima chiamata: l'albero della struttura)

La CLI del revisore mostra gli otto nodi con gli intervalli e chiede `verify? [y/n]`. Rispondere `y`, nota `"abrogated comma kept as note; paths follow the v9 numbering"`.

Dire mentre è a schermo: "Un nodo è una nota, non un comma: il comma abrogato nel 2014. Il testo di marzo dice ancora 'lettera c) del terzo comma' perché chi lo ha scritto lo contava; il testo di giugno lo ha corretto in 'secondo comma'. L'albero adotta la lettura di giugno e tiene la nota visibile. È una decisione di struttura, registrata da un umano, e niente a valle può girare finché questo evento non esiste."

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

Non commentare ancora il contenuto; la sala lo vedrà al passo di revisione.

### `npm run show:ricavi-v8`

(`--event last` stamperebbe la proposta `capitale.soglia`. Usare quella di `ricavi.limite`, che è lo span usato dalle slide.)

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

Percorrere i campi dall'alto in basso in 40 secondi: identità (eventId deterministico da produttore, input, versione dell'estrattore → idempotente), classificazione, attore con model e prompt version, causazione = la `StructureVerified` da cui proviene l'unità, payload con lo Span in coordinate **assolute** del documento (l'estrattore ha restituito `[347,406)` locale al comma; il contesto Claims ha aggiunto il base offset 720). Nessun campo `evidence`: questo è un evento di fatto, la famiglia "fact" del catalogo degli eventi, non una claim verificata.

**Talk (15:39, slide 9–10):** macchina a stati; chi può emettere cosa; contested invece del merge.

**Checkpoint (15:41, slide 11, 2 min).** Domanda testuale: *"`ricavi.limite` 2.000.000 EUR è verified. Un'estrazione successiva propone 4.000.000 sullo stesso soggetto. Qual è lo stato di ciascuna claim dopo l'evento, e chi può emetterlo?"*
Risposte attese: "due milioni diventa superseded" (nessuno lo ha ancora deciso); "l'harness fa il merge sul più recente" (non c'è merge; data di ingestione ≠ data di efficacia); "l'agente marca quattro milioni come verified" (un agente può emettere solo `ClaimProposed`).
Ragionamento corretto: 2.000.000 resta verified, intatto. 4.000.000 nasce `proposed` per mano dell'agente; l'harness, confrontandolo con CurrentBeliefs, trova una credenza sullo stesso soggetto con un valore diverso ed emette `ClaimContested` con un riferimento alla claim da 2.000.000. Solo un umano può portare 4.000.000 a verified e dichiarare 2.000.000 superseded con 4.000.000 come successore. Il log registra chi e quando.

### 15:43 — `npm run review` (seconda chiamata: le quattro proposte)

La CLI stampa le quattro proposte con il testo dello span e la ricerca nel catalogo, poi chiede per ciascuna. Le decisioni da copione (`review:auto` le riproduce nel dry-run):

| Proposta | Testo dello span (abbreviato) | Decisione | Nota digitata |
| --- | --- | --- | --- |
| `clm-attivo2m` attivo.limite 2.000.000 EUR | "1) totale dell'attivo dello stato patrimoniale: 2 milioni di euro" [998,1062) | **verify** | ok |
| `clm-ricavi2m` ricavi.limite 2.000.000 EUR | "ricavi delle vendite e delle prestazioni: 2 milioni di euro" [1067,1126) | **verify** | ok |
| `clm-eserc3` esercizi.consecutivi 3 | "per due esercizi consecutivi" [936,964) | **lasciare proposed** | value misread (text says due) |
| `clm-capitale` capitale.soglia "minimo s.p.a." | "La nomina dell'organo di controllo o del revisore è obbligatoria se la società:" [720,799) — catalogo: UNEXPECTED | **lasciare proposed** | abrogated 2014 trigger, not in text |
| *aggiunta* esercizi.consecutivi 2 | "per due esercizi consecutivi" [936,964) | **propose + verify** | misread value, added by reviewer |
| *aggiunta* dipendenti.limite 10 | "dipendenti occupati in media durante l'esercizio: 10 unità" [1131,1189) | **propose + verify** | missing claim, added by reviewer |

Tail:

```
0010 ★ ClaimVerified             · human(luca)         · claims    · clm-attivo2m  · ← ev-0006  evidence: note "ok"; span [998,1062)
0011 ★ ClaimVerified             · human(luca)         · claims    · clm-ricavi2m  · ← ev-0007  evidence: note "ok"; span [1067,1126)
0012 · ClaimProposed             · human(luca)         · claims    · clm-eserc2    · ← ev-0005
0013 ★ ClaimVerified             · human(luca)         · claims    · clm-eserc2    · ← ev-0012  evidence: note "added by reviewer"
0014 · ClaimProposed             · human(luca)         · claims    · clm-dip10     · ← ev-0005
0015 ★ ClaimVerified             · human(luca)         · claims    · clm-dip10     · ← ev-0014  evidence: note "missing in v1 output"
```

Dire: "Quattro decisioni umane, due delle quali su claim che l'agente non ha mai prodotto. Due proposte restano proposed — seq 8 e seq 9 — e lì resteranno; l'harness misura quel backlog invece di nasconderlo. La seq 9 merita una frase: il modello ha proposto la soglia di capitale abrogata nel 2014. Non è nel testo, e il catalogo non ha nemmeno il soggetto, quindi viene segnalata come inattesa e va in cima alla coda umana. Ricordatevi queste quattro claim verificate: nel segmento 5 sono il golden set, e nessuno ha costruito un dataset."

**Debrief (15:44).** L'agente propone, l'umano decide, l'evento registra chi.

**Fallback.** `fallback/seg2/log-after-extract.txt` (seq 1–9) e `fallback/seg2/log-after-verify.txt` (seq 1–15), mostrati con `cat` attraverso il formattatore (`npm run log:cat -- --file …`). Frase: "Le stesse quindici righe, registrate stamattina; gli id sono deterministici, quindi sono identiche byte per byte."

**Tempi.** log-init 1 s, ingest 1 s, extract structure 2 s, review (albero) 30 s, extract claims 2 s, show 40 s di parlato, review (claims) 60 s. Se si sfora: saltare `npm run show:ricavi-v8` e indicare la slide nascosta con il JSON (risparmia 40 s).

---

## Segmento 3 — Context map, ACL, tre classi; ingestione di v9 (15:45–15:57, slide 12–16)

**A schermo prima del passo.** Slide 12–14 (context map; ACL in cinque passi; il passaggio sulle versioni accoppiate), poi 15–16 (tre classi; prior e tabella dei delta). Il tail mostra seq 1–15.

### 15:51 — `npm run ingest:v9` poi `npm run extract:v9` (slide 13)

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

Dire: "La seq 18 è l'harness che verifica un albero di struttura: classe A, gli stessi percorsi e gli stessi tipi dell'albero che un umano ha verificato; gli intervalli differiscono perché il testo di giugno è più lungo di ventun caratteri, e va bene così, gli intervalli si confrontano solo all'interno di una versione. I cinque passi dell'ACL sono girati tra la seq 18 e la seq 19: filtro sui Verified, selezione di tre nodi comma — questa volta i commi 2, 3 e 5, non solo il comma 2 — base offset 737, 1209 e 1552, causazione impressa, niente rifiutato. Sei proposte. Ci fermiamo qui."

**Checkpoint (15:53, slide 15, 2 min).** Mettere le sei proposte sulla slide (soggetto, valore, comma). Domanda testuale: *"Classificate ciascuna delle sei in A, B o C prima che il comparatore giri."*
Risposte attese: gran parte della sala assegna le tre soglie → C; gli errori comuni sono cessazione e termine di trenta giorni → A ("sono nel testo, l'agente è sicuro": essere nel testo non è avere una credenza) ed `esercizi.consecutivi` → C ("prima era stato proposto tre"; ma tre non è mai stato verificato, la credenza è due).
Ragionamento corretto: il comparatore cerca (lineage, chiave di soggetto) in CurrentBeliefs. `esercizi.consecutivi` 2 ha una credenza verificata da un umano con lo stesso valore normalizzato → A. `attivo.limite` 4.000.000, `ricavi.limite` 4.000.000 e `dipendenti.limite` 20 hanno credenze con valori diversi (2.000.000, 2.000.000, 10) → C. `cessazione.esercizi` 3 e `assemblea.termine` 30 giorni non hanno credenza, perché i commi 3 e 5 non erano stati estratti nel segmento 2 → B; entrambi i soggetti si risolvono nel catalogo, quindi sono novità attesa, non inattesa.

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

Dire: "Seconda riga dell'output: il gate. Con quattro elementi di golden set da un solo comma le sonde non possono raggiungere il minimo, quindi il gate è dichiarato non applicabile e ogni riconferma di classe A viene campionata per l'audit umano. La regola è illustrativa; viene stampata perché una regola che silenziosamente non si applica è una regola che non potete verificare. Cinque eventi di decisione, ognuno con un'evidenza che è già nel log: un id di credenza e un id di batch. Una riconferma, tre contestazioni. L'agente non ha verificato niente."

### `npm run review` (terza chiamata: le tre claim contested)

La CLI mostra ogni coppia in conflitto affiancata — `clm-attivo4m` accanto a `clm-attivo2m`, poi ricavi, poi dipendenti — con entrambi gli span ed entrambi i periodi di vigenza. Decisione per ciascuna: verificare la claim v9, dichiarare superseded la claim v8 con la claim v9 come successore, nota `"L. 55/2019 in force from 2019-06-18"`.

Tail:

```
0030 ★ ClaimVerified             · human(luca)         · claims    · clm-attivo4m  · ← ev-0027  evidence: note "L. 55/2019 in force from 2019-06-18"
0031 ★ ClaimSuperseded           · human(luca)         · claims    · clm-attivo2m  · ← ev-0030  evidence: successor clm-attivo4m; valid until 2019-06-18
0032 ★ ClaimVerified             · human(luca)         · claims    · clm-ricavi4m  · ← ev-0028  evidence: note "L. 55/2019 in force from 2019-06-18"
0033 ★ ClaimSuperseded           · human(luca)         · claims    · clm-ricavi2m  · ← ev-0032  evidence: successor clm-ricavi4m; valid until 2019-06-18
0034 ★ ClaimVerified             · human(luca)         · claims    · clm-dip20     · ← ev-0029  evidence: note "L. 55/2019 in force from 2019-06-18"
0035 ★ ClaimSuperseded           · human(luca)         · claims    · clm-dip10     · ← ev-0034  evidence: successor clm-dip20; valid until 2019-06-18
```

Dire: "Tre disaccordi, tre decisioni, ciascuna nel log con la data e la persona. I valori di marzo non sono cancellati: sono superseded, con il loro periodo intatto. Una query 'al 30 aprile 2019' troverà ancora due milioni, verified — segmento 4."

**Debrief (15:56) — `npm run layers-4-6`.** Stampa `fallback/seg3/layers-4-6.txt` attraverso il formattatore; è un estratto, **non appeso** al log live (seq mostrata come `—`):

```
—    · EntityProposed            · agent(entities@v1)  · entities  · ent-organo    · ← ev-0030
—    ★ EntityResolved            · harness(catalog)    · entities  · ent-organo    ·            evidence: catalogue "organo di controllo" → organo-di-controllo
—    · PolicyProposed            · agent(policies@v1)  · policies  · pol-nomina    · ← (EntityResolved)
—    ★ PolicyVerified            · human(luca)         · policies  · pol-nomina    ·            evidence: cond = ≥1 of attivo/ricavi/dipendenti for 2 yrs; effect = nomina obbligatoria; exc = cessazione 3 yrs
—    · WorkflowStepProposed      · agent(workflow@v1)  · workflow  · wf-obbligo-1  · ← (PolicyVerified)
—    ★ WorkflowStepVerified      · human(luca)         · workflow  · wf-obbligo-1  ·            evidence: test input 2.5M/2.6M, 1.5M/1.6M, 8/9 → mandatory at 2019-04-30, not at 2019-06-30
```

Trenta secondi: "Stessa ACL a ogni ingresso, stessa regola proposed/verified, stessa evidenza sulle decisioni. La policy `nomina-obbligatoria` è la regola del comma 2 con l'eccezione del comma 3; il workflow `obbligo-nomina` la esegue per una società a una data. Policies e Workflow non sono mai verificati dall'harness. Oggi non li eseguiamo; l'handout ha i criteri di accettazione."

**Fallback.** `fallback/seg3/log-after-extract-v9.txt` (seq 1–24), `fallback/seg3/log-after-compare.txt` (seq 1–35), `fallback/seg3/layers-4-6.txt`. Frase: "Snapshot delle stesse righe; la classificazione è deterministica, quindi l'esecuzione dal vivo non aggiungerebbe nulla."

**Tempi.** ingest + extract 5 s, compare 2 s, review 60 s (tre coppie), layers-4-6 30 s. Se si sfora: ridurre l'estratto `layers-4-6` a una frase (risparmia 1 min).

---

## Segmento 4 — Il log, le proiezioni, il replay, la query temporale (15:57–16:09, slide 17–21)

**A schermo prima del passo.** Slide 17–19 (campi dell'evento; due famiglie; proiezioni come fold). Il tail mostra seq 1–35.

### 16:00 — `npm run log:cat` (slide 19)

Stampa le seq 1–35 nel formato del tail, una schermata. Seguire a voce una catena, con il dito sullo schermo, dall'evento più recente all'indietro:

`ev-0033 ClaimSuperseded(ricavi2m, human)` ← `ev-0032 ClaimVerified(ricavi4m, human)` ← `ev-0028 ClaimContested(ricavi4m, harness)` ← `ev-0021 ClaimProposed(ricavi4m, claims@v1)` ← `ev-0018 StructureVerified(tree-v9, harness)` ← `ev-0017 StructureProposed(structure@v1)` ← `ev-0016 DocumentVersionIngested(cc-art2477@v9)`.

Dire: "Ogni `*Proposed` punta a una `*Verified` del livello precedente. È il contratto fra livelli, verificato meccanicamente seguendo gli id di causazione, non leggendo il codice."

### `npm run projections:drop` poi `npm run projections:build`

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

Dire: "Cancellata e ricostruita, stesso hash. La knowledge base è questa tabella; il sistema di registrazione è il log a destra. Non c'è niente da migrare perché non c'è niente da conservare."

**Talk (16:02, slide 20):** due proiezioni convivono quando cambia l'estrattore.

**Checkpoint (16:03, slide 20, 2 min).** Domanda testuale: *"Passiamo al prompt v2 e rigiochiamo. Quali righe del log vengono modificate?"*
Risposte attese: "le quattro ClaimProposed di v1 vengono sovrascritte"; "le credenze cambiano ai valori di v2"; "le claim da due milioni superseded spariscono".
Ragionamento corretto: nessuna. Un replay fornisce le `StructureVerified` esistenti a claims@v2, che emette nuove `ClaimProposed` con i propri id deterministici (produttore, input e versione dell'estrattore sono diversi, quindi gli id sono diversi e l'append li accetta). Gli eventi di v1 restano, attribuibili a v1. CurrentBeliefs non cambia: le proposte di v2 sono proposed, e l'harness non usa mai una versione non promossa per la riconferma. La proiezione sotto v2 è una candidata mostrata accanto a quella promossa.

### 16:05 — `npm run replay:claims-v2`

```
replay  extractor=claims@v2 (candidate)  inputs: StructureVerified ev-0005 (v8: c2), ev-0018 (v9: c2, c3, c5)  (fixture replay)
proposals: 5 (v8/c2) + 6 (v9) = 11 appended, 0 duplicates
```

Tail (mostrate le prime cinque; la sala deve vedere l'etichetta `claims@v2` e che niente sopra si è mosso):

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

Dire: "Affiancate, per versione, niente sovrascritto. Una riga differisce, sul testo di marzo: duemila euro dove il testo dice due milioni. Se v2 sostituisce v1 lo decide l'harness, nel segmento 5, con evidenza — e notate che un diff dello stato corrente non lo avrebbe mostrato, perché le claim di marzo sono superseded; è per questo che l'harness valuta contro gli elementi del golden set, non confrontando le credenze."

### 16:07 — `npm run beliefs:at-2019-04-30` poi `npm run beliefs` (slide 21)

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

Dire: "Le claim superseded sono ancora nel log con il loro periodo intatto; la query ripiega sullo stato che era in vigore a quella data. Il transaction time — quando lo abbiamo appreso — è il numero di sequenza; il valid time — quando era vero — è il periodo di vigenza della versione del documento. Entrambi sono conservati ed entrambi sono interrogabili; oggi è interessante solo il valid time, perché tutto ciò che è in questo log è stato appreso questo pomeriggio."

**Debrief (16:08).** Niente da migrare: si rigioca. Indicare il Terminale B: è solo cresciuto.

**Fallback.** `fallback/seg4/log-cat.txt`, `projections-rebuilt.txt`, `projections-diff.txt`, `beliefs-at-2019-04-30.txt`. Frase: "Il fold è deterministico, quindi lo snapshot e l'esecuzione dal vivo non possono differire; ecco lo snapshot."

**Tempi.** log-cat 60 s di parlato, drop/build 2 s, replay 2 s, diff 2 s, beliefs 2 s. Se si sfora: saltare `projections-diff` e mostrare la sua slide con lo screenshot (risparmia 40 s).

---

## Segmento 5 — L'harness: golden set, eval, deriva, promozione (16:09–16:21, slide 22–27)

**A schermo prima del passo.** Slide 22–23 (golden set come query sul log; esclusioni; offline vs sonde). Il tail mostra seq 1–46.

### 16:11 — `npm run golden:claims-until-seg2` poi `npm run golden:claims` (slide 23)

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

Dire: "Due query, due versioni del golden set, entrambe riproducibili da un numero di sequenza. I tre elementi nuovi sono i conflitti che Luca ha risolto venti minuti fa; nessun etichettatore esterno li avrebbe prodotti, perché nessun etichettatore esterno ha visto il conflitto. La verifica dell'harness sulla regola dei due esercizi è esclusa: deriva da una decisione umana già presente nell'insieme."

### 16:13 — `npm run eval:claims-v1` (slide 24–25)

(L'eval usa il golden set claims@g1 — l'elemento del comma 2 di v8 — così che escano i numeri dell'handbook; dirlo.)

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

Calcolare la coppia 1 a voce: lunghezza attesa 62, lunghezza proposta 64 — ha preso anche l'"1) " — intersezione `[1000,1062)` = 62, unione `[998,1062)` = 64, 62/64 = 0,97 ≥ 0,80. Coppia 3: span perfetto, numero sbagliato — l'estrattore ha guardato nel posto giusto e ha letto il "tre" della regola di cessazione dentro la condizione di attivazione; costa un FP e un FN.

### 16:15 — `npm run eval:claims-v2-summary` (slide 26)

```
eval  extractor=claims@v2  golden=claims@g1  --summary
TP 3  FP 2  FN 1   precision 0.60   recall 0.75     (v1: 0.50 / 0.50)
→ EvalCompleted ev-0048
```

**Checkpoint (16:17, slide 26, 1 min).** Domanda testuale: *"v2 è migliore su entrambi gli aggregati, +0,10 di precision e +0,25 di recall. Supponiamo per un momento che entrambe le soglie siano rispettate: promuoviamo v2?"* (la supposizione è necessaria perché la precision 0,60 da sola fallisce la soglia illustrativa di 0,90, il che renderebbe la domanda banale). Attesa dalla sala: sì. Risposta corretta: no, e il motivo è visibile solo per elemento. Non spiegare ancora; eseguire la deriva.

### 16:18 — `npm run drift:v1-v2` (slide 26–27)

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

Dire: "In aggregato v2 è migliore e ha nascosto una regressione su un valore monetario — la soglia che decide se una società deve nominare un revisore, sbagliata di un fattore mille. La deriva si misura per elemento perché un miglioramento aggregato può nascondere una regressione proprio sugli elementi che contano. Fallisce anche il criterio 1, ma il criterio 3 è quello che fallirebbe anche con una precision perfetta." Gate dei batch in una frase: "Online, gli stessi elementi del golden set vengono inseriti come sonde nei batch di produzione, e il batch è segnale solo se ne manca al massimo uno e ne inventa al massimo uno, con zero errori critici; la regola è in conteggi perché le percentuali su cinque elementi sono rumore."

**Debrief (16:20).** Deriva per elemento; il golden set lo hanno scritto gli utenti risolvendo conflitti.

**Fallback.** `fallback/seg5/golden-claims.txt`, `eval-v1.txt`, `eval-v2-summary.txt`, `drift-v1-v2.txt`. Frase: "Le metriche sono funzioni pure del log; questa è la stessa tabella."

**Tempi.** golden 2 × 2 s + 30 s di parlato, eval v1 2 s + 60 s di parlato, eval v2 2 s, drift 2 s + 60 s. Se si sfora: eliminare la seconda chiamata `npm run golden:claims` (risparmia 30 s), poi mostrare il riepilogo di v2 dalla slide invece di eseguirlo.

---

## Segmento 6 — Consumo (16:21–16:27, slide 28–30)

**A schermo prima del passo.** Slide 28–29 (il diagramma dell'artefatto; policy di consumo e forma della risposta). Il tail mostra seq 1–48.

### 16:23 — `npm run ask:ricavi-2019-04-30` poi `npm run ask:ricavi` (slide 29)

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

Dire: "L'agente ha risposto dalla proiezione e ha citato un id di credenza. Dall'id chiunque arriva all'attore, all'evidenza, allo span e alla versione. Confrontate con le 15:22: stessa domanda, e ora nella risposta c'è l'evidenza." Poi l'esempio di chiusura, dalla slide, senza terminale: "Una società illustrativa: totale dell'attivo 2,5 e 2,6 milioni, ricavi 1,5 e 1,6 milioni, 8 e 9 dipendenti nel 2017 e nel 2018. Assemblea del 30 aprile 2019: la soglia di due milioni sul totale dell'attivo è superata in entrambi gli esercizi, la nomina è obbligatoria, e il workflow cita `clm-attivo2m` e `clm-eserc2`. Assemblea del 30 giugno 2019: nessuna soglia del testo di giugno è superata, non obbligatoria, citando `clm-attivo4m`, `clm-ricavi4m`, `clm-dip20`. Stessa società, due mesi di distanza, due risposte, ciascuna con la sua evidenza — e nessuna delle due viene dalla lettura dell'articolo al momento della domanda."

**Checkpoint (16:25, slide 30, 1 min).** Domanda testuale: *"Policy di consumo: grandezze monetarie e termini temporali solo da credenze verified con radice umana. L'agente può rispondere su `assemblea.termine` — i trenta giorni — e su `esercizi.consecutivi` — i due esercizi — sotto il testo di giugno?"*
Risposte attese: "i trenta giorni sì, l'agente li ha estratti" (è proposed, classe B, nella coda di revisione); "i due esercizi no, li ha verificati l'harness, non un umano" (la policy si applica alla radice della catena di evidenza).
Ragionamento corretto: `assemblea.termine` 30 giorni è ancora `proposed` — classe B, nessuno ha deciso — quindi l'agente deve dire che non può asserirlo e può segnalare che è in attesa. `esercizi.consecutivi` 2 sotto v9 è `verified` dall'harness in classe A, e la sua evidenza è la claim v8 verificata da un umano (ev-0013); la policy "radice umana" è soddisfatta dalla radice della catena, quindi l'agente può rispondere, citando `clm-eserc2b` e la sua radice.

**Debrief (16:26).** Proiezione, non documenti.

**Fallback.** `fallback/seg6/ask.txt`. Frase: "Le stesse due risposte, registrate; gli id di credenza sono quelli sullo schermo a destra."

**Tempi.** Due comandi, 2 s ciascuno, 60 s di parlato più 30 s per l'esempio di chiusura. Niente da tagliare; se la sessione è già fuori tempo, saltare la seconda `ask` ed enunciare la risposta.

---

## Chiusura (16:27–16:30, slide 31)

Niente terminale. Tre decisioni e cosa costa ciascuna, lette dalla slide, una frase ciascuna:

1. Stato contested esplicito risolto da un umano invece di un merge — costo: latenza tra ingestione e disponibilità, e una coda di revisione da presidiare.
2. Il log è il sistema di registrazione e la knowledge base è una proiezione — costo: lo storage cresce con gli eventi e non si compatta mai; ogni cambio di estrattore rigioca il livello e quelli successivi.
3. Golden set per livello derivati dal log — costo: golden set congelati e versionati per livello, e un catalogo dei soggetti mantenuto a mano; più il costo nascosto dichiarato: un errore umano iniziale viene riconfermato in classe A finché il campionamento o una supersessione non lo intercettano.

QR dell'handout (elenco delle entità, catalogo degli eventi, repository). Poi le domande (16:30–16:40, `06-qa-and-checklist.md`). Lasciare visibile il Terminale B durante le Q&A: alle domande su "cosa c'è nel log" si può rispondere indicando.

---

## Incoerenze trovate scrivendo questo script (da risolvere prima delle 15:20)

1. **`beliefs --at <date>` deve essere una query in valid time.** L'handbook §4.8 descrive la query temporale come un fold "fino a quella data (o fino al numero di sequenza corrente a quella data)", cioè transaction time. In sala ogni evento è appeso il 28 ott 2026, quindi un fold in transaction time al 2019-04-30 restituisce una proiezione vuota. Lo script e l'output atteso qui sopra trattano `--at` come valid time: la credenza la cui versione di documento era in vigore alla data, con una claim superseded valida fino alla data di efficacia del suo successore. `src/projections/` (beliefs-at-date) e il README devono dire quale delle due il comando implementa; solo la lettura in valid time produce "2,000,000 EUR" sul palco.
2. **`npm run show -- --event last` stampa la proposta `capitale.soglia`**, non quella di `ricavi.limite`, se claims@v1 emette nell'ordine della fixture. Lo script usa `npm run show:ricavi-v8`; la riga del run sheet coincide.
3. **Tipo di attore per ingestione e log-init.** L'handbook §4.2 elenca quattro tipi di attore (human, agent, harness, import). `LogInitialised` e `DocumentVersionIngested` sono prodotti dal processo deterministico di ingestione, che non è nessuno dei quattro. Lo script stampa `process(ingest)` / `process(log-init)`; lo schema dovrebbe aggiungere `process` oppure assegnare questi eventi a `harness`.
4. **Il replay di claims@v2 su v9** appende sei proposte che nessuno valuta (il golden set per v9 ha tre elementi, e `eval` gira su claims@g1). Innocuo, ma la sala vedrà comparire 11 righe; lo script dice "cinque più sei" perché non venga letto come un errore.
5. **Anche il criterio di promozione 1 fallisce per v2** (precision 0,60 < 0,90). L'esempio dell'handbook afferma che v2 "fallisce il criterio 3"; fallisce 1 e 3. Lo script lo dice esplicitamente e tiene il criterio 3 come argomento (fallirebbe anche con precision perfetta).
6. **`projections:diff` sulle sole credenze correnti non mostrerebbe la regressione di v2**, perché al momento del replay le claim v8 sono superseded e le proposte di v2 su v9 sono corrette (`00-running-example.md` §6). Lo script fa quindi stampare a `projections:diff` il confronto per versione di documento, così la riga "2,000 EUR vs 2,000,000 EUR" è visibile sulla riga v8; il repository deve implementare il diff per versione, altrimenti l'output del segmento 4 sarà tutto "same". Alternativa da valutare nella scheda: far sì che il bug di normalizzazione di v2 ("milioni" perso) colpisca anche `ricavi.limite` di v9 (4.000 EUR), che è ciò che farebbe un vero bug di normalizzazione; cambierebbe la riga candidata di v9 in DIFFERS senza toccare i numeri del segmento 5, calcolati su claims@g1 (solo v8).
7. **Anche la riconferma della struttura nel segmento 3 richiede l'esenzione a freddo** (run sheet rev. 12): il golden set di Structure contiene un solo elemento, quindi il gate non può girare; l'output di extract qui sopra stampa "gate not applicable (structure golden set 1 item)" per questo motivo.
