// npm run golden [-- --layer claims|structure --until <seq>]   (same as: npm run seg5 -- golden)
import { parseArgs, run } from './lib/cli';
import { cmdGolden } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdGolden(args, 'golden'));
