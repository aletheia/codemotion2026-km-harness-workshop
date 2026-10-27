import { createHash } from 'node:crypto';

/** SHA-256 of the input, truncated to 16 hex characters: the only hash used for ids. */
export function sha256_16(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

/** Hash of an ordered tuple; JSON encoding keeps field boundaries unambiguous. */
export function hashTuple(parts: readonly (string | number | null)[]): string {
  return sha256_16(JSON.stringify(parts));
}
