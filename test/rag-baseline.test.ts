import { describe, expect, it } from 'vitest';
import { FixtureMissing, inputHash } from '../src/agents/replayer';
import { extractOneShot } from '../src/agents/oneshot';
import { config } from '../src/config';
import { chunkParagraphs } from '../src/rag-baseline/chunk';
import { formatQuery, trimmed } from '../src/rag-baseline/format';
import { buildIndex, deleteVersion, query, readSourceFiles } from '../src/rag-baseline/index';
import { tokenize } from '../src/rag-baseline/tfidf';
import { manifestUnit } from '../src/rag-baseline/units';

const files = readSourceFiles();

describe('chunkParagraphs', () => {
  it('splits on blank lines, drops empty paragraphs, numbers from 0 per file', () => {
    const chunks = chunkParagraphs('x-v1.txt', 'header\nline 2\n\nfirst\n \n\nsecond\n\n');
    expect(chunks).toEqual([
      { id: 'x-v1 #0', source_file: 'x-v1.txt', text: 'header\nline 2' },
      { id: 'x-v1 #1', source_file: 'x-v1.txt', text: 'first' },
      { id: 'x-v1 #2', source_file: 'x-v1.txt', text: 'second' },
    ]);
  });

  it('is deterministic on the fixtures: 7 + 8 + 8 paragraphs, lettera c) in #3', () => {
    const counts = files.map((f) => chunkParagraphs(f.name, f.text).length);
    expect(counts).toEqual([7, 8, 8]);
    for (const f of files) expect(chunkParagraphs(f.name, f.text)[3]!.text).toContain('\nc) ');
    expect(files.map((f) => chunkParagraphs(f.name, f.text))).toEqual(files.map((f) => chunkParagraphs(f.name, f.text)));
  });
});

describe('tokenize', () => {
  it('lower-cases, splits apostrophes, drops stopwords', () => {
    expect(tokenize("Soglia dei ricavi per la nomina dell'Organo")).toEqual(['soglia', 'ricavi', 'nomina', 'organo']);
  });
});

describe('index', () => {
  it('rebuilds identically', () => {
    expect(JSON.stringify(buildIndex(files))).toBe(JSON.stringify(buildIndex(readSourceFiles())));
  });

  it('ranks the three lettera c) paragraphs first for the segment-6 question', () => {
    const hits = query(buildIndex(files), config.rag.query, 3);
    expect(hits.map((h) => h.chunk.id).sort()).toEqual(['cc-art2477-v7 #3', 'cc-art2477-v8 #3', 'cc-art2477-v9 #3']);
  });

  it('delete-v8 removes only the v8 chunks and re-embeds the rest', () => {
    const before = buildIndex(files);
    const { index, removed } = deleteVersion(before, 'v8');
    const v8 = before.chunks.filter((c) => c.source_file === 'cc-art2477-v8.txt');
    expect(removed).toBe(v8.length);
    expect(index.chunks.map((c) => c.id)).toEqual(before.chunks.filter((c) => !v8.includes(c)).map((c) => c.id));
    expect(index.chunks.every((c) => !c.source_file.includes('-v8'))).toBe(true);
    expect(index).toEqual({ ...buildIndex(files.filter((f) => !f.name.includes('-v8'))), deleted: ['v8'] });
  });

  it('prints the fields line only on the complete index', () => {
    const full = buildIndex(files);
    expect(formatQuery(full, 'q', 3, []).at(-1)).toMatch(/^fields available/);
    expect(formatQuery(deleteVersion(full, 'v8').index, 'q', 3, []).at(-1)).not.toMatch(/^fields available/);
  });
});

describe('trimmed', () => {
  it('shows lettera c) from "c) " onward, cuts other chunks at 150 characters', () => {
    expect(trimmed('intro:\na) x\nc) the rule')).toBe('… c) the rule');
    expect(trimmed('x'.repeat(151))).toBe('x'.repeat(150) + ' …');
    expect(trimmed('short')).toBe('short');
  });
});

describe('oneshot@v1 replay', () => {
  it('returns the recorded blob for v8 c2', () => {
    const unit = manifestUnit('cc-art2477-v8.txt', 'cc-art2477', 'v8', 'c2');
    const fx = extractOneShot(unit);
    expect(fx.inputHash).toBe(inputHash(unit));
    expect(fx.response).toContain('"esercizi_consecutivi": 3');
  });

  it('throws FixtureMissing for an unrecorded unit', () => {
    expect(() => extractOneShot(manifestUnit('cc-art2477-v9.txt', 'cc-art2477', 'v9', 'c2'))).toThrow(FixtureMissing);
  });
});
