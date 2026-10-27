import { buildEvent } from '../events/build';
import { config } from '../config';
import { commit } from './commit';
import { Rejection } from './errors';
import { loadFold } from './context';
import { humanActor, processActor } from './actors';
import { asEventId } from '../domain/ids';

export const BOOTSTRAP_EXTRACTOR = 'claims@v1';

/** LogInitialised + the bootstrap ExtractorVersionPromoted(claims@v1, human, "initial version"). */
export function logInit() {
  const f = loadFold();
  if (f.initialised) throw new Rejection('log is already initialised (use `npm run reset` for a clean demo)');
  const init = buildEvent({
    type: 'LogInitialised', aggregateId: 'log', actor: processActor('log-init'), inputArtifactId: 'log',
    causationId: null, correlationId: 'bootstrap', payload: { logId: 'casa-protetta-demo', format: 'events-jsonl-v1' },
  });
  const promoted = buildEvent({
    type: 'ExtractorVersionPromoted', aggregateId: 'extractor:claims', actor: humanActor(), inputArtifactId: init.eventId,
    causationId: asEventId(init.eventId), correlationId: 'bootstrap',
    payload: { extractor: 'claims', version: BOOTSTRAP_EXTRACTOR, previous: null },
    evidence: { kind: 'human', note: 'initial version' },
  });
  const out = commit([init, promoted]);
  return { lineageId: config.lineageId, events: out };
}
