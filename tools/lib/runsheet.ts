// The deterministic command sequence of each segment, as `npm run` commands. Used by `npm run dry-run`
// (full rehearsal in a temp directory) and to regenerate fallback/segN/expected-output.txt.
// Nothing here calls a model: extractors replay fixtures/llm.
export interface Step { segment: number; npm: string; tool: string; args: string[]; expectExit: number; note?: string; writeFile?: { name: string; content: string } }

const bad = JSON.stringify({
  unitId: 'cp-2024:art12',
  extractor: { version: 'claims@v1', modelId: 'fixture-replay', promptVersion: 'claims-p1' },
  claims: [{ subjectKey: 'fire.deductible', valueText: '999 EUR', quote: 'Incendio: franchigia di 999 EUR a evento', span: { start: 0, end: 40 } }],
});

export const steps: Step[] = [
  { segment: 2, npm: 'npm run seg2 -- log-init --text', tool: 'seg2', args: ['log-init', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- ingest --edition 2024 --text', tool: 'seg2', args: ['ingest', '--edition', '2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- extract structure --doc cp-2024 --text', tool: 'seg2', args: ['extract', 'structure', '--doc', 'cp-2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- review --auto --doc cp-2024', tool: 'seg2', args: ['review', '--auto', '--doc', 'cp-2024', '--text'], expectExit: 0, note: 'scripted reviewer (fixtures/review-script.json) stands in for the human' },
  { segment: 2, npm: 'npm run seg2 -- extract claims --doc cp-2024 --text', tool: 'seg2', args: ['extract', 'claims', '--doc', 'cp-2024', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run seg2 -- review --auto --doc cp-2024', tool: 'seg2', args: ['review', '--auto', '--doc', 'cp-2024', '--text'], expectExit: 0, note: 'scripted reviewer' },
  { segment: 2, npm: 'npm run propose -- --file bad-claims.json', tool: 'propose', args: ['--file', '$FILE'], expectExit: 2, note: 'quote not in the source: the write path rejects it', writeFile: { name: 'bad-claims.json', content: bad } },
  { segment: 2, npm: 'npm run tail -- --n 20 --text', tool: 'tail', args: ['--n', '20', '--text'], expectExit: 0 },
  { segment: 2, npm: 'npm run replay -- --text', tool: 'replay', args: ['--text'], expectExit: 0 },
];
