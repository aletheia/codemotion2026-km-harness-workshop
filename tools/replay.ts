// npm run replay
// Re-folds the whole log from scratch and prints a state summary + hash of CurrentBeliefs.
import { replayState } from '../src/app/replay';
import { emit, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const s = replayState();
  emit('replay', s, `replayed ${s.events} events: ${s.claims} claims ${JSON.stringify(s.byState)}; ${s.currentBeliefs} current beliefs; hash ${s.beliefsHash}`, args);
});
