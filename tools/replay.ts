// npm run replay                           re-fold the whole log from scratch: state summary + hash of CurrentBeliefs
// npm run replay -- --extractor claims@v2  replay the recorded responses of another extractor version:
//                                          appends ClaimProposed events only; CurrentBeliefs does not change
import { replayState } from '../src/app/replay';
import { replayWithExtractor } from '../src/app/replayExtractor';
import { emit, flag, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const ex = flag(args, 'extractor');
  if (ex) {
    const r = replayWithExtractor(ex);
    const per = r.perDocument.map((d) => `${d.documentId} ${d.proposals}`).join(', ');
    return emit('replay', r, `${r.extractor}: appended ${r.appended} line(s) (${per}); ${r.newClaims} new claim(s); log ${r.linesBefore} -> ${r.linesAfter}; earlier lines ${r.earlierLinesUnchanged ? 'unmodified' : 'MODIFIED'}; CurrentBeliefs hash ${r.currentBeliefsUnchanged ? 'unchanged' : 'CHANGED'} (${r.beliefsHashAfter})`, args);
  }
  const s = replayState();
  emit('replay', s, `replayed ${s.events} events: ${s.claims} claims ${JSON.stringify(s.byState)}; ${s.currentBeliefs} current beliefs; hash ${s.beliefsHash}`, args);
});
