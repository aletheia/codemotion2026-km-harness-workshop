// npm run tail [-- --n 10 | --all]
import { summarize, tail } from '../src/app/query';
import { emit, flag, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text', 'all']);
void run(() => {
  const n = args.flags.all ? 'all' : Number(flag(args, 'n') ?? 10);
  const t = tail(n);
  emit('tail', { total: t.total, events: t.events }, t.events.map(summarize).join('\n') || '(empty log)', args);
});
