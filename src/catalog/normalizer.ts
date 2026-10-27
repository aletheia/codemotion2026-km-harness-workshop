// Surface value → NormalizedValue. Pure; Italian number words and amounts as they occur in art. 2477.
//   "2 milioni di euro" → money 2000000 EUR      "10 unità"      → integer 10 count
//   "due esercizi"      → integer 2 years         "trenta giorni" → integer 30 days
// The unit comes from the surface word when there is one, else from the catalogue entry (hint).
// A subject outside the catalogue with no recognisable number is kept as an enum of the trimmed text.
import type { NormalizedValue } from '../domain/claim';
import type { Subject } from './subjects';

export class NormalizationError extends Error {
  constructor(readonly surface: string, detail: string) {
    super(`cannot normalize "${surface}": ${detail}`);
    this.name = 'NormalizationError';
  }
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, novanta: 90, cento: 100,
};

const MULTIPLIERS: Readonly<Record<string, number>> = { mila: 1_000, migliaia: 1_000, milione: 1_000_000, milioni: 1_000_000, miliardi: 1_000_000_000 };

// Whole tokens, not regex word boundaries: \b does not see "à" as a letter.
const UNIT_WORDS: Readonly<Record<string, 'years' | 'days' | 'count'>> = {
  esercizio: 'years', esercizi: 'years', anno: 'years', anni: 'years',
  giorno: 'days', giorni: 'days',
  unità: 'count', dipendenti: 'count',
};

/** "2", "2.000" (Italian thousands), "2,5" (Italian decimals), or a number word. */
function parseNumber(token: string): number | undefined {
  if (/^\d{1,3}(\.\d{3})+$/u.test(token)) return Number(token.replaceAll('.', ''));
  if (/^\d+(,\d+)?$/u.test(token)) return Number(token.replace(',', '.'));
  return NUMBER_WORDS[token];
}

export function normalize(surface: string, hint?: Pick<Subject, 'valueType' | 'unit'>): NormalizedValue {
  const text = surface.trim().toLowerCase();
  const tokens = text.split(/[\s:;]+/u).filter(Boolean);
  const i = tokens.findIndex((t) => parseNumber(t) !== undefined);

  if (i < 0) {
    if (hint === undefined || hint.valueType === 'enum') return { type: 'enum', value: surface.trim() };
    throw new NormalizationError(surface, `no number for a ${hint.valueType} value`);
  }

  let n = parseNumber(tokens[i]!)!;
  const multiplier = MULTIPLIERS[tokens[i + 1] ?? ''];
  if (multiplier !== undefined) n *= multiplier;

  if (tokens.some((t) => t === 'euro' || t === 'eur' || t === '€') || hint?.valueType === 'money') return { type: 'money', amount: n, currency: 'EUR' };

  if (!Number.isInteger(n)) throw new NormalizationError(surface, 'not an integer');
  const unit = tokens.map((t) => UNIT_WORDS[t]).find((u) => u !== undefined) ?? hint?.unit;
  return unit === undefined ? { type: 'integer', value: n } : { type: 'integer', value: n, unit };
}

/**
 * Why two amounts differ, when the difference is a lost multiplier: the actual amount is the expected one
 * divided by a power of 1,000 and the expected surface carries a multiplier word ("2 milioni di euro" read
 * as 2,000 EUR → '"milioni" dropped'). Undefined for any other difference.
 */
export function droppedMultiplier(expected: NormalizedValue, actual: NormalizedValue, expectedSurface: string): string | undefined {
  if (expected.type !== 'money' || actual.type !== 'money' || actual.amount <= 0 || actual.amount >= expected.amount) return undefined;
  let ratio = expected.amount / actual.amount;
  while (ratio > 1 && Number.isInteger(ratio / 1_000)) ratio /= 1_000;
  if (ratio !== 1) return undefined;
  const word = expectedSurface.toLowerCase().split(/[\s:;]+/u).find((t) => MULTIPLIERS[t] !== undefined);
  return word === undefined ? undefined : `"${word}" dropped`;
}

/** On-screen form: "2,000,000 EUR", "2 years", "10", "minimo s.p.a.". */
export function displayValue(v: NormalizedValue): string {
  switch (v.type) {
    case 'money': return `${v.amount.toLocaleString('en-US')} ${v.currency}`;
    case 'integer': return v.unit === undefined || v.unit === 'count' ? String(v.value) : `${v.value} ${v.unit}`;
    case 'percent': return `${v.value} %`;
    case 'reference': return `→ ${v.lineageId}`;
    default: return String(v.value);
  }
}

/** Form in belief and diff tables: money with its currency, integers bare, days in Italian ("30 giorni"). */
export const tableValue = (v: NormalizedValue): string => (v.type === 'money' ? displayValue(v) : shortValue(v));

/** Compact form for tables and conflict evidence: "2,000,000", "10", "2", "30 giorni" (days keep the Italian word). */
export function shortValue(v: NormalizedValue): string {
  if (v.type === 'money') return v.amount.toLocaleString('en-US');
  if (v.type === 'integer') return v.unit === 'days' ? `${v.value} giorni` : String(v.value);
  return displayValue(v);
}
