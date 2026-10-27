// npm run drift -- --from claims@v1 --to claims@v2 [--until <seq>]
import { parseArgs, run } from './lib/cli';
import { cmdDrift } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdDrift(args, 'drift'));
