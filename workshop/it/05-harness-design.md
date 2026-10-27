# Design dell'harness

Traduzione italiana di `05-harness-design.md`; in caso di divergenza prevale l'inglese.

"Documents Are Not Knowledge" · Codemotion Milan 2026 · revisione 4, 27 ott 2026. Specifica compatta derivata dal capitolo 6 dell'handbook e dalle decisioni in AGENT.md (7–9); il ragionamento è nell'handbook, questo file è ciò che il repository implementa sotto `src/harness/`. Esempio di riferimento: art. 2477 c.c. (`00-running-example.md`). Ogni soglia è illustrativa e vive in `config.ts`.

## 1. Golden set: una query sul log

Golden set del livello L alla versione k = tutti gli eventi di decisione del livello L il cui attore è umano, fino alla sequenza di cut-off `untilSeq`. Esclusi: le decisioni con attore harness e import (circolari); gli elementi i cui id compaiono nel manifest dell'estrattore `promptExampleIds` (altrimenti la sonda misura il recall del prompt, non dell'estrattore). Riproducibile: la stessa query sulla stessa porzione di log restituisce lo stesso insieme; la versione è la coppia (livello, untilSeq).

| Livello | Input dell'elemento del golden set | Atteso | Chiave di allineamento | Confronto |
| --- | --- | --- | --- | --- |
| structure | (document id, versione) | albero delle sezioni | percorso della sezione | uguaglianza di tipo per nodo; IoU degli intervalli ≥ θ per nodo |
| claims | id della sezione `StructureVerified` | insieme di (chiave di soggetto, valore normalizzato, span, tolleranza) | chiave di soggetto | uguaglianza del valore normalizzato; IoU dello span ≥ θ |
| entities | insieme di id di claim verified | coppie (claim id, entity id) | la coppia | corrispondenza esatta |
| policies | (entity id, lineage) | triple condizione / effetto / eccezione | (entità, elemento) | uguaglianza tipizzata degli elementi; id delle claim riferite |
| workflow | (caso d'uso, lineage) | passi ordinati + output atteso su un input di test | posizione | uguaglianza dei passi; uguaglianza dell'output |

Due modalità: offline (tutto l'insieme; decide la promozione; gira a ogni cambio di estrattore o di prompt) e sonde online (k elementi inseriti in ogni batch di produzione; decide segnale o rumore per batch).

Nel log del workshop il golden set di Claims ha quattro elementi dopo il segmento 2 (le claim verificate dall'umano sul comma 2 della v8: `esercizi.consecutivi` 2, `attivo.limite` 2.000.000 EUR, `ricavi.limite` 2.000.000 EUR, `dipendenti.limite` 10) e sette dopo il segmento 3 (le tre risoluzioni umane dei conflitti della v9: `attivo.limite` 4.000.000, `ricavi.limite` 4.000.000, `dipendenti.limite` 20). L'eval del segmento 5 usa il cut-off dopo il segmento 2.

## 2. Metriche (livello Claims; gli altri cambiano solo chiave e confronto)

1. Allineamento: per ogni elemento atteso, la proposta con la stessa chiave di soggetto; se più d'una → la più alta IoU di span, le altre restano non allineate.
2. Classificazione di ogni coppia: valore corretto (uguaglianza normalizzata) e provenienza corretta (IoU ≥ θ, θ = 0,8 illustrativo, intervalli semiaperti) → corretta; altrimenti valore errato o provenienza errata.
3. Conteggio: coppia corretta = VP; coppia non corretta = FP + FN; atteso non accoppiato = FN; proposta non accoppiata = FP.
4. Micro-media su tutti gli elementi del golden set: precision = VP/(VP+FP), recall = VP/(VP+FN).

Esempio svolto (comma 2 della v8, in vigore dal 16 marzo 2019, quattro attesi): claims@v1 → `attivo.limite` corretta (IoU 62/64 = 0,97), `ricavi.limite` corretta (IoU 1,00), `esercizi.consecutivi` valore errato (3 invece di 2, span giusto), `dipendenti.limite` mancante, più una `capitale.soglia` inattesa che il catalogo non risolve → VP 2, FP 2, FN 2, P 0,50, R 0,50; claims@v2 → attivo, esercizi e dipendenti corrette, `ricavi.limite` valore errato (2.000 EUR: "milioni" perso nella normalizzazione), più una `cessazione.esercizi` inattesa fuori dall'unità → VP 3, FP 2, FN 1, P 0,60, R 0,75.

## 3. Deriva: per elemento, mai per aggregato

Entrambe le versioni sulla stessa versione del golden set; ogni elemento atteso cade in una cella di {stabile, regressione, miglioramento, stabile-errato}. In più: proposte presenti in v2 e assenti in v1 = rumore introdotto; coppie corrette in entrambe con IoU che scende sotto θ in v2 = deriva di provenienza. Nell'esempio: `attivo.limite` stabile, `ricavi.limite` regressione (2.000 EUR), `esercizi.consecutivi` miglioramento, `dipendenti.limite` miglioramento. Gli aggregati sono migliorati (+0,10, +0,25) mentre un elemento monetario è regredito.

## 4. Criteri di promozione (offline) — devono valere tutti e quattro

| # | Criterio | Valore illustrativo | Esempio v2 |
| --- | --- | --- | --- |
| 1 | precision(v2) ≥ soglia del livello | 0,90 | fallisce (0,60) |
| 2 | recall(v2) ≥ recall(v1) − ε | ε = 0,02 | vale (0,75 ≥ 0,48) |
| 3 | regressioni sul sottoinsieme critico = 0 | sottoinsieme = monetary, count, time-limit | fallisce (`ricavi.limite`, monetary) |
| 4 | coppie con provenienza errata ≤ 2 % delle coppie con valore corretto | 2 % | vale |

Superato → `ExtractorVersionPromoted` con i quattro valori come evidenza; la proiezione della versione diventa quella promossa. Fallito → non viene emesso nulla; le proposte v2 restano nel log etichettate v2; l'harness non le usa mai per la riconferma.

## 5. Gate dei batch (sonde online) e regola di decisione sull'output degli agenti

k = 5 % della dimensione del batch, con un minimo tale che gli elementi attesi delle sonde siano almeno 10 (illustrativo). A conteggio, perché i tassi su 3–10 elementi sono instabili: superato se e solo se FN ≤ 1 e FP ≤ 1 sugli elementi sonda ed errori critici = 0.

Regola di decisione: un batch che supera il gate è segnale — le sue proposte di classe A possono essere riconfermate dall'harness; la classe B resta proposed; la classe C è contestata. Un batch che fallisce è rumore — `BatchRejected` con i conteggi delle sonde come evidenza; ogni proposta del batch resta proposed e va in coda umana. L'output dell'agente non è mai verificato dall'agente; l'harness verifica solo in classe A e solo su evidenza già presente nel log.

Avvio a freddo (revisione 4 del run sheet, da confermare): finché il golden set del livello è sotto il minimo delle sonde, il gate non è applicabile, la classe A è decisa dal solo comparatore e il campionamento di audit delle riconferme di classe A è al 100 %. L'output di `compare` stampa esplicitamente questo stato; nel workshop è lo stato del batch v9 (golden set di quattro elementi, una sezione).

## 6. Coinvolgimento umano — il comparatore a tre classi

Passi deterministici: risolvi il lineage → canonicalizza il soggetto tramite il catalogo (non risolto = novità inattesa, coda ad alta priorità — `capitale.soglia` nell'esempio) → cerca (lineage, soggetto) in CurrentBeliefs → assente = B, valore uguale = A, valore diverso = C → in classe A entro la stessa versione del documento richiedi anche IoU dello span ≥ θ. Sulle sei proposte della v9: `esercizi.consecutivi` 2 è A; `attivo.limite`, `ricavi.limite`, `dipendenti.limite` sono C; `cessazione.esercizi` e `assemblea.termine` sono B. I livelli Policies e Workflow sono sempre B o C. Costo umano illustrativo su un documento da 300 claim, revisione completa contro regola delle tre classi: 300 contro 300 (nessun prior), 300 contro 60 (prior da sistema di riferimento, es. il registro di compliance dell'azienda), 300 contro 50 (una nuova versione del testo), 300 contro 12 (estrattore v2). Costo dichiarato: un errore umano iniziale viene riconfermato a ogni riproiezione se non intercettato dal campionamento o superato.

## 7. Tipi (TypeScript, `src/harness/`)

```ts
export interface GoldenItem<TExpected> {
  readonly inputArtifactId: string;         // for claims: the StructureVerified section id (e.g. c2 of v8)
  readonly expected: readonly TExpected[];
  readonly provenance: { readonly verifiedBy: string; readonly seq: number; readonly goldenSetVersion: string };
}
export interface ExpectedClaim {
  readonly subjectKey: SubjectKey;          // 'ricavi.limite'
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
  readonly tolerance?: { readonly iou: number };
}
export type PairOutcome = 'correct' | 'wrong-value' | 'wrong-provenance';
export interface AlignedPair { readonly expected: ExpectedClaim; readonly proposal?: Claim; readonly iou?: number; readonly outcome?: PairOutcome }
export interface Counts { readonly tp: number; readonly fp: number; readonly fn: number }
export interface Metrics extends Counts { readonly precision: number; readonly recall: number }
export type DriftCell = 'stable' | 'regression' | 'improvement' | 'stable-wrong';
export interface DriftRow { readonly subjectKey: SubjectKey; readonly v1: PairOutcome | 'missing'; readonly v2: PairOutcome | 'missing'; readonly cell: DriftCell; readonly critical: boolean }
export type CriticalClass = 'monetary' | 'count' | 'time-limit';   // critical subset: attivo/ricavi, dipendenti, esercizi/cessazione/termine
export interface PromotionResult { readonly promoted: boolean; readonly failedCriteria: readonly (1 | 2 | 3 | 4)[] }
export type GateResult =
  | { readonly kind: 'passed'; readonly counts: Counts }
  | { readonly kind: 'rejected'; readonly counts: Counts; readonly criticalErrors: number }
  | { readonly kind: 'not-applicable'; readonly goldenItems: number; readonly minimum: number };   // cold start
export type ComparatorClass = 'A' | 'B' | 'C' | 'UNEXPECTED';

export declare function goldenSet(log: readonly ClaimEvent[], layer: Layer, untilSeq: number,
  opts: { excludePromptExampleIds: readonly string[] }): readonly GoldenItem<ExpectedClaim>[];
export declare function evaluate(golden: readonly GoldenItem<ExpectedClaim>[], proposals: readonly Claim[],
  opts: { thetaIoU: number }): { pairs: readonly AlignedPair[]; metrics: Metrics };
export declare function drift(a: readonly AlignedPair[], b: readonly AlignedPair[]): readonly DriftRow[];
export declare function promotion(prev: Metrics, next: Metrics, rows: readonly DriftRow[], cfg: PromotionConfig): PromotionResult;
export declare function batchGate(probes: readonly AlignedPair[], cfg: GateConfig): GateResult;
export declare function compare(proposal: Claim, beliefs: ReadonlyMap<BeliefKey, Belief>, catalog: Catalog,
  opts: { thetaIoU: number }): { cls: ComparatorClass; evidence: Record<string, unknown> };
```

Ogni funzione qui sopra è pura e coperta da test unitari; gli agenti sono l'unico componente non deterministico e sono riprodotti da fixture, quindi `npm run dry-run` è identico byte per byte a ogni esecuzione.
