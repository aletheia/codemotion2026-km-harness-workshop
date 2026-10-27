# Domande anticipate e checklist pre-talk

Traduzione italiana di `06-qa-and-checklist.md`; in caso di divergenza prevale l'inglese.

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revisione 4, 27 ott 2026. Spazio Q&A 16:30–16:40 (la slide 31 resta a schermo). Le risposte sono scritte come Luca le direbbe, in frasi complete, 45–75 secondi ciascuna. Alle sei seguono due domande di riserva. Esempio di riferimento: art. 2477 c.c., versioni Normattiva 7, 8 e 9 (`00-running-example.md`).

## Sei domande anticipate

**1. "Perché non attaccare semplicemente la versione e la data di entrata in vigore come metadati ai chunk e filtrare al momento della query?"**
Il filtro sui metadati risolve il guasto (a) solo quando la query sa già quale versione si applica, che è esattamente la cosa che il sistema dovrebbe sapere; "l'assemblea del 30 aprile 2019 che approva il bilancio 2018" deve essere risolta nel testo in vigore a quella data da qualcosa, e quel qualcosa è una credenza con un periodo di valid time, non un parametro di filtro. Non fa nulla per il guasto (b): tre chunk dell'art. 2477 etichettati con tre versioni diverse restano tre vettori senza relazione fra loro, quindi il sistema non può dire che parlano della stessa soglia, non può contestare l'uno con l'altro, e non può registrare che il testo del 18 giugno ha superato quello del 16 marzo. E non fa nulla per il guasto (c), perché l'estrazione resta un unico passo opaco. I metadati sui chunk sono provenienza a grana di documento; il modello la richiede a grana di span, con un ciclo di vita sopra. Se l'insieme dei documenti non ha supersessione né conflitti, il filtro sui metadati basta e lo userei: il capitolo 8.4 dell'handbook dice esattamente quando.

**2. "La revisione umana non diventa il collo di bottiglia? Avete sostituito un indice con una coda."**
Sì, c'è una coda, ed è nella slide dei costi: una claim non è consumabile finché non è verificata, mentre il retrieval è immediato. Ciò che la regola delle tre classi cambia è a cosa la coda è proporzionale. Con "un umano verifica tutto", il costo è proporzionale al volume, e ogni riproiezione — una nuova versione del testo, un nuovo estrattore — riproduce l'intero volume, quindi i cambi di estrattore non avvengono mai. Con la regola delle tre classi, il costo è proporzionale a novità più conflitto: sul documento illustrativo da 300 claim, 60 decisioni con un prior da sistema di riferimento, 50 per la versione successiva, 12 per una nuova versione dell'estrattore. Oggi lo avete visto in piccolo: il testo del giugno 2019 ha prodotto sei proposte e il revisore ha preso tre decisioni, i tre conflitti; la riconferma non è costata nulla e le due novità aspettano in coda. L'umano rivede i delta, e i delta sono esattamente i casi interessanti. Anche il costo nascosto è dichiarato: un errore umano iniziale viene riconfermato in classe A a ogni riproiezione, a meno che il campionamento o una supersessione successiva non lo intercettino.

**3. "Perché un comparatore deterministico per uguale/nuovo/conflitto? Un LLM giudice gestirebbe molto meglio sinonimi e formulazioni."**
Perché la classificazione deve essere riproducibile e attribuibile. Una riconferma di classe A emette una `ClaimVerified` con un attore e un'evidenza; se l'attore fosse un modello, l'evidenza sarebbe un altro output non deterministico, e la regola "gli agenti non verificano mai" sarebbe violata da un terzo agente. Il problema dei sinonimi è reale, e si risolve dove deve stare: nel catalogo dei soggetti, una lista versionata e mantenuta a mano di soggetti e grandezze con sinonimi — "ricavi delle vendite e delle prestazioni" e "ricavi" si risolvono entrambi in `ricavi.limite`. Un soggetto che il catalogo non risolve è una novità inattesa e va a un umano con alta priorità, che è il comportamento corretto: oggi è stata `capitale.soglia`, il presupposto del capitale sociale abrogato nel 2014 che l'estrattore ha riprodotto a memoria; o il catalogo è incompleto o l'estrattore ha inventato un soggetto, ed entrambe sono cose che una persona deve vedere. Il catalogo è un costo; anche quello è nella slide dei costi. Dove un modello linguistico è utile in questo percorso è nel proporre voci del catalogo, che entrano come proposte come tutto il resto.

**4. "Perché non un knowledge graph o un'ontologia come livello finale? È quello che fanno quasi tutti gli stack di knowledge management."**
Perché un'ontologia è un secondo artefatto con la sua deriva e, in pratica, senza un proprietario, e perché le relazioni che contano in un dominio regolato sono regole con condizioni ed eccezioni. "La nomina dell'organo di controllo è obbligatoria se per due esercizi consecutivi è superato almeno uno dei tre limiti, e l'obbligo cessa dopo tre esercizi consecutivi in cui nessuno è superato" è la Policy `nomina-obbligatoria` — condizione, effetto, eccezione, ogni elemento riferito a claim verificate — e un arco di grafo non può portare l'eccezione, il combinatore "almeno uno", né il periodo di applicabilità che è cambiato il 18 giugno 2019. Il livello Entities tiene un catalogo canonico piatto con sinonimi, che è ciò di cui il comparatore e i golden set hanno bisogno; le relazioni vivono nel livello Policies, che ha i propri eventi, criteri di accettazione ed elementi del golden set e non è mai verificato dall'harness, perché un errore lì ha effetto eseguibile. Se a qualcuno serve una vista a grafo, è una proiezione sul log come tutte le altre, e si può cancellare e ricostruire.

**5. "Questo è un file JSONL e un solo articolo. Come scala all'intero Codice civile, a migliaia di documenti e ad agenti paralleli?"**
Il file è lo storage del workshop; il modello richiede solo append ordinato e append idempotente, quindi passare a un log partizionato è un cambio di adapter, non di modello. Il parallelismo è già nel design: gli estrattori girano per unità di estrazione, si distribuiscono liberamente e sono riavviabili, perché l'id dell'evento è deterministico da (produttore, artefatto di input, versione dell'estrattore) e l'append scarta i duplicati; ogni estrattore mantiene un cursore persistito come evento. Le proiezioni sono fold e si possono ricostruire per lineage, che è la chiave di partizione naturale, dato che le credenze si confrontano entro un lineage — un articolo è un lineage, e il Codice ne ha qualche migliaio. Le cose che non scalano gratis sono dichiarate: lo storage cresce con gli eventi e il log non viene compattato; la riproiezione rigioca un livello e quelli successivi; i golden set vanno congelati e versionati per livello. Sono i costi della correttezza nel tempo, e sono inferiori all'alternativa, che è riestrarre tutto e sovrascrivere.

**6. "Quale framework per agenti e quale modello usate per gli estrattori, e quanto conta la scelta?"**
Gli estrattori sono basati su Claude, e model id, prompt version ed extractor version sono registrati nell'attore di ogni proposta, quindi la scelta è attribuibile nel log e può essere cambiata per livello con un replay. Nel repository non si usa alcun framework: l'ACL, il comparatore, il log, le proiezioni e l'harness sono piccole funzioni TypeScript pure, e il senso del walkthrough è che il percorso decisionale resti visibile e testabile. Un framework avvolgerebbe gli estrattori — retry, tool call, output strutturato — e mai il percorso decisionale; se ne servisse uno in produzione, userei Strands Agents con il suo SDK TypeScript. La scelta conta meno di quanto ci si aspetti, perché il modello è, per costruzione, un produttore inaffidabile il cui output è sempre proposed: l'harness misura ogni versione contro il golden set e decide la promozione per livello, quindi cambiare modello è un replay più un eval, non una migrazione.

## Due domande di riserva

**7. "Da dove vengono i golden set il primo giorno, quando nessuno ha ancora verificato nulla?"**
Dalle tre forme di prior: un import da un sistema di riferimento, che entra nel log come `ClaimVerified(actor=import)` con il record di origine come evidenza — in questo dominio, il registro di compliance dell'azienda con le soglie che applica oggi, che è nelle fixture come `compliance-register.csv`; una versione di riferimento rivista per intero una volta sola; e il catalogo dei soggetti, che non fornisce valori ma ordina la coda. Le credenze verificate da import sono escluse dai golden set e campionate più duramente, così i primi elementi del golden set scritti da umani vengono dai primi conflitti e dalle prime novità che i revisori risolvono. Finché il golden set di un livello non raggiunge il minimo delle sonde, il gate dei batch non è applicabile e le riconferme di classe A sono campionate al 100 % (regola illustrativa; la stampa il comparatore).

**8. "Cosa succede quando cambia l'estrattore di Structure e l'albero delle sezioni è diverso?"**
Il nuovo albero è una `StructureProposed`; se differisce dall'albero verificato è classe C per il livello Structure e lo risolve un umano. Una volta verificato, l'ACL di Claims produce nuove unità di estrazione con nuovi base offset; rigiocare l'estrattore di Claims su di esse appende nuove proposte attribuibili alla stessa versione di claims. È tutto il senso dell'anti-corruption layer: il contratto di input dell'estrattore di Claims è fisso e versionato in modo indipendente, quindi un cambiamento a monte si manifesta come una decisione di struttura e un replay, non come una deriva non attribuibile nelle claim. L'art. 2477 ne ha un caso reale: il testo del 16 marzo 2019 dice "lettera c) del terzo comma" perché il redattore contava il comma abrogato, e il testo del 18 giugno lo ha corretto in "secondo comma". Se il comma abrogato sia un nodo contato o una nota è una decisione di Structure, presa una volta da un umano e registrata; l'estrattore di Claims non vede mai la questione.

## Checklist pre-talk

Mattina di mercoledì 28 ottobre; in sala entro le 15:05.

Repository e demo

- [ ] `git clone` in una directory pulita, `npm ci` con la rete spenta, `npm run dry-run` verde tre volte di seguito, identico byte per byte (`AGENTS.md` §14).
- [ ] I tag `ws-seg1` … `ws-seg6` e `ws-final` esistono sul remote (`git ls-remote --tags origin`); i vecchi tag `seg*-start/done` e `workshop-v1` (albero Casa Protetta) sono cancellati. Prova generale dello step 9 di `PROMPTS.md` eseguita una volta: la sequenza di checkout termina con il log a seq 48. Stato finale: `git status` pulito, `ws-seg1` in checkout, log vuoto, `rag:index` eseguito.
- [ ] `fixtures/documents/` contiene `cc-art2477-v7.txt`, `cc-art2477-v8.txt`, `cc-art2477-v9.txt`, `manifest.json`, `compliance-register.csv`; gli hash dei contenuti coincidono con `manifest.json`.
- [ ] `fixtures/llm/` completo per `structure@v1`, `claims@v1`, `claims@v2` su v8 e v9; il replayer fallisce in modo esplicito su una fixture mancante (verificare rinominandone una ed eseguendo `npm run extract:claims-v8`).
- [ ] `fallback/seg1` … `fallback/seg6` presenti e non vuoti; aprire la cartella in una seconda scheda del terminale prima delle 15:20.
- [ ] `npm run log:init` eseguito una volta prima della sessione e log rimosso di nuovo, così che il primo `npm run log:init` live parta da un file vuoto (oppure tenere una copia pre-inizializzata per il percorso di fallback).
- [ ] Verificato a schermo: `npm run rag:query` restituisce i tre passaggi della lett. c) (2435-bis, 2 milioni, 4 milioni); `npm run compare` stampa la riga del gate a freddo; `npm run beliefs:at-2019-04-30` restituisce `ricavi.limite` 2.000.000 EUR (valid time); `npm run show:ricavi-v8` stampa la proposta `ricavi.limite`; `npm run drift:v1-v2` elenca i criteri 1 e 3 come falliti; `npm run golden:claims` con e senza `UNTIL` restituisce 4 e 7 elementi.
- [ ] Terminale: tema chiaro, ≥ 18 pt, due pannelli (sinistra: comandi; destra: `npm run tail`), `npm run tail` avviato prima della prima slide; disposizione delle finestre salvata.
- [ ] README con le sezioni 1–6 presenti, inclusa la tabella delle tre classi e la definizione di golden set dal log; il link al repository si risolve da un telefono (QR sulla slide 31).

Slide

- [ ] Template ufficiale Codemotion (mail del 19 ott), 16:9, font Codemotion, nessuna slide di copertina; 33 slide visibili (31 + 5a + 6a).
- [ ] Slide nascosta con screenshot dopo ogni slide live (3, 4, 5, 7, 10, 13, 15, 19, 20, 21, 23–27, 29) con l'output `fallback/` corrispondente.
- [ ] La slide 2 (il dominio) mostra le tre versioni con le date di entrata in vigore e la fonte Normattiva.
- [ ] Slide 31: tre decisioni e costi; QR all'handout; QR al repository; entrambi scansionati una volta.
- [ ] Note del presentatore = note dello speaker da `02-slide-outline.md`; clicker testato; deck esportato in PDF come secondo fallback.

Materiali

- [ ] Handout (`07-handout.md`) esportato in PDF di una pagina e pubblicato all'URL dell'handout.
- [ ] Run sheet stampato (`01-run-sheet.md`), orari in CET; un orologio o timer visibile.
- [ ] Le sei risposte Q&A rilette una volta.

Logistica (da `talk-brief.md`)

- [ ] Laptop, adattatore HDMI, caricatore EU, mini-jack se serve l'audio; la RJ45 cablata è solo per lo speaker e non è necessaria.
- [ ] Hotel a Milano; decisione sulla cena degli speaker (Codemotion Milano o mlopsday Bologna, entrambe mercoledì 28 ott); spostamento Milano ↔ Bologna giovedì 29 ott.
