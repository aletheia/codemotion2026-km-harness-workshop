// Segment 6: the artifact and the expertise-aware agent (read-only over the log).
//   npm run seg6 -- ask --q "franchigia incendio" [--as-of 2024-03-01]
import { UsageError } from '../src/app/errors';
import { parseArgs, run } from './lib/cli';
import { cmdAsk } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
const [cmd] = args._;

void run(() => {
  switch (cmd) {
    case 'ask': return cmdAsk(args, 'seg6.ask');
    default: throw new UsageError('usage: seg6 ask --q "<question>" [--as-of YYYY-MM-DD]');
  }
});
