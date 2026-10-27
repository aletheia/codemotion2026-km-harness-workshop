// The deterministic command sequence of each segment, as `npm run` commands. Used by `npm run dry-run`
// (full rehearsal in a temp directory) and to regenerate fallback/segN/expected-output.txt.
// Nothing here calls a model: extractors replay fixtures/llm.
export interface Step { segment: number; npm: string; tool: string; args: string[]; expectExit: number; note?: string; writeFile?: { name: string; content: string };
  /** Also write this step's stdout to fallback/segN/<name> (the file name the run sheet points at). */ fallback?: string }

const bad = JSON.stringify({
  unitId: 'cp-2024:art12',
  extractor: { version: 'claims@v1', modelId: 'fixture-replay', promptVersion: 'claims-p1' },
  claims: [{ subjectKey: 'fire.deductible', valueText: '999 EUR', quote: 'Incendio: franchigia di 999 EUR a evento', span: { start: 0, end: 40 } }],
});

export const steps: Step[] = [
  { segment: 1, npm: 'npm run seg1 -- query --q "franchigia incendio" --text', tool: 'seg1', args: ['query', '--q', 'franchigia incendio', '--text'], expectExit: 0, fallback: 'rag-query.txt' },
  { segment: 1, npm: 'npm run seg1 -- delete --edition 2024 --text', tool: 'seg1', args: ['delete', '--edition', '2024', '--text'], expectExit: 0 },
  { segment: 1, npm: 'npm run seg1 -- query --q "franchigia incendio" --text', tool: 'seg1', args: ['query', '--q', 'franchigia incendio', '--text'], expectExit: 0, fallback: 'rag-after-delete.txt' },
  { segment: 1, npm: 'npm run seg1 -- extract --section art12 --text', tool: 'seg1', args: ['extract', '--section', 'art12', '--text'], expectExit: 0, fallback: 'rag-extract.txt', note: 'recorded one-shot response (fixtures/llm/oneshot@v1.json), no model call' },
  { segment: 1, npm: 'npm run seg1 -- delete --edition 2030', tool: 'seg1', args: ['delete', '--edition', '2030'], expectExit: 2, note: 'an edition that is not in the index is rejected' },
  { segment: 2, npm: 'npm run seg2 -- log-init --text', tool: 'seg2', args: ['log-init', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- ingest --edition 2024 --text', tool: 'seg2', args: ['ingest', '--edition', '2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- extract structure --doc cp-2024 --text', tool: 'seg2', args: ['extract', 'structure', '--doc', 'cp-2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- review --auto --doc cp-2024', tool: 'seg2', args: ['review', '--auto', '--doc', 'cp-2024', '--text'], expectExit: 0, note: 'scripted reviewer (fixtures/review-script.json) stands in for the human' },
  { segment: 2, npm: 'npm run seg2 -- extract claims --doc cp-2024 --text', tool: 'seg2', args: ['extract', 'claims', '--doc', 'cp-2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run tail -- --all --jsonl', tool: 'tail', args: ['--all', '--jsonl'], expectExit: 0, fallback: 'log-after-extract.jsonl' },
  { segment: 2, npm: 'npm run seg2 -- review --auto --doc cp-2024', tool: 'seg2', args: ['review', '--auto', '--doc', 'cp-2024', '--text'], expectExit: 0, note: 'scripted reviewer' },
  { segment: 2, npm: 'npm run tail -- --all --jsonl', tool: 'tail', args: ['--all', '--jsonl'], expectExit: 0, fallback: 'log-after-verify.jsonl' },
  { segment: 2, npm: 'npm run propose -- --file bad-claims.json', tool: 'propose', args: ['--file', '$FILE'], expectExit: 2, note: 'quote not in the source: the write path rejects it', writeFile: { name: 'bad-claims.json', content: bad } },
  { segment: 2, npm: 'npm run tail -- --n 20 --text', tool: 'tail', args: ['--n', '20', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run replay -- --text', tool: 'replay', args: ['--text'], expectExit: 0 },
];
