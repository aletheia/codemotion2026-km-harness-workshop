// Loading state for read-side commands.
import { readAll } from '../adapters/eventLog';
import { foldEvents, FoldError, type Fold } from '../projections/fold';
import { LogInvalid } from './errors';

export function loadFold(opts: { untilSeq?: number } = {}): Fold {
  try {
    return foldEvents(readAll(), opts);
  } catch (e) {
    if (e instanceof FoldError) throw new LogInvalid(e.message);
    if (e instanceof Error) throw new LogInvalid(e.message);
    throw e;
  }
}

export function requireInitialised(f: Fold): void {
  if (!f.initialised) throw new Error('log is not initialised: run `npm run seg2 -- log-init` first');
}
