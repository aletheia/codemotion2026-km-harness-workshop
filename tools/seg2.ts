// Segment 2: build the log by hand - init, ingest, extract, review, show.
//   npm run seg2 -- log-init
//   npm run seg2 -- ingest --edition 2024
//   npm run seg2 -- extract structure --doc cp-2024
//   npm run seg2 -- extract claims --doc cp-2024 [--section art12] [--extractor claims@v1]
//   npm run seg2 -- review [--stage structure|claims] [--doc cp-2024] [--auto]
//   npm run seg2 -- show [last|<seq>|<eventId>]
import { editionByDocumentId } from '../src/adapters/documents';
import { UsageError } from '../src/app/errors';
import { extractClaims } from '../src/app/extractClaims';
import { ingest } from '../src/app/ingest';
import { logInit } from '../src/app/logInit';
import { showEvent, summarize } from '../src/app/query';
import { extractStructure } from '../src/app/structure';
import { emit, flag, need, parseArgs, run } from './lib/cli';
import { latestDocumentId, nextStage, reviewClaims, reviewContested, reviewStructure } from './lib/review';

const args = parseArgs(process.argv.slice(2), ['text', 'auto']);
const [cmd, sub] = args._;
const stderr = (s: string) => process.stderr.write(`${s}\n`);

void run(async () => {
  switch (cmd) {
    case 'log-init': {
      const r = logInit();
      return emit('seg2.log-init', r, `log initialised: seq ${r.events.map((e) => e.seq).join(', ')}`, args);
    }
    case 'ingest': {
      const r = ingest(need(args, 'edition'));
      return emit('seg2.ingest', r, `ingested ${r.documentId} (${r.version}) length ${r.length}, effective from ${r.effectiveFrom} -> seq ${r.event.seq}`, args);
    }
    case 'extract': {
      const doc = need(args, 'doc');
      if (!editionByDocumentId(doc)) throw new UsageError(`unknown document ${doc}`);
      if (sub === 'structure') {
        const r = extractStructure(doc);
        return emit('seg2.extract.structure', r, `${r.extractor} proposed ${r.nodes} nodes for ${doc} -> seq ${r.event.seq}`, args);
      }
      if (sub === 'claims') {
        const r = extractClaims(doc, flag(args, 'section') ?? 'art12', flag(args, 'extractor'));
        return emit('seg2.extract.claims', r, `${r.extractor} proposed ${r.proposed.length} claims for ${r.unit}\n${r.proposed.map((p) => `  ${p.seq}  ${p.subjectKey} = ${p.valueText}`).join('\n')}`, args);
      }
      throw new UsageError('usage: seg2 extract structure|claims --doc <id>');
    }
    case 'review': {
      const doc = flag(args, 'doc') ?? latestDocumentId();
      const stage = flag(args, 'stage') ?? nextStage(doc);
      const auto = Boolean(args.flags.auto);
      if (stage === 'structure') {
        const r = await reviewStructure(doc, auto, stderr);
        return emit('seg2.review.structure', { documentId: doc, event: r.event }, `structure of ${doc} verified -> seq ${r.event.seq}`, args);
      }
      if (stage === 'contested') {
        const r = await reviewContested(doc, auto, stderr);
        return emit('seg2.review.contested', { documentId: doc, decisions: r }, r.map((d) => `${d.action.padEnd(10)} ${d.subjectKey} = ${d.valueText}  (seq ${d.seq.join(',')})`).join('\n'), args);
      }
      if (stage === 'claims') {
        const r = await reviewClaims(doc, auto, stderr);
        return emit('seg2.review.claims', { documentId: doc, decisions: r }, r.map((d) => `${d.action.padEnd(6)} ${d.subjectKey} = ${d.valueText}  (seq ${d.seq.join(',')})`).join('\n') || '(no decisions)', args);
      }
      throw new UsageError(`unknown stage "${stage}" (structure | claims | contested)`);
    }
    case 'show': {
      const e = showEvent(args._[1] ?? 'last');
      return emit('seg2.show', { event: e }, `${summarize(e)}\n${JSON.stringify(e, null, 2)}`, args);
    }
    default:
      throw new UsageError('usage: seg2 log-init | ingest | extract | review | show   (see tools/seg2.ts)');
  }
});
