// Segment 4: the log is the source of truth; everything else is a projection.
//   npm run seg4 -- log-cat [--chain <seq|superseded>]
//   npm run seg4 -- projections-drop | projections-build | projections-diff
//   npm run seg4 -- replay --extractor claims@v2
//   npm run seg4 -- beliefs [--at 2024-03-01 | --seq N]
import { UsageError } from '../src/app/errors';
import { replayWithExtractor } from '../src/app/replayExtractor';
import { emit, need, parseArgs, run } from './lib/cli';
import { cmdBeliefs, cmdLogCat, cmdProjectionsBuild, cmdProjectionsDiff, cmdProjectionsDrop } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
const [cmd] = args._;

void run(() => {
  switch (cmd) {
    case 'log-cat': return cmdLogCat(args, 'seg4.log-cat');
    case 'projections-drop': return cmdProjectionsDrop(args, 'seg4.projections-drop');
    case 'projections-build': return cmdProjectionsBuild(args, 'seg4.projections-build');
    case 'projections-diff': return cmdProjectionsDiff(args, 'seg4.projections-diff');
    case 'beliefs': return cmdBeliefs(args, 'seg4.beliefs');
    case 'replay': {
      const r = replayWithExtractor(need(args, 'extractor'));
      return emit('seg4.replay', r, `${r.extractor}: appended ${r.appended} line(s); earlier lines ${r.earlierLinesUnchanged ? 'unmodified' : 'MODIFIED'}; CurrentBeliefs ${r.currentBeliefsUnchanged ? 'unchanged' : 'CHANGED'}`, args);
    }
    default: throw new UsageError('usage: seg4 log-cat | projections-drop | projections-build | projections-diff | beliefs | replay --extractor <name>');
  }
});
