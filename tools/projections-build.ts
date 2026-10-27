// npm run projections-build
import { parseArgs, run } from './lib/cli';
import { cmdProjectionsBuild } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdProjectionsBuild(args, 'projections-build'));
