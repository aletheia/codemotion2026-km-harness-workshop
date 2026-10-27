// npm run projections-drop
import { parseArgs, run } from './lib/cli';
import { cmdProjectionsDrop } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdProjectionsDrop(args, 'projections-drop'));
