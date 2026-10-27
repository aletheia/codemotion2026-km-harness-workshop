import { describe, expect, it } from 'vitest';
import { claimLabel, LABEL_TABLE } from '../src/catalog/labels';
import { displayValue, normalize, NormalizationError } from '../src/catalog/normalizer';
import { isCritical, lookupSubject, subjectBySynonym } from '../src/catalog/subjects';
import { deriveClaimId } from '../src/domain/claim';
import { documentId } from '../src/domain/ids';

describe('normalizer', () => {
  it.each([
    ['2 milioni di euro', { type: 'money', amount: 2_000_000, currency: 'EUR' }],
    ['4 milioni di euro', { type: 'money', amount: 4_000_000, currency: 'EUR' }],
    ['2.000 euro', { type: 'money', amount: 2_000, currency: 'EUR' }],
    ['10 unità', { type: 'integer', value: 10, unit: 'count' }],
    ['due esercizi', { type: 'integer', value: 2, unit: 'years' }],
    ['tre esercizi', { type: 'integer', value: 3, unit: 'years' }],
    ['trenta giorni', { type: 'integer', value: 30, unit: 'days' }],
  ])('%s', (surface, expected) => {
    expect(normalize(surface)).toEqual(expected);
  });

  it('takes the unit from the catalogue entry when the surface has none', () => {
    expect(normalize('20', lookupSubject('dipendenti.limite'))).toEqual({ type: 'integer', value: 20, unit: 'count' });
    expect(normalize('2', lookupSubject('ricavi.limite'))).toEqual({ type: 'money', amount: 2, currency: 'EUR' });
  });

  it('keeps a subject outside the catalogue as an enum, and refuses a catalogue quantity without a number', () => {
    expect(normalize('minimo s.p.a.')).toEqual({ type: 'enum', value: 'minimo s.p.a.' });
    expect(() => normalize('alcuni', lookupSubject('attivo.limite'))).toThrow(NormalizationError);
  });

  it('formats values for the screen', () => {
    expect(displayValue(normalize('2 milioni di euro'))).toBe('2,000,000 EUR');
    expect(displayValue(normalize('10 unità'))).toBe('10');
    expect(displayValue(normalize('trenta giorni'))).toBe('30 days');
  });
});

describe('subject catalogue', () => {
  it('marks monetary, count and time-limit as critical, reference not; capitale.soglia is unknown', () => {
    for (const k of ['attivo.limite', 'ricavi.limite', 'dipendenti.limite', 'esercizi.consecutivi', 'cessazione.esercizi', 'assemblea.termine']) {
      expect(isCritical(k)).toBe(true);
    }
    expect(isCritical('limiti.riferimento')).toBe(false);
    expect(lookupSubject('capitale.soglia')).toBeUndefined();
  });

  it('resolves synonyms, longest first', () => {
    expect(subjectBySynonym("totale dell'attivo dello stato patrimoniale")?.key).toBe('attivo.limite');
    expect(subjectBySynonym('ricavi delle vendite e delle prestazioni')?.key).toBe('ricavi.limite');
    expect(subjectBySynonym('dipendenti occupati in media')?.key).toBe('dipendenti.limite');
  });
});

describe('labels', () => {
  const id = (version: string, key: string, surface: string) =>
    [version, key, normalize(surface), deriveClaimId(documentId('cc-art2477'), version, key as `${string}.${string}`, normalize(surface))] as const;
  const label = (producer: string, version: string, key: string, surface: string) => {
    const [v, k, value, claimId] = id(version, key, surface);
    return claimLabel(producer, v, k, value, claimId);
  };

  it('follows the table of AGENTS.md §13', () => {
    expect(label('claims@v1', 'v8', 'attivo.limite', '2 milioni di euro')).toBe('clm-attivo2m');
    expect(label('claims@v1', 'v8', 'ricavi.limite', '2 milioni di euro')).toBe('clm-ricavi2m');
    expect(label('claims@v1', 'v8', 'esercizi.consecutivi', 'tre esercizi')).toBe('clm-eserc3');
    expect(label('claims@v1', 'v8', 'capitale.soglia', 'minimo s.p.a.')).toBe('clm-capitale');
    expect(label('human', 'v8', 'esercizi.consecutivi', 'due esercizi')).toBe('clm-eserc2');
    expect(label('human', 'v8', 'dipendenti.limite', '10 unità')).toBe('clm-dip10');
    expect(label('claims@v1', 'v9', 'esercizi.consecutivi', 'due esercizi')).toBe('clm-eserc2b');
    expect(label('claims@v1', 'v9', 'assemblea.termine', 'trenta giorni')).toBe('clm-term30');
    expect(label('claims@v2', 'v8', 'ricavi.limite', '2.000 euro')).toBe('clm-v2-ricavi2k');
    expect(label('claims@v2', 'v8', 'cessazione.esercizi', 'tre esercizi')).toBe('clm-v2-cess3a');
    expect(label('claims@v2', 'v9', 'dipendenti.limite', '20 unità')).toBe('clm-v2-dip20');
  });

  it('labels are unique and depend on the producer', () => {
    expect(new Set(LABEL_TABLE.map((r) => r[4])).size).toBe(LABEL_TABLE.length);
    expect(label('human', 'v8', 'attivo.limite', '2 milioni di euro')).not.toBe('clm-attivo2m');
  });

  it('falls back to clm-<first 8 hex of claimId>', () => {
    const [, , value, claimId] = id('v8', 'attivo.limite', '3 milioni di euro');
    expect(claimLabel('claims@v1', 'v8', 'attivo.limite', value, claimId)).toBe(`clm-${claimId.slice(0, 8)}`);
  });
});
