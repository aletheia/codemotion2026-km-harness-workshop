// Segment 1: the baseline that loses identity, provenance and time.
//   npm run seg1 -- query --q "franchigia incendio"
//   npm run seg1 -- delete --edition 2024
//   npm run seg1 -- extract --section art12
//   npm run seg1 -- index            (rebuild the index from both editions)
import { UsageError } from '../src/app/errors';
import { buildIndex, ragDelete, ragExtract, ragQuery } from '../src/app/rag';
import { emit, need, flag, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
const [cmd] = args._;

void run(() => {
  switch (cmd) {
    case 'query': {
      const r = ragQuery(need(args, 'q'));
      const lines = [`query "${r.query}" over ${r.indexedChunks} chunks; fields per result: ${r.resultFields.join(', ')}`,
        ...r.results.map((h) => `  #${h.rank}  score ${h.score.toFixed(4)}  ${h.chunkId}  ${h.text}`)];
      if (r.results.length === 0) lines.push('  (no chunk above the minimum score)');
      return emit('seg1.query', r, lines.join('\n'), args);
    }
    case 'delete': {
      const r = ragDelete(need(args, 'edition'));
      return emit('seg1.delete', r, `deleted edition ${r.deletedEdition}: ${r.chunksRemoved} chunks removed, ${r.chunksLeft} left`, args);
    }
    case 'extract': {
      const r = ragExtract(flag(args, 'section') ?? 'art12');
      return emit('seg1.extract', r, `${r.extractor} (${r.modelId}, ${r.promptVersion}) one-shot blob for ${r.section}, ${r.editionsInIndex} edition(s) in the index:\n${JSON.stringify(r.blob, null, 2)}`, args);
    }
    case 'index': {
      const i = buildIndex();
      return emit('seg1.index', { chunks: i.chunks.length }, `index rebuilt: ${i.chunks.length} chunks`, args);
    }
    default:
      throw new UsageError('usage: seg1 query --q <text> | delete --edition <year> | extract [--section art12] | index');
  }
});
