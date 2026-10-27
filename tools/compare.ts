// npm run compare [-- --doc cp-2025]   (same as: npm run seg3 -- compare)
import { parseArgs, run } from './lib/cli';
import { cmdCompare } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdCompare(args, 'compare'));
