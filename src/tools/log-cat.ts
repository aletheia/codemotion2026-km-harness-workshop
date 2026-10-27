// npm run log:cat [-- --file <events.jsonl>] — the whole log through the tail formatter.
import { config } from '../config';
import { readLog } from '../events/log';
import { argValue, run } from './cli';
import { formatLog } from './tail-format';

await run('log-cat', () => {
  const path = argValue(process.argv.slice(2), 'file') ?? config.paths.log;
  const lines = formatLog(readLog(path));
  if (lines.length) process.stdout.write(lines.join('\n') + '\n');
});
