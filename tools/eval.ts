// npm run eval -- --extractor claims@v1 [--summary] [--until <seq>]
import { parseArgs, run } from './lib/cli';
import { cmdEval } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text', 'summary']);
void run(() => cmdEval(args, 'eval'));
