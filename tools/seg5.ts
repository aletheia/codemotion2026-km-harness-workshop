// Segment 5: the harness and golden sets (read-only over the log).
//   npm run seg5 -- golden [--layer claims|structure] [--until <seq>]
//   npm run seg5 -- eval --extractor claims@v1 [--summary] [--until <seq>]
//   npm run seg5 -- drift --from claims@v1 --to claims@v2 [--until <seq>]
import { UsageError } from '../src/app/errors';
import { parseArgs, run } from './lib/cli';
import { cmdDrift, cmdEval, cmdGolden } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text', 'summary']);
const [cmd] = args._;

void run(() => {
  switch (cmd) {
    case 'golden': return cmdGolden(args, 'seg5.golden');
    case 'eval': return cmdEval(args, 'seg5.eval');
    case 'drift': return cmdDrift(args, 'seg5.drift');
    default: throw new UsageError('usage: seg5 golden | eval --extractor <name> | drift --from <name> --to <name>');
  }
});
