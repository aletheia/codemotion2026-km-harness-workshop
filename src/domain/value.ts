// Normalized values and the deterministic normalizer. Unsupported forms fail; they are never guessed.
import { hash16 } from './ids';

export type NormalizedValue =
  | { readonly type: 'money'; readonly amount: number; readonly currency: 'EUR' }
  | { readonly type: 'percent'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'enum'; readonly value: string }
  | { readonly type: 'date'; readonly value: string };

export class NormalizationError extends Error {}

/** Stable textual key of a value, used for hashing and equality. */
export function valueKey(v: NormalizedValue): string {
  switch (v.type) {
    case 'money': return `money:${v.amount}:${v.currency}`;
    case 'percent': return `percent:${v.value}`;
    case 'boolean': return `boolean:${v.value}`;
    case 'enum': return `enum:${v.value}`;
    case 'date': return `date:${v.value}`;
  }
}
export const valueHash = (v: NormalizedValue): string => hash16(valueKey(v));
export const valueEquals = (a: NormalizedValue, b: NormalizedValue): boolean => valueKey(a) === valueKey(b);

export function formatValue(v: NormalizedValue): string {
  switch (v.type) {
    case 'money': return `${v.amount.toLocaleString('en-US')} EUR`;
    case 'percent': return `${v.value} %`;
    case 'boolean': return v.value ? 'yes' : 'no';
    case 'enum': return v.value;
    case 'date': return v.value;
  }
}

/** "1.000.000" / "1,000,000" / "2.500,50" / "250,5" / "500" -> number. */
export function parseNumber(raw: string): number {
  const s = raw.replace(/[\s']/g, '');
  if (!/^\d[\d.,]*$/.test(s)) throw new NormalizationError(`unsupported number form "${raw}"`);
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let intPart = s;
  let frac = '';
  if (dots > 0 && commas > 0) {
    const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    intPart = s.slice(0, lastSep);
    frac = s.slice(lastSep + 1);
  } else if (dots + commas === 1) {
    const sep = dots === 1 ? '.' : ',';
    const [a, b] = s.split(sep) as [string, string];
    if (b.length === 3) intPart = a + b; // single separator + 3 digits = thousands
    else { intPart = a; frac = b; }
  } else if (dots + commas > 1) {
    if (dots > 1 && commas > 0) throw new NormalizationError(`ambiguous number form "${raw}"`);
    intPart = s.replace(/[.,]/g, '');
  }
  intPart = intPart.replace(/[.,]/g, '');
  const n = Number(frac ? `${intPart}.${frac}` : intPart);
  if (!Number.isFinite(n)) throw new NormalizationError(`unsupported number form "${raw}"`);
  return n;
}

const NUM = String.raw`(\d[\d.,\s']*\d|\d)`;
const MONEY_AFTER = new RegExp(String.raw`^${NUM}\s*(?:EUR|euro|€)$`, 'i');
const MONEY_BEFORE = new RegExp(String.raw`^(?:EUR|€)\s*${NUM}$`, 'i');
const PERCENT = new RegExp(String.raw`^${NUM}\s*(?:%|per\s?cento)$`, 'i');

export function normalize(text: string): NormalizedValue {
  const t = text.trim();
  let m = MONEY_AFTER.exec(t) ?? MONEY_BEFORE.exec(t);
  if (m) return { type: 'money', amount: parseNumber(m[1]!), currency: 'EUR' };
  m = PERCENT.exec(t);
  if (m) return { type: 'percent', value: parseNumber(m[1]!) };
  throw new NormalizationError(`unsupported value form "${text}" (supported: money in EUR, percent)`);
}
