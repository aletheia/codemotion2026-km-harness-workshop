// Re-fold the whole log from scratch and report: proves state is a pure function of the log.
import { readAll } from '../adapters/eventLog';
import { foldEvents } from '../projections/fold';
import { beliefsHash, currentBeliefs } from '../projections/views';
import { LogInvalid } from './errors';

export function replayState() {
  const events = readAll();
  let f;
  try {
    f = foldEvents(events);
    const beliefs = currentBeliefs(f);
    const byState: Record<string, number> = { proposed: 0, verified: 0, contested: 0, superseded: 0 };
    for (const c of f.claims.values()) byState[c.state] = (byState[c.state] ?? 0) + 1;
    return { events: events.length, claims: f.claims.size, byState, currentBeliefs: beliefs.size, beliefsHash: beliefsHash(f) };
  } catch (e) {
    throw new LogInvalid(e instanceof Error ? e.message : String(e));
  }
}
