// npm run tail [-- --n <k>] [-- --once] — `tail -f` of out/events.jsonl through the formatter.
// Survives log:reset: when the file disappears or shrinks it starts again from seq 1.
import { existsSync, readFileSync, watchFile } from 'node:fs';
import { config } from '../config';
import { parseLog } from '../events/log';
import type { LogEvent } from '../events/schema';
import { argValue, hasFlag, run } from './cli';
import { formatTailLine } from './tail-format';

const argv = process.argv.slice(2);
const path = config.paths.log;

await run('tail', () => {
  const n = Number(argValue(argv, 'n') ?? Infinity);
  const seqById = new Map<string, number>();
  let printed = 0;

  const read = (): LogEvent[] => (existsSync(path) ? parseLog(readFileSync(path, 'utf8')) : []);
  const print = (events: readonly LogEvent[]) => {
    for (const e of events) {
      seqById.set(e.eventId, e.seq);
      process.stdout.write(formatTailLine(e, { seqOf: (id) => seqById.get(id) }) + '\n');
    }
  };

  const initial = read();
  for (const e of initial) seqById.set(e.eventId, e.seq);
  print(Number.isFinite(n) ? initial.slice(-n) : initial);
  printed = initial.length;
  if (hasFlag(argv, 'once')) return;

  watchFile(path, { interval: 200 }, () => {
    try {
      const events = read();
      if (events.length < printed) {        // log:reset happened
        seqById.clear();
        printed = 0;
      }
      print(events.slice(printed));
      printed = events.length;
    } catch (err) {
      process.stderr.write(`tail: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  });
});
