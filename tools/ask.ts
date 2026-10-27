// npm run ask -- --q "franchigia incendio" [--as-of YYYY-MM-DD]   (as-of is VALID time; same as: npm run seg6 -- ask ...)
import { parseArgs, run } from './lib/cli';
import { cmdAsk } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdAsk(args, 'ask'));
