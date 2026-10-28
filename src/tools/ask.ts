// npm run ask:ricavi-2019-04-30 (--at: valid time) | ask:ricavi (now) — the segment-6 question, answered by the
// consuming agent from the projections. The projection process first brings out/projections/ up to date with the
// log (a fold, nothing is appended); the agent then reads the two files and nothing else.
// --subject <key> overrides the subject the question resolves to; --question overrides the question.
// --show-policy prints the policy on the header line, --show-sources the closing sources line: the two on-stage
// commands print one each (fallback/seg6/ask.txt).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ask, formatAsk, SOURCES_LINE, type AskProjections, type AskQuery } from '../agents/ask';
import { config } from '../config';
import { readLog } from '../events/log';
import { buildAll, writeAll } from '../projections/store';
import { argValue, hasFlag, run } from './cli';

const readProjection = <T>(name: string): T => JSON.parse(readFileSync(join(config.paths.projections, `${name}.json`), 'utf8')) as T;

await run('ask', () => {
  const argv = process.argv.slice(2);
  writeAll(buildAll(readLog(config.paths.log)));

  const projections: AskProjections = {
    currentBeliefs: readProjection('CurrentBeliefs'),
    timeline: readProjection('Timeline'),
  };
  const at = argValue(argv, 'at');
  const subjectKey = argValue(argv, 'subject');
  const query: AskQuery = {
    question: argValue(argv, 'question') ?? config.rag.query,
    lineageId: argValue(argv, 'lineage') ?? config.source.lineageId,
    ...(at ? { asOf: at } : {}),
    ...(subjectKey ? { subjectKey } : {}),
  };
  const lines = formatAsk(query, ask(projections, query), { showPolicy: hasFlag(argv, 'show-policy') });
  if (hasFlag(argv, 'show-sources')) lines.push(SOURCES_LINE);
  process.stdout.write(lines.join('\n') + '\n');
});
