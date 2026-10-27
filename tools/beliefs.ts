// npm run beliefs [-- --at YYYY-MM-DD | --seq N]   --at is VALID time, --seq is TRANSACTION time
import { parseArgs, run } from './lib/cli';
import { cmdBeliefs } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdBeliefs(args, 'beliefs'));
