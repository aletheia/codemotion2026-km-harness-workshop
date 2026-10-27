// Builds every generated fixture as a path -> content map. Pure (no I/O).
import { claimsInputHash, structureInputHash, type ClaimDraftOut, type RecordingFile, type StructureOut } from '../agents/replay';
import { buildEdition, type Edition } from './documents';
import { oneShotInputHash, sectionText, type OneShotBlob } from '../rag/oneShot';

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const DOC_ID = { '2024': 'cp-2024', '2025': 'cp-2025' } as const;

const clause = (e: Edition, key: string) => {
  const c = e.art12.clauses.find((x) => x.key === key);
  if (!c) throw new Error(`no clause ${key} in ${e.year}`);
  return c;
};
const draft = (e: Edition, key: string, valueText: string, span?: { start: number; end: number }): ClaimDraftOut => {
  const c = clause(e, key);
  return { subjectKey: key, valueText, quote: c.text, span: span ?? { start: c.start, end: c.end } };
};
const closing = (e: Edition, subjectKey: string, valueText: string): ClaimDraftOut => ({
  subjectKey, valueText, quote: e.art12.closing.text, span: { start: e.art12.closing.start, end: e.art12.closing.end },
});

export function buildFixtures(): Record<string, string> {
  const out: Record<string, string> = {};
  const ed = { '2024': buildEdition('2024'), '2025': buildEdition('2025') };
  const art12Node = (e: Edition) => e.nodes.find((n) => n.path === 'art12')!;

  for (const y of ['2024', '2025'] as const) out[`fixtures/documents/casa-protetta-${y}.txt`] = ed[y].text;
  out['fixtures/documents/manifest.json'] = json({
    lineageId: 'casa-protetta',
    note: 'Synthetic general conditions written for the workshop. Not a real policy.',
    editions: {
      '2024': { documentId: DOC_ID['2024'], file: 'casa-protetta-2024.txt', effectiveFrom: '2024-01-01' },
      '2025': { documentId: DOC_ID['2025'], file: 'casa-protetta-2025.txt', effectiveFrom: '2025-01-01' },
    },
  });

  // structure@v1: recorded response per document text
  const structure: RecordingFile<StructureOut> = {
    extractor: 'structure@v1', modelId: 'fixture-replay', promptVersion: 'structure-p1',
    responses: (['2024', '2025'] as const).map((y) => ({
      inputHash: structureInputHash(DOC_ID[y], y, ed[y].text),
      note: `${y}: ${ed[y].nodes.length} nodes`,
      output: { nodes: ed[y].nodes },
    })),
  };
  out['fixtures/llm/structure@v1.json'] = json(structure);

  const unitHash = (y: '2024' | '2025') => {
    const n = art12Node(ed[y]);
    return claimsInputHash(DOC_ID[y], y, 'art12', ed[y].text.slice(n.start, n.end));
  };
  const rec = (extractor: string, promptVersion: string, by: Record<'2024' | '2025', ClaimDraftOut[]>): RecordingFile<{ claims: ClaimDraftOut[] }> => ({
    extractor, modelId: 'fixture-replay', promptVersion,
    responses: (['2024', '2025'] as const).map((y) => ({ inputHash: unitHash(y), note: `${y} art12: ${by[y].length} claims`, output: { claims: by[y] } })),
  });
  const e24 = ed['2024'];
  const e25 = ed['2025'];
  // claims@v1: wrong theft co-insurance (15 %), invented hail claim, misses liability; fire span slightly wide.
  out['fixtures/llm/claims@v1.json'] = json(rec('claims@v1', 'claims-p1', {
    '2024': [
      draft(e24, 'fire.deductible', '500 EUR', { start: 118, end: 160 }),
      draft(e24, 'theft.deductible', '250 EUR'),
      draft(e24, 'theft.coinsurance', '15%'),
      closing(e24, 'hail.deductible', '300 EUR'),
    ],
    '2025': [
      draft(e25, 'fire.deductible', '750 EUR', { start: 118, end: 160 }),
      draft(e25, 'theft.deductible', '250 EUR'),
      draft(e25, 'theft.coinsurance', '10 %'),
      draft(e25, 'liability.limit', '1.000.000 EUR'),
      draft(e25, 'hail.deductible', '300 EUR'),
      draft(e25, 'weather.coinsurance', '5 %'),
    ],
  }));
  // claims@v2: fixes co-insurance and liability, but regresses theft deductible (2.500) and adds a noise claim.
  out['fixtures/llm/claims@v2.json'] = json(rec('claims@v2', 'claims-p2', {
    '2024': [
      draft(e24, 'fire.deductible', '500 EUR'),
      draft(e24, 'theft.deductible', '2.500 EUR'),
      draft(e24, 'theft.coinsurance', '10 %'),
      draft(e24, 'liability.limit', '1.000.000 EUR'),
      closing(e24, 'theft.limit', '5.000 EUR'),
    ],
    '2025': [
      draft(e25, 'fire.deductible', '750 EUR'),
      draft(e25, 'theft.deductible', '250 EUR'),
      draft(e25, 'theft.coinsurance', '10 %'),
      draft(e25, 'liability.limit', '1.000.000 EUR'),
      draft(e25, 'hail.deductible', '300 EUR'),
      draft(e25, 'weather.coinsurance', '5 %'),
    ],
  }));

  // oneshot@v1: ONE call returns one blob for Art. 12 (segment 1). No offsets, no versions, no ids.
  // Deliberate faults: a wrong value (15 % instead of 10 % / 5 %) and a missing clause (liability limit).
  // Which layer is at fault cannot be read off the blob; that is the point.
  const blobItems = (e: Edition): OneShotBlob['voci'] => e.art12.clauses
    .filter((c) => c.key !== 'liability.limit')
    .map((c) => {
      const [coverage, rest] = c.text.split(': ') as [string, string];
      const tipo = rest.startsWith('franchigia') ? 'franchigia' : 'scoperto';
      const raw = /(\d[\d.]* (?:EUR|%)|\d+ %)/.exec(rest)![1]!;
      const wrong = (e.year === '2024' && c.key === 'theft.coinsurance') || (e.year === '2025' && c.key === 'weather.coinsurance');
      return { copertura: coverage, tipo, valore: wrong ? '15 %' : raw };
    });
  const oneShotFor = (years: ('2024' | '2025')[]) => ({
    inputHash: oneShotInputHash('art12', years.map((y) => sectionText(ed[y].text, 'art12'))),
    note: `editions in the index: ${years.join('+')}`,
    output: { articolo: 'Art. 12', titolo: 'Franchigie e scoperti', voci: years.flatMap((y) => blobItems(ed[y])) } satisfies OneShotBlob,
  });
  out['fixtures/llm/oneshot@v1.json'] = json({
    extractor: 'oneshot@v1', modelId: 'fixture-replay', promptVersion: 'oneshot-p1',
    responses: [oneShotFor(['2024', '2025']), oneShotFor(['2025']), oneShotFor(['2024'])],
  });

  // Scripted human decisions for `--auto` runs. Spans are ABSOLUTE.
  const abs = (e: Edition, key: string) => {
    const c = clause(e, key);
    return { start: c.start + e.art12Base, end: c.end + e.art12Base };
  };
  out['fixtures/review-script.json'] = json({
    note: 'Scripted reviewer decisions for `--auto`. These stand in for a human; the log records them as actor human:luca.',
    structure: { note: `tree matches the document: 12 articles, index, note` },
    claims: {
      'cp-2024': [
        { action: 'verify', subjectKey: 'fire.deductible', valueText: '500 EUR', note: 'confirmed against Art. 12', reviewedSpan: abs(e24, 'fire.deductible') },
        { action: 'verify', subjectKey: 'theft.deductible', valueText: '250 EUR', note: 'confirmed against Art. 12' },
        { action: 'add', subjectKey: 'theft.coinsurance', valueText: '10 %', note: 'extractor read 15 %; the clause says 10 %', ...abs(e24, 'theft.coinsurance'), quote: clause(e24, 'theft.coinsurance').text },
        { action: 'add', subjectKey: 'liability.limit', valueText: '1.000.000 EUR', note: 'missed by the extractor', ...abs(e24, 'liability.limit'), quote: clause(e24, 'liability.limit').text },
      ],
    },
    contested: {
      'cp-2025': [{ action: 'accept-new', subjectKey: 'fire.deductible', valueText: '750 EUR', note: 'new edition raises the fire deductible' }],
    },
  });
  return out;
}
