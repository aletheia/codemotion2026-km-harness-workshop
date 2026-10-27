// Catalogue of known subject keys for Art. 12 ("Franchigie e scoperti").
// UNEXPECTED = a proposed subject that is not in this catalogue.
export type SubjectClass = 'monetary' | 'exclusion' | 'time-limit' | 'other';
export interface CatalogEntry { subjectKey: string; label: string; valueType: 'money' | 'percent'; class: SubjectClass }

export const CATALOG: readonly CatalogEntry[] = [
  { subjectKey: 'fire.deductible', label: 'Franchigia incendio', valueType: 'money', class: 'monetary' },
  { subjectKey: 'theft.deductible', label: 'Franchigia furto', valueType: 'money', class: 'monetary' },
  { subjectKey: 'theft.coinsurance', label: 'Scoperto furto', valueType: 'percent', class: 'monetary' },
  { subjectKey: 'liability.limit', label: 'Massimale responsabilità civile', valueType: 'money', class: 'monetary' },
  { subjectKey: 'hail.deductible', label: 'Franchigia grandine', valueType: 'money', class: 'monetary' },
  { subjectKey: 'weather.coinsurance', label: 'Scoperto eventi atmosferici', valueType: 'percent', class: 'monetary' },
];

export const lookupSubject = (key: string): CatalogEntry | undefined => CATALOG.find((c) => c.subjectKey === key);
export const subjectClassOf = (key: string): SubjectClass => lookupSubject(key)?.class ?? 'other';
export const catalogHas = (key: string): boolean => lookupSubject(key) !== undefined;
