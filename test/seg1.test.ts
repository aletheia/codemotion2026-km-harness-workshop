import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chunkDocument, features, search } from '../src/rag/retriever';
import { sectionText } from '../src/rag/oneShot';
import { read, root, sandbox, tool } from './helpers';
import { join } from 'node:path';

type Result = { rank: number; chunkId: string; score: number; text: string };

describe('segment 1: retriever (pure)', () => {
  const chunks = chunkDocument('x', 'Incendio: franchigia di 500 EUR a evento\nFurto: franchigia di 250 EUR a sinistro');
  it('is a computed score: identical text scores 1, no overlap scores 0, and it is deterministic', () => {
    expect(search(chunks, 'Incendio: franchigia di 500 EUR a evento', 1, 0)[0]!.score).toBeGreaterThan(0.99);
    expect(search(chunks, 'zzzz qqqq', 5, 0).every((r) => r.score === 0)).toBe(true);
    expect(search(chunks, 'franchigia incendio', 5, 0)).toEqual(search(chunks, 'franchigia incendio', 5, 0));
  });
  it('features are words and trigrams, accent-insensitive', () => {
    expect(features('Responsabilità')).toContain('w:responsabilita');
    expect(features('ab')).toContain('t:^ab');
  });
  it('a chunk has no field for edition, date or span', () => {
    expect(Object.keys(chunks[0]!).sort()).toEqual(['chunkId', 'text']);
  });
  it('sectionText returns the article body, not the index line', () => {
    const t = 'INDICE\nArt. 1 - A\nArt. 2 - B\nArt. 1 - A\ncorpo uno\nArt. 2 - B\ncorpo due\nNota informativa\nfine';
    expect(sectionText(t, 'art1')).toBe('Art. 1 - A\ncorpo uno');
    expect(sectionText(t, 'art2')).toBe('Art. 2 - B\ncorpo due');
    expect(sectionText(t, 'art9')).toBe('');
  });
});

describe('segment 1: npm run seg1', { timeout: 120_000 }, () => {
  const sb = sandbox();
  const q = () => tool(sb, 'seg1', 'query', '--q', 'franchigia incendio');

  it('finds two chunks with comparable scores and no version or date on either', () => {
    const r = q();
    expect(r.status).toBe(0);
    const results = r.json!.results as Result[];
    expect(results).toHaveLength(2);
    expect(results.map((x) => x.text).join('|')).toMatch(/500 EUR/);
    expect(results.map((x) => x.text).join('|')).toMatch(/750 EUR/);
    expect(Math.abs(results[0]!.score - results[1]!.score)).toBeLessThan(0.05);
    for (const x of results) expect(Object.keys(x).sort()).toEqual(['chunkId', 'rank', 'score', 'text']);
    expect(JSON.stringify(r.json)).not.toMatch(/"(edition|version|effectiveFrom|date|span)"/);
  });

  it('after deleting 2024 the same query returns one result, and the 2024 value is unreachable', () => {
    const d = tool(sb, 'seg1', 'delete', '--edition', '2024');
    expect(d.status).toBe(0);
    expect(d.json!.chunksRemoved).toBe(44);
    const results = q().json!.results as Result[];
    expect(results).toHaveLength(1);
    expect(results[0]!.text).toContain('750 EUR');
    expect(JSON.stringify(results)).not.toContain('500 EUR');
  });

  it('rejects deleting an edition twice: one stderr line, exit 2, empty stdout', () => {
    const r = tool(sb, 'seg1', 'delete', '--edition', '2024');
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(r.stderr).toMatch(/^error: edition 2024 is not in the index/);
  });

  it('the one-shot blob has no coordinates, ids or versions, and carries a wrong value', () => {
    const r = tool(sb, 'seg1', 'extract', '--section', 'art12');
    expect(r.status).toBe(0);
    expect(r.json!.modelId).toBe('fixture-replay');
    const blob = r.json!.blob as { voci: Record<string, string>[] };
    const keys = new Set(['articolo', 'titolo', ...blob.voci.flatMap((v) => Object.keys(v))]);
    expect([...keys].sort()).toEqual(['articolo', 'copertura', 'tipo', 'titolo', 'valore']);
    expect(JSON.stringify(blob)).toContain('15 %'); // the extractor error that no layer is named for
  });

  it('refuses a section it has no recording for instead of inventing output', () => {
    const r = tool(sb, 'seg1', 'extract', '--section', 'art99');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^error: section art99 not found/);
  });

  it('never writes to the event log; reset removes the index so the next query rebuilds both editions', () => {
    expect(existsSync(sb.eventsFile)).toBe(false);
    expect(tool(sb, 'reset').status).toBe(0);
    const results = q().json as { results: Result[]; indexedChunks: number };
    expect(results.indexedChunks).toBe(90);
    expect(results.results).toHaveLength(2);
  });

  it('fallback files for segment 1 exist and say they are tool output', () => {
    for (const f of ['rag-query.txt', 'rag-after-delete.txt', 'rag-extract.txt']) {
      expect(read(join(root, 'fallback/seg1', f))).toMatch(/NOT A MODEL SESSION/);
    }
  });
});
