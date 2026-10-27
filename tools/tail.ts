// npm run tail [-- --n 10 | --all] [--jsonl]   (--jsonl prints the raw event lines, one per line)
import { summarize, tail } from '../src/app/query';
import { emit, flag, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text', 'all', 'jsonl']);
void run(() => {
  const n = args.flags.all ? 'all' : Number(flag(args, 'n') ?? 10);
  const t = tail(n);
  if (args.flags.jsonl) { process.stdout.write(t.events.map((e) => JSON.stringify(e)).join('\n') + (t.events.length ? '\n' : '')); return; }
  emit('tail', { total: t.total, events: t.events }, t.events.map(summarize).join('\n') || '(empty log)', args);
});
