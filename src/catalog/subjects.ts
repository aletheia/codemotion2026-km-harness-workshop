// The subject catalogue of the Claims layer (00-running-example.md §4). A proposal whose subject key is
// not here is unexpected novelty: it goes to the human queue with high priority.
import type { NormalizedValue, SubjectKey } from '../domain/claim';

export type SubjectClass = 'monetary' | 'count' | 'time-limit' | 'reference';

/** Critical classes (promotion criterion 3): a regression on any of these refuses promotion. */
export const CRITICAL_CLASSES: ReadonlySet<SubjectClass> = new Set(['monetary', 'count', 'time-limit']);

export interface Subject {
  readonly key: SubjectKey;
  readonly quantity: string;
  readonly cls: SubjectClass;
  readonly valueType: NormalizedValue['type'];
  readonly unit?: 'years' | 'days' | 'count';
  readonly synonyms: readonly string[];
}

export const SUBJECTS: readonly Subject[] = [
  { key: 'attivo.limite', quantity: 'threshold on total assets', cls: 'monetary', valueType: 'money',
    synonyms: ["totale dell'attivo", 'attivo dello stato patrimoniale'] },
  { key: 'ricavi.limite', quantity: 'threshold on revenues', cls: 'monetary', valueType: 'money',
    synonyms: ['ricavi delle vendite e delle prestazioni', 'ricavi'] },
  { key: 'dipendenti.limite', quantity: 'threshold on average employees', cls: 'count', valueType: 'integer', unit: 'count',
    synonyms: ['dipendenti occupati in media', 'unità'] },
  { key: 'esercizi.consecutivi', quantity: 'years the threshold must be exceeded', cls: 'time-limit', valueType: 'integer', unit: 'years',
    synonyms: ['esercizi consecutivi'] },
  { key: 'cessazione.esercizi', quantity: 'years without exceeding after which the obligation ends', cls: 'time-limit', valueType: 'integer', unit: 'years',
    synonyms: ['cessa quando, per … esercizi'] },
  { key: 'assemblea.termine', quantity: 'days the meeting has to appoint', cls: 'time-limit', valueType: 'integer', unit: 'days',
    synonyms: ['entro trenta giorni'] },
  { key: 'limiti.riferimento', quantity: 'limits defined by reference to another article', cls: 'reference', valueType: 'reference',
    synonyms: ["limiti indicati dal … articolo 2435-bis"] },
];

const byKey = new Map(SUBJECTS.map((s) => [s.key as string, s]));

export const lookupSubject = (key: string): Subject | undefined => byKey.get(key);

export const isCritical = (key: string): boolean => {
  const s = lookupSubject(key);
  return s !== undefined && CRITICAL_CLASSES.has(s.cls);
};

/** The subject whose synonym occurs in the text (longest synonym first); undefined if none does. */
export function subjectBySynonym(text: string): Subject | undefined {
  const lower = text.toLowerCase();
  const candidates = SUBJECTS.flatMap((s) => s.synonyms.map((syn) => ({ s, syn })))
    .filter(({ syn }) => !syn.includes('…'))
    .sort((a, b) => b.syn.length - a.syn.length);
  return candidates.find(({ syn }) => lower.includes(syn.toLowerCase()))?.s;
}
