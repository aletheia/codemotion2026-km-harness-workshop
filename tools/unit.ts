// npm run unit -- --doc cp-2024 [--section art12]
// Prints the claims extraction unit (what an extractor is allowed to see). Refuses, and records
// ACLRejected, when the structure of the document is not verified.
import { loadFold } from '../src/app/context';
import { unitFor } from '../src/app/propose';
import { emit, need, flag, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const unit = unitFor(loadFold(), need(args, 'doc'), flag(args, 'section') ?? 'art12', { recordRejection: true });
  emit('unit', {
    unit,
    howToPropose: 'npm run propose -- --file <claims.json>   (spans in the file are section-local; the harness adds baseOffset)',
    inputFormat: { unitId: unit.unitId, extractor: { version: '<name@vN>', modelId: '<id>', promptVersion: '<id>' }, claims: [{ subjectKey: '<topic>.<attribute>', valueText: '<as written>', quote: '<verbatim>', span: { start: 0, end: 0 } }] },
  }, `${unit.unitId}  base ${unit.baseOffset}  length ${unit.length}\n${unit.text}`, args);
});
