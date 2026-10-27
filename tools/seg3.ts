// Segment 3: edition 2025, the ACL, the three-class comparator.
//   npm run seg3 -- ingest --edition 2025
//   npm run seg3 -- extract [--layers structure,claims] [--doc cp-2025] [--section art12]
//   npm run seg3 -- compare [--doc cp-2025]
//   npm run seg3 -- review [--auto] [--doc cp-2025]        (resolves contested claims)
//   npm run seg3 -- layers-4-6                              (pre-computed excerpt; never executed live)
import { ingest } from '../src/app/ingest';
import { UsageError } from '../src/app/errors';
import { emit, need, parseArgs, run } from './lib/cli';
import { cmdCompare, cmdExtractLayers, cmdLayers46 } from './lib/commands';
import { latestDocumentId, reviewContested } from './lib/review';
import { flag } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text', 'auto']);
const [cmd] = args._;

void run(async () => {
  switch (cmd) {
    case 'ingest': {
      const r = ingest(need(args, 'edition'));
      return emit('seg3.ingest', r, `ingested ${r.documentId} (${r.version}) length ${r.length}, effective from ${r.effectiveFrom} -> seq ${r.event.seq}`, args);
    }
    case 'extract': return cmdExtractLayers(args, 'seg3.extract');
    case 'compare': return cmdCompare(args, 'seg3.compare');
    case 'review': {
      const doc = flag(args, 'doc') ?? latestDocumentId();
      const r = await reviewContested(doc, Boolean(args.flags.auto), (s) => process.stderr.write(`${s}\n`));
      return emit('seg3.review', { documentId: doc, decisions: r }, r.map((d) => `${d.action.padEnd(10)} ${d.subjectKey} = ${d.valueText}  (seq ${d.seq.join(',')})`).join('\n'), args);
    }
    case 'layers-4-6': return cmdLayers46(args, 'seg3.layers-4-6');
    default: throw new UsageError('usage: seg3 ingest | extract | compare | review | layers-4-6   (see tools/seg3.ts)');
  }
});
