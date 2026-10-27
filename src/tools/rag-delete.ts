// npm run rag:delete-v8 [-- --version <vN>] — the only way the index can retire a text.
import { formatDelete } from '../rag-baseline/format';
import { deleteVersion, loadIndex, saveIndex } from '../rag-baseline/index';
import { argValue, run } from './cli';

await run('rag-delete', () => {
  const version = argValue(process.argv.slice(2), 'version') ?? 'v8';
  const { index, removed } = deleteVersion(loadIndex(), version);
  saveIndex(index);
  process.stdout.write(formatDelete(index, version, removed) + '\n');
});
