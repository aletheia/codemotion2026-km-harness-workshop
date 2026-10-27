import { describe, expect, it } from 'vitest';
import { anchor, structureToClaims, type TreeInput } from '../src/acl/structureToClaims';
import { manifestEntry, readDocument } from '../src/acl/sourceToStructure';
import { toAbsolute } from '../src/domain/span';
import { documentId } from '../src/domain/ids';
import type { LogEvent } from '../src/events/schema';
import { actors } from './helpers';

const text = readDocument('cc-art2477', 'v8');
const tree: TreeInput = {
  treeId: 'tree-v8', documentId: 'cc-art2477', version: 'v8',
  nodes: [{ path: 'header', type: 'index', start: 0, end: 328 }, ...manifestEntry('cc-art2477', 'v8').tree],
};

const verified = {
  eventId: '00000000000000a5', seq: 5, aggregateVersion: 2, type: 'StructureVerified', layer: 'structure',
  aggregateId: 'tree-v8', actor: actors.human, causationId: '00000000000000a4', correlationId: 'review-structure-v8',
  occurredAt: '2026-10-28T13:37:05Z', payload: { treeId: 'tree-v8' },
  evidence: { kind: 'human', note: 'ok', nodesChecked: 8, nodesTotal: 8, covers: [0, 1990] },
} as LogEvent;

describe('span conversion local → absolute', () => {
  it('adds the base offset of the unit: attivo local [278,342) + 720 = [998,1062)', () => {
    expect(toAbsolute({ start: 278, end: 342 }, 720, documentId('cc-art2477'), 'v8'))
      .toEqual({ documentId: 'cc-art2477', version: 'v8', start: 998, end: 1062 });
    expect(anchor({ documentId: 'cc-art2477', version: 'v8', baseOffset: 720 }, { start: 347, end: 406 }))
      .toEqual({ documentId: 'cc-art2477', version: 'v8', start: 1067, end: 1126 });
  });

  it('the anchored span points at the same characters as the local one', () => {
    const { units } = structureToClaims(verified, tree, text, { sections: ['c2'], correlationId: 'run-v8-c2-01' });
    const c2 = units[0]!;
    const abs = anchor(c2, { start: 347, end: 406 });
    expect(text.slice(abs.start, abs.end)).toBe(c2.text.slice(347, 406));
    expect(text.slice(abs.start, abs.end)).toBe('ricavi delle vendite e delle prestazioni: 2 milioni di euro');
  });
});

describe('Structure → Claims ACL', () => {
  it('one unit per comma: the note node (abrogato) and the index node (header) never become units', () => {
    const { units, rejected } = structureToClaims(verified, tree, text, { correlationId: 'run' });
    expect(rejected).toBeUndefined();
    expect(units.map((u) => u.path)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
    expect(units.every((u) => u.sectionType === 'comma' && u.causationId === verified.eventId)).toBe(true);
  });

  it('selects the sections asked for, with text and base offset', () => {
    const { units } = structureToClaims(verified, tree, text, { sections: ['c2'], correlationId: 'run' });
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ path: 'c2', baseOffset: 720, text: text.slice(720, 1190) });
  });

  it('accepts only StructureVerified', () => {
    const notVerified = { ...verified, type: 'StructureProposed' } as unknown as LogEvent;
    expect(structureToClaims(notVerified, tree, text, { correlationId: 'run' })).toEqual({ units: [] });
  });

  it('rejects a tree without intervals with ACLRejected, without throwing', () => {
    const broken: TreeInput = { ...tree, nodes: tree.nodes.map((n) => ({ path: (n as { path: string }).path, type: (n as { type: string }).type })) };
    const result = structureToClaims(verified, broken, text, { correlationId: 'run' });
    expect(result.units).toEqual([]);
    expect(result.rejected).toMatchObject({
      type: 'ACLRejected', actor: { kind: 'process', id: 'acl' }, causationId: verified.eventId,
      payload: { upstreamEventId: verified.eventId },
    });
    const missing = (result.rejected as { payload: { missingFields: string[] } }).payload.missingFields;
    expect(missing).toContain('nodes[0].start');
    expect(missing).toContain('nodes[7].end');
  });
});
