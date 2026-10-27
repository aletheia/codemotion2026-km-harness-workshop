import { describe, expect, it } from 'vitest';
import { extractClaims } from '../src/agents/claims';
import { FixtureMissing, inputHash, replay } from '../src/agents/replayer';
import { extractStructure } from '../src/agents/structure';
import { manifestEntry, readDocument } from '../src/acl/sourceToStructure';
import { z } from 'zod';

const text = readDocument('cc-art2477', 'v8');
const c2 = { documentId: 'cc-art2477', version: 'v8', path: 'c2', text: text.slice(720, 1190) };

describe('fixture replayer', () => {
  it('throws FixtureMissing when no response is recorded (it never calls a model)', () => {
    expect(() => replay('claims', 'v1', { ...c2, text: c2.text + ' ' }, z.unknown())).toThrow(FixtureMissing);
    expect(() => extractClaims({ ...c2, path: 'c3' }, 'claims@v1')).toThrow(FixtureMissing);
    expect(() => extractClaims(c2, 'claims@v9')).toThrow(FixtureMissing);
  });

  it('the input hash covers documentId, version, path and text', () => {
    expect(inputHash(c2)).not.toBe(inputHash({ ...c2, version: 'v9' }));
    expect(inputHash(c2)).not.toBe(inputHash({ ...c2, path: 'c3' }));
  });

  it('structure@v1 on v8 returns the manifest tree plus the header', () => {
    const { response } = extractStructure({ documentId: 'cc-art2477', version: 'v8', text });
    expect(response.nodes).toEqual([{ path: 'header', type: 'index', start: 0, end: 328 }, ...manifestEntry('cc-art2477', 'v8').tree]);
  });

  it('claims@v1 on v8 c2 returns the four proposals of 00-running-example.md §6 with section-local spans', () => {
    const { response } = extractClaims(c2, 'claims@v1');
    expect(response.claims.map((c) => [c.subjectKey, c.span.start, c.span.end])).toEqual([
      ['attivo.limite', 278, 342], ['ricavi.limite', 347, 406], ['esercizi.consecutivi', 216, 244], ['capitale.soglia', 0, 79],
    ]);
    expect(response.claims.some((c) => c.subjectKey === 'dipendenti.limite')).toBe(false);
  });
});
