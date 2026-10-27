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
  { segment: 3, npm: 'npm run seg3 -- ingest --edition 2025 --text', tool: 'seg3', args: ['ingest', '--edition', '2025', '--text'], expectExit: 0 },
  { segment: 3, npm: 'npm run seg3 -- extract --layers structure,claims --doc cp-2025 --section art12 --text', tool: 'seg3', args: ['extract', '--layers', 'structure,claims', '--doc', 'cp-2025', '--section', 'art12', '--text'], expectExit: 0, note: 'the 2025 tree is reconfirmed by the harness (class A), then six proposals' },
  { segment: 3, npm: 'npm run tail -- --all --jsonl', tool: 'tail', args: ['--all', '--jsonl'], expectExit: 0, fallback: 'log-after-extract-2025.jsonl' },
  { segment: 3, npm: 'npm run compare -- --text', tool: 'compare', args: ['--text'], expectExit: 0 },
  { segment: 3, npm: 'npm run seg3 -- review --auto --text', tool: 'seg3', args: ['review', '--auto', '--text'], expectExit: 0, note: 'scripted reviewer verifies 750 and supersedes 500' },
  { segment: 3, npm: 'npm run tail -- --all --jsonl', tool: 'tail', args: ['--all', '--jsonl'], expectExit: 0, fallback: 'log-after-compare.jsonl' },
  { segment: 3, npm: 'npm run seg3 -- layers-4-6 --text', tool: 'seg3', args: ['layers-4-6', '--text'], expectExit: 0, fallback: 'layers-4-6.jsonl', note: 'pre-computed excerpt, never executed live' },
  { segment: 3, npm: 'npm run replay -- --text', tool: 'replay', args: ['--text'], expectExit: 0 },
  { segment: 4, npm: 'npm run log-cat -- --text', tool: 'log-cat', args: ['--text'], expectExit: 0, fallback: 'log-cat.txt' },
  { segment: 4, npm: 'npm run log-cat -- --chain superseded --text', tool: 'log-cat', args: ['--chain', 'superseded', '--text'], expectExit: 0, note: 'follow one causation chain from DocumentVersionIngested to ClaimSuperseded' },
  { segment: 4, npm: 'npm run projections-build -- --text', tool: 'projections-build', args: ['--text'], expectExit: 0, note: 'first build, so the drop has a file to compare against' },
  { segment: 4, npm: 'npm run projections-drop -- --text', tool: 'projections-drop', args: ['--text'], expectExit: 0 },
  { segment: 4, npm: 'npm run projections-build -- --text', tool: 'projections-build', args: ['--text'], expectExit: 0, fallback: 'projections-rebuilt.txt', note: 'same hash as before the drop' },
  { segment: 4, npm: 'npm run replay -- --extractor claims@v2 --text', tool: 'replay', args: ['--extractor', 'claims@v2', '--text'], expectExit: 0, note: 'appends v2 ClaimProposed events only: 5 for cp-2024, 6 for cp-2025' },
  { segment: 4, npm: 'npm run projections-diff -- --text', tool: 'projections-diff', args: ['--text'], expectExit: 0, fallback: 'projections-diff.txt' },
  { segment: 4, npm: 'npm run beliefs -- --at 2024-03-01 --text', tool: 'beliefs', args: ['--at', '2024-03-01', '--text'], expectExit: 0, fallback: 'beliefs-at-2024-03-01.txt', note: 'valid time' },
  { segment: 4, npm: 'npm run beliefs -- --text', tool: 'beliefs', args: ['--text'], expectExit: 0 },
  { segment: 4, npm: 'npm run beliefs -- --seq 15 --text', tool: 'beliefs', args: ['--seq', '15', '--text'], expectExit: 0, note: 'transaction time: the log as it was after event 15' },
];
