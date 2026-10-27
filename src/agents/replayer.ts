// Fixture replayer: the only way an agent gets a model response. It never calls a model; a request with no
// recorded response throws FixtureMissing. Fixture: fixtures/llm/<extractor>@<version>/<inputHash>.json.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { hashTuple } from '../domain/hash';

/** What an extractor reads: one node of a verified tree (or, for the one-shot baseline, one comma of the text). */
export interface ExtractionUnit {
  documentId: string;
  version: string;
  path: string;
  text: string;
}

export interface Fixture<R> {
  extractor: string;
  version: string;
  modelId: string;
  promptVersion: string;
  inputHash: string;
  request: unknown;
  response: R;
}

export class FixtureMissing extends Error {
  constructor(readonly file: string) {
    super(`no recorded response at ${file} (the replayer never calls a model)`);
    this.name = 'FixtureMissing';
  }
}

/** inputHash = SHA-256 (16 hex) of the ordered tuple (documentId, version, path, text). */
export const inputHash = (u: ExtractionUnit): string => hashTuple([u.documentId, u.version, u.path, u.text]);

export function replay<R>(extractor: string, version: string, unit: ExtractionUnit, response: z.ZodType<R>, dir: string = config.paths.llmFixtures): Fixture<R> {
  const hash = inputHash(unit);
  const file = join(dir, `${extractor}@${version}`, `${hash}.json`);
  if (!existsSync(file)) throw new FixtureMissing(file);
  const schema = z.object({
    extractor: z.literal(extractor),
    version: z.literal(version),
    modelId: z.string(),
    promptVersion: z.string(),
    inputHash: z.literal(hash),
    request: z.unknown(),
    response,
  });
  return schema.parse(JSON.parse(readFileSync(file, 'utf8'))) as Fixture<R>;
}
