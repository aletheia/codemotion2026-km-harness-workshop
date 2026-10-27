// npm run projections-diff [-- --from claims@v1 --to claims@v2 --doc cp-2024]
import { parseArgs, run } from './lib/cli';
import { cmdProjectionsDiff } from './lib/commands';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => cmdProjectionsDiff(args, 'projections-diff'));
