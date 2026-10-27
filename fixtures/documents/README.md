# fixtures/documents — art. 2477 c.c., three versions

The documents the repository ingests. Copy this folder verbatim into the repository at `fixtures/documents/`. The specification of the example (subject catalogue, expected claims, spans, extractor fixtures, worked numbers, checkpoints) is `workshop/00-running-example.md`; this README only describes the files.

| File | Content | Characters |
| --- | --- | --- |
| `cc-art2477-v7.txt` | Art. 2477 c.c. as in force 21 Aug 2014 – 15 Mar 2019 (Normattiva version 7). Baseline only. | 1,697 |
| `cc-art2477-v8.txt` | As in force 16 Mar 2019 – 17 Jun 2019 (version 8; D.Lgs. 14/2019 art. 379): 2 milioni / 2 milioni / 10 unità. Ingested in segment 2. | 1,991 |
| `cc-art2477-v9.txt` | In force from 18 Jun 2019 (version 9; L. 55/2019 art. 2-bis): 4 milioni / 4 milioni / 20 unità. Ingested in segment 3. | 2,012 |
| `manifest.json` | Per file: version, validity, amending act, character count, content hash (SHA-256, 16 hex), section tree with absolute intervals, c2 base offset, expected claim spans. The repository's tests read it. | — |
| `compliance-register.csv` | Illustrative system-of-record prior (the thresholds a firm applies today). Not used live. | 5 lines |

Source: Normattiva, R.D. 16 marzo 1942, n. 262 (atto 042U0262), art. 2477, `art.versione` 7, 8, 9, retrieved 27 Oct 2026. The texts are the consolidated versions with the `((…))` amendment markers removed and Normattiva's "AGGIORNAMENTO (224)" footnote omitted; the "COMMA ABROGATO …" line is part of the consolidated text and is kept as a `note` node. Acts of the Italian State are not subject to copyright (art. 5 L. 633/1941).

## Offsets

Character offsets (JavaScript string indices; all characters are in the Basic Multilingual Plane), half-open intervals, `\n` line endings. Not byte offsets: the files contain accented letters. Each file is five header lines, a blank line, then one paragraph per comma separated by one blank line. The v8 and v9 trees have identical paths and types (header, c1, abrogato, c2, c3, c4, c5, c6) and differ only in offsets.

| Node | v8 | v9 |
| --- | --- | --- |
| header | [0, 328) | [0, 345) |
| c1 | [330, 606) | [347, 623) |
| abrogato (note) | [608, 718) | [625, 735) |
| c2 (the thresholds) | [720, 1190) | [737, 1207) |
| c3 | [1192, 1377) | [1209, 1396) |
| c4 | [1379, 1531) | [1398, 1550) |
| c5 | [1533, 1889) | [1552, 1910) |
| c6 | [1891, 1990) | [1912, 2011) |

Expected claims (absolute; c2-local = absolute − 720 for v8, − 737 for v9):

| Version | Subject key | Value | Absolute | c2-local |
| --- | --- | --- | --- | --- |
| v8 | esercizi.consecutivi | 2 | [936, 964) | [216, 244) |
| v8 | attivo.limite | 2,000,000 EUR | [1000, 1062) | [280, 342) |
| v8 | ricavi.limite | 2,000,000 EUR | [1067, 1126) | [347, 406) |
| v8 | dipendenti.limite | 10 | [1131, 1189) | [411, 469) |
| v9 | esercizi.consecutivi | 2 | [953, 981) | [216, 244) |
| v9 | attivo.limite | 4,000,000 EUR | [1017, 1079) | [280, 342) |
| v9 | ricavi.limite | 4,000,000 EUR | [1084, 1143) | [347, 406) |
| v9 | dipendenti.limite | 20 | [1148, 1206) | [411, 469) |
| v9 | cessazione.esercizi | 3 | [1324, 1352) | c3 |
| v9 | assemblea.termine | 30 giorni | [1664, 1683) | c5 |

The LLM fixtures for `claims@v1` and `claims@v2` must produce exactly the proposals in `00-running-example.md` §6 (v1 on v8 c2: attivo at local [278, 342), ricavi, esercizi = 3, `capitale.soglia` on [0, 79), dipendenti missing; v2: ricavi = 2,000 EUR, unexpected `cessazione.esercizi 3`; v1 on v9: the six correct proposals).

## Retrieval baseline

`npm run rag:index` chunks the three files (illustrative: ~160-character windows, no overlap) and must return the three lett. c) passages with comparable scores for the query "soglia ricavi nomina organo di controllo".

## Regeneration

Produced by a script that asserts every offset above; keep the files, not the script. If a text is edited, re-check the offsets in `manifest.json` and the first two columns of the tables above, and confirm no trailing spaces.
