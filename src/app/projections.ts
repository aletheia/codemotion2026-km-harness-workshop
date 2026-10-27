// The only projection that is written to disk is CurrentBeliefs (projections/current-beliefs.json).
// It is a pure function of the log: dropping and rebuilding it must give the same hash.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectionsDir, stateDir } from '../adapters/paths';
import { removeFile, writeTextFile } from '../adapters/files';
import { beliefJson, beliefsHash, currentBeliefs } from '../projections/views';
import { loadFold } from './context';

const beliefsFile = (): string => join(projectionsDir(), 'current-beliefs.json');
const droppedFile = (): string => join(stateDir(), 'projection-dropped.json');

interface ProjectionFile { builtFromEvents: number; hash: string; beliefs: unknown[] }

export function projectionsDrop() {
  const f = loadFold();
  const file = beliefsFile();
  let hash = beliefsHash(f);
  let source: 'file' | 'log' = 'log'; // no file on disk: the hash to compare against is computed from the log
  const had = existsSync(file);
  if (had) { hash = (JSON.parse(readFileSync(file, 'utf8')) as ProjectionFile).hash; source = 'file'; }
  writeTextFile(droppedFile(), `${JSON.stringify({ hash, source })}\n`);
  removeFile(file);
  return { dropped: had, file: 'projections/current-beliefs.json', hashBeforeDrop: hash, hashSource: source };
}

export function projectionsBuild() {
  const f = loadFold();
  const rows = [...currentBeliefs(f).values()].map(beliefJson).sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  const hash = beliefsHash(f);
  writeTextFile(beliefsFile(), `${JSON.stringify({ builtFromEvents: f.lastSeq, hash, beliefs: rows } satisfies ProjectionFile, null, 2)}\n`);
  let matchesDropped: boolean | null = null;
  let before: { hash: string; source: string } | null = null;
  if (existsSync(droppedFile())) {
    before = JSON.parse(readFileSync(droppedFile(), 'utf8')) as { hash: string; source: string };
    matchesDropped = before.hash === hash;
    removeFile(droppedFile());
  }
  return { file: 'projections/current-beliefs.json', builtFromEvents: f.lastSeq, currentBeliefs: rows.length, hash, hashBeforeDrop: before?.hash ?? null, hashSource: before?.source ?? null, matchesDropped };
}
