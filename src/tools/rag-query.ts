// npm run rag:query — top 3 chunks for the segment-6 question.
import { config } from '../config';
import { formatQuery } from '../rag-baseline/format';
import { loadIndex, query } from '../rag-baseline/index';
import { run } from './cli';

await run('rag-query', () => {
  const index = loadIndex();
  const hits = query(index, config.rag.query, config.rag.topK);
  process.stdout.write(formatQuery(index, config.rag.query, config.rag.topK, hits).join('\n') + '\n');
});
