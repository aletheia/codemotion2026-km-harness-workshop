// npm run rag:index — builds the retrieval baseline index (pre-talk) from v7, v8, v9.
import { buildIndex, readSourceFiles, saveIndex } from '../rag-baseline/index';
import { run } from './cli';

await run('rag-index', () => {
  const files = readSourceFiles();
  const index = buildIndex(files);
  saveIndex(index);
  process.stdout.write(`rag-index  index=${index.name}  chunks=${index.chunks.length}  files=${files.length}\n`);
});
