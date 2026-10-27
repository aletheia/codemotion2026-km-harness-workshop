// npm run log-cat [-- --chain <seq|superseded>]   (same as: npm run seg4 -- log-cat)
import { parseArgs, run } from './lib/cli';
import { cmdLogCat } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdLogCat(args, 'log-cat'));
