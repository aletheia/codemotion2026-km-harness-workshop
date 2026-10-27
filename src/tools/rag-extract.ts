// npm run rag:extract-c2 — the one-shot extraction of comma 2 of v8, replayed from fixtures/llm/oneshot@v1/.
import { config } from '../config';
import { extractOneShot } from '../agents/oneshot';
import { manifestUnit } from '../rag-baseline/units';
import { run } from './cli';

await run('rag-extract', () => {
  const { file, documentId, version, path } = config.rag.extractUnit;
  const fixture = extractOneShot(manifestUnit(file, documentId, version, path));
  process.stdout.write(`rag-extract  unit=${version}/${path}  extractor=one-shot  model=${fixture.modelId} (illustrative)\n`);
  process.stdout.write(fixture.response.endsWith('\n') ? fixture.response : fixture.response + '\n');
});
