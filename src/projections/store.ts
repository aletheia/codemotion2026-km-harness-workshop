// out/projections/: one JSON file per projection, written by projections:build, removed by projections:drop.
// Nothing here is state: every file is a fold of out/events.jsonl and can be deleted at any time.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { sha256_16 } from '../domain/hash';
import type { LogEvent } from '../events/schema';
import { claimsByDocumentVersion } from './claimsByDocumentVersion';
import { conflictQueue } from './conflictQueue';
import { currentBeliefs } from './currentBeliefs';
import { reviewQueue } from './reviewQueue';
import { timeline } from './timeline';

export const PROJECTIONS = {
  CurrentBeliefs: currentBeliefs,
  ClaimsByDocumentVersion: claimsByDocumentVersion,
  ConflictQueue: conflictQueue,
  ReviewQueue: reviewQueue,
  Timeline: timeline,
} as const;

export type ProjectionName = keyof typeof PROJECTIONS;
export const PROJECTION_NAMES = Object.keys(PROJECTIONS) as ProjectionName[];

/** Fixed serialization (2-space JSON, trailing newline): same log, same bytes, same hash. */
const serialize = (data: unknown): string => JSON.stringify(data, null, 2) + '\n';

/** First 6 hex of SHA-256 over a projection's file content: equal after drop + build. */
export const projectionHash = (text: string): string => sha256_16(text).slice(0, 6);

export interface Built {
  readonly files: Record<ProjectionName, string>;     // name → serialized content
}

export function buildAll(events: readonly LogEvent[]): Built {
  const files = {} as Record<ProjectionName, string>;
  for (const name of PROJECTION_NAMES) files[name] = serialize(PROJECTIONS[name](events));
  return { files };
}

export function writeAll(built: Built, dir: string = config.paths.projections): void {
  mkdirSync(dir, { recursive: true });
  for (const name of PROJECTION_NAMES) writeFileSync(join(dir, `${name}.json`), built.files[name], 'utf8');
}

/** Removes every projection file (idempotent: a missing file is already dropped); returns the names. */
export function dropAll(dir: string = config.paths.projections): ProjectionName[] {
  for (const name of PROJECTION_NAMES) {
    const file = join(dir, `${name}.json`);
    if (existsSync(file)) rmSync(file);
  }
  return PROJECTION_NAMES;
}
