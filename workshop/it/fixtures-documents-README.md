# fixtures/documents — art. 2477 c.c., tre versioni

Traduzione italiana di `fixtures/documents/README.md`; in caso di divergenza prevale l'inglese.

I documenti che il repository ingerisce. Copiare questa cartella così com'è nel repository in `fixtures/documents/`. La specifica dell'esempio (catalogo dei soggetti, claim attese, span, fixture degli estrattori, numeri svolti, checkpoint) è `workshop/en/00-running-example.md`; questo README descrive solo i file.

| File | Contenuto | Caratteri |
| --- | --- | --- |
| `cc-art2477-v7.txt` | Art. 2477 c.c. in vigore dal 21 ago 2014 al 15 mar 2019 (versione Normattiva 7). Solo per la baseline. | 1.697 |
| `cc-art2477-v8.txt` | In vigore dal 16 mar 2019 al 17 giu 2019 (versione 8; D.Lgs. 14/2019 art. 379): 2 milioni / 2 milioni / 10 unità. Ingerito nel segmento 2. | 1.991 |
| `cc-art2477-v9.txt` | In vigore dal 18 giu 2019 (versione 9; L. 55/2019 art. 2-bis): 4 milioni / 4 milioni / 20 unità. Ingerito nel segmento 3. | 2.012 |
| `manifest.json` | Per file: versione, vigenza, atto modificativo, numero di caratteri, hash del contenuto (SHA-256, 16 esadecimali), albero delle sezioni con intervalli assoluti, base offset del c2, span delle claim attese. I test del repository lo leggono. | — |
| `compliance-register.csv` | Prior illustrativo da sistema di riferimento (le soglie che un'azienda applica oggi). Non usato live. | 5 righe |

Fonte: Normattiva, R.D. 16 marzo 1942, n. 262 (atto 042U0262), art. 2477, `art.versione` 7, 8, 9, consultato il 27 ott 2026. I testi sono le versioni consolidate con i marcatori di modifica `((…))` rimossi e la nota "AGGIORNAMENTO (224)" di Normattiva omessa; la riga "COMMA ABROGATO …" fa parte del testo consolidato ed è mantenuta come nodo `note`. Gli atti dello Stato non sono oggetto di diritto d'autore (art. 5 L. 633/1941).

## Offset

Offset in caratteri (indici di stringa JavaScript; tutti i caratteri sono nel Basic Multilingual Plane), intervalli semiaperti, terminatori di riga `\n`. Non sono offset in byte: i file contengono lettere accentate. Ogni file è composto da cinque righe di intestazione, una riga vuota, poi un paragrafo per comma separato da una riga vuota. Gli alberi di v8 e v9 hanno percorsi e tipi identici (header, c1, abrogato, c2, c3, c4, c5, c6) e differiscono solo negli offset.

| Nodo | v8 | v9 |
| --- | --- | --- |
| header | [0, 328) | [0, 345) |
| c1 | [330, 606) | [347, 623) |
| abrogato (note) | [608, 718) | [625, 735) |
| c2 (le soglie) | [720, 1190) | [737, 1207) |
| c3 | [1192, 1377) | [1209, 1396) |
| c4 | [1379, 1531) | [1398, 1550) |
| c5 | [1533, 1889) | [1552, 1910) |
| c6 | [1891, 1990) | [1912, 2011) |

Claim attese (assolute; locale al c2 = assoluto − 720 per v8, − 737 per v9):

| Versione | Chiave di soggetto | Valore | Assoluto | Locale al c2 |
| --- | --- | --- | --- | --- |
| v8 | esercizi.consecutivi | 2 | [936, 964) | [216, 244) |
| v8 | attivo.limite | 2.000.000 EUR | [1000, 1062) | [280, 342) |
| v8 | ricavi.limite | 2.000.000 EUR | [1067, 1126) | [347, 406) |
| v8 | dipendenti.limite | 10 | [1131, 1189) | [411, 469) |
| v9 | esercizi.consecutivi | 2 | [953, 981) | [216, 244) |
| v9 | attivo.limite | 4.000.000 EUR | [1017, 1079) | [280, 342) |
| v9 | ricavi.limite | 4.000.000 EUR | [1084, 1143) | [347, 406) |
| v9 | dipendenti.limite | 20 | [1148, 1206) | [411, 469) |
| v9 | cessazione.esercizi | 3 | [1324, 1352) | c3 |
| v9 | assemblea.termine | 30 giorni | [1664, 1683) | c5 |

Le fixture LLM per `claims@v1` e `claims@v2` devono produrre esattamente le proposte di `00-running-example.md` §6 (v1 sul c2 della v8: attivo al locale [278, 342), ricavi, esercizi = 3, `capitale.soglia` su [0, 79), dipendenti mancante; v2: ricavi = 2.000 EUR, `cessazione.esercizi 3` inattesa; v1 sulla v9: le sei proposte corrette).

## Baseline di retrieval

`npm run rag:index` suddivide in chunk i tre file (illustrativo: finestre di ~160 caratteri, senza sovrapposizione) e deve restituire i tre passaggi della lett. c) con punteggi comparabili per la query "soglia ricavi nomina organo di controllo".

## Rigenerazione

Prodotti da uno script che asserisce ogni offset qui sopra; conservare i file, non lo script. Se un testo viene modificato, ricontrollare gli offset in `manifest.json` e le prime due colonne delle tabelle qui sopra, e verificare l'assenza di spazi finali.
