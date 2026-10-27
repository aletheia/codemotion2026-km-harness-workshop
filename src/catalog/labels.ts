// Display labels of claims (AGENTS.md §13): fixed by producer, document version, subject and value,
// so the same proposal always gets the same label on screen. Anything outside the table falls back to
// clm-<first 8 hex of claimId>.
import { canonicalValue, type NormalizedValue } from '../domain/claim';

/** 'claims@v1' | 'claims@v2' for agents, 'human' for the reviewer. */
export type LabelProducer = string;

const money = (amount: number): NormalizedValue => ({ type: 'money', amount, currency: 'EUR' });
const years = (value: number): NormalizedValue => ({ type: 'integer', value, unit: 'years' });
const count = (value: number): NormalizedValue => ({ type: 'integer', value, unit: 'count' });
const days = (value: number): NormalizedValue => ({ type: 'integer', value, unit: 'days' });

type Row = readonly [producer: LabelProducer, version: string, subjectKey: string, value: NormalizedValue | '*', label: string];

const V9_SIX = (producer: LabelProducer, prefix: string): Row[] => [
  [producer, 'v9', 'esercizi.consecutivi', years(2), `${prefix}eserc2b`],
  [producer, 'v9', 'attivo.limite', money(4_000_000), `${prefix}attivo4m`],
  [producer, 'v9', 'ricavi.limite', money(4_000_000), `${prefix}ricavi4m`],
  [producer, 'v9', 'dipendenti.limite', count(20), `${prefix}dip20`],
  [producer, 'v9', 'cessazione.esercizi', years(3), `${prefix}cess3`],
  [producer, 'v9', 'assemblea.termine', days(30), `${prefix}term30`],
];

export const LABEL_TABLE: readonly Row[] = [
  ['claims@v1', 'v8', 'attivo.limite', money(2_000_000), 'clm-attivo2m'],
  ['claims@v1', 'v8', 'ricavi.limite', money(2_000_000), 'clm-ricavi2m'],
  ['claims@v1', 'v8', 'esercizi.consecutivi', years(3), 'clm-eserc3'],
  ['claims@v1', 'v8', 'capitale.soglia', '*', 'clm-capitale'],
  ['human', 'v8', 'esercizi.consecutivi', years(2), 'clm-eserc2'],
  ['human', 'v8', 'dipendenti.limite', count(10), 'clm-dip10'],
  ...V9_SIX('claims@v1', 'clm-'),
  ['claims@v2', 'v8', 'attivo.limite', money(2_000_000), 'clm-v2-attivo2m'],
  ['claims@v2', 'v8', 'esercizi.consecutivi', years(2), 'clm-v2-eserc2'],
  ['claims@v2', 'v8', 'dipendenti.limite', count(10), 'clm-v2-dip10'],
  ['claims@v2', 'v8', 'ricavi.limite', money(2_000), 'clm-v2-ricavi2k'],
  ['claims@v2', 'v8', 'cessazione.esercizi', years(3), 'clm-v2-cess3a'],
  ...V9_SIX('claims@v2', 'clm-v2-'),
];

export function claimLabel(producer: LabelProducer, version: string, subjectKey: string, value: NormalizedValue, claimId: string): string {
  const row = LABEL_TABLE.find(([p, v, k, val]) =>
    p === producer && v === version && k === subjectKey && (val === '*' || canonicalValue(val) === canonicalValue(value)));
  return row?.[4] ?? `clm-${claimId.slice(0, 8)}`;
}

/** The producer column of the table for an actor: the extractor version for agents, 'human' for the reviewer. */
export const labelProducer = (actor: { kind: string; extractorVersion?: string }): LabelProducer =>
  actor.kind === 'agent' && actor.extractorVersion ? actor.extractorVersion : actor.kind;
