import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { catalog } from '../src/catalog/subjects';
import type { NormalizedValue, SubjectKey } from '../src/domain/claim';
import { documentId } from '../src/domain/ids';
import type { Span } from '../src/domain/span';
import { append, readLog } from '../src/events/log';
import { BeliefInvariantViolated, beliefKey, build, type Belief, type BeliefKey } from '../src/harness/beliefs/currentBeliefs';
import { compare, compareStructure, type Proposal } from '../src/harness/compare/comparator';
import { batchGate } from '../src/harness/eval/batchGate';
import { importSystemOfRecord, parseRegister, readRegister } from '../src/harness/prior/importSystemOfRecord';
import { auditRate, isSampled } from '../src/harness/sampling/auditPolicy';
import { CLAIM, OTHER, actors, draftOf, humanNote, proposed, span, tmpLog, verified } from './helpers';

const money = (amount: number): NormalizedValue => ({ type: 'money', amount, currency: 'EUR' });
const v8 = (start: number, end: number): Span => ({ documentId: documentId('cc-art2477'), version: 'v8', start, end });
const v9 = (start: number, end: number): Span => ({ ...v8(start, end), version: 'v9' });

function belief(subjectKey: SubjectKey, value: NormalizedValue, spans: Span[]): Belief {
  return {
    claimId: '00000000000000aa', label: 'clm-belief', lineageId: 'cc-art2477', subjectKey, value, spans,
    proposedEventId: '00000000000000a1', verifiedBy: 'human', verifiedEventId: '00000000000000a2', root: { kind: 'human', claimId: '00000000000000aa' },
  };
}
const beliefs = (...bs: Belief[]): ReadonlyMap<BeliefKey, Belief> => new Map(bs.map((b) => [beliefKey(b.lineageId, b.subjectKey), b]));
const proposal = (subjectKey: string, value: NormalizedValue, spans: Span[] = [v9(1084, 1143)]): Proposal =>
  ({ claimId: '00000000000000bb', lineageId: 'cc-art2477', subjectKey: subjectKey as SubjectKey, value, spans });
const opts = { thetaIoU: config.eval.iouThreshold };

describe('comparator: the three classes', () => {
  const ricavi2m = belief('ricavi.limite', money(2_000_000), [v8(1067, 1126)]);

  it('A — a belief with the same normalized value (another version: span not compared)', () => {
    const c = compare(proposal('ricavi.limite', money(2_000_000)), beliefs(ricavi2m), catalog, opts);
    expect(c.cls).toBe('A');
    expect(c.cls === 'A' && c.evidence.belief.claimId).toBe(ricavi2m.claimId);
  });

  it('A within the same version also needs span IoU ≥ θ; below it the proposal goes to the human (B)', () => {
    expect(compare(proposal('ricavi.limite', money(2_000_000), [v8(1067, 1126)]), beliefs(ricavi2m), catalog, opts).cls).toBe('A');
    expect(compare(proposal('ricavi.limite', money(2_000_000), [v8(1000, 1062)]), beliefs(ricavi2m), catalog, opts))
      .toMatchObject({ cls: 'B', evidence: { reason: 'span below threshold' } });
  });

  it('B — no belief on (lineage, subject key)', () => {
    expect(compare(proposal('cessazione.esercizi', { type: 'integer', value: 3, unit: 'years' }), beliefs(ricavi2m), catalog, opts))
      .toMatchObject({ cls: 'B', evidence: { reason: 'no belief' } });
  });

  it('C — a belief with a different value; evidence carries both values, belief first', () => {
    const c = compare(proposal('ricavi.limite', money(4_000_000)), beliefs(ricavi2m), catalog, opts);
    expect(c).toMatchObject({ cls: 'C', evidence: { values: [money(2_000_000), money(4_000_000)] } });
  });

  it('UNEXPECTED — the catalogue does not resolve the subject, whatever the beliefs', () => {
    const capitale = belief('capitale.soglia', { type: 'enum', value: 'minimo s.p.a.' }, [v8(720, 799)]);
    expect(compare(proposal('capitale.soglia', { type: 'enum', value: 'minimo s.p.a.' }), beliefs(capitale), catalog, opts))
      .toMatchObject({ cls: 'UNEXPECTED', evidence: { subjectKey: 'capitale.soglia' } });
  });

  it('Policies and Workflow never take the class-A path', () => {
    for (const layer of ['policies', 'workflow'] as const) {
      const same = compare(proposal('ricavi.limite', money(2_000_000)), beliefs(ricavi2m), catalog, { ...opts, layer });
      expect(same).toMatchObject({ cls: 'B', evidence: { reason: 'layer never class A' } });
      expect(compare(proposal('ricavi.limite', money(4_000_000)), beliefs(ricavi2m), catalog, { ...opts, layer }).cls).toBe('C');
    }
  });

  it('structure: same paths and types reconfirm across versions; intervals are not compared', () => {
    const t8 = { treeId: 'tree-v8', nodes: [{ path: 'header', type: 'index' }, { path: 'c1', type: 'comma' }, { path: 'abrogato', type: 'note' }] };
    const t9 = { treeId: 'tree-v9', nodes: t8.nodes.map((n) => ({ ...n })) };
    expect(compareStructure(t9, [t8])?.treeId).toBe('tree-v8');
    expect(compareStructure({ ...t9, nodes: [...t9.nodes.slice(0, 2), { path: 'abrogato', type: 'comma' }] }, [t8])).toBeUndefined();
    expect(compareStructure({ ...t9, nodes: t9.nodes.slice(1) }, [t8])).toBeUndefined();
    expect(compareStructure(t8, [t8])).toBeUndefined();     // a tree never reconfirms itself
  });
});

describe('CurrentBeliefs', () => {
  it('keys the verified non-superseded claims by (lineage, subject key), rooted at the human', () => {
    const path = tmpLog();
    append(path, draftOf(proposed(actors.agent)));
    append(path, draftOf(verified(actors.human, humanNote)));
    const b = build(readLog(path));
    expect([...b.keys()]).toEqual(['cc-art2477|ricavi.limite']);
    expect(b.get('cc-art2477|ricavi.limite')).toMatchObject({ claimId: CLAIM, verifiedBy: 'human', root: { kind: 'human', claimId: CLAIM } });
  });

  it('throws when two verified non-superseded claims share a key, blaming the comparator', () => {
    const path = tmpLog();
    // A verified v8 claim and a verified v9 claim on the same key, with no contest and no supersession.
    append(path, draftOf(proposed(actors.agent)));
    append(path, draftOf(verified(actors.human, humanNote)));
    const p2 = proposed(actors.agent, [{ ...span, version: 'v9', start: 1084, end: 1143 }]);
    append(path, draftOf({ ...p2, eventId: '1111111111111111', aggregateId: OTHER, payload: { ...p2.payload, claimId: OTHER, normalizedValue: money(4_000_000) } }));
    const v2 = verified(actors.human, humanNote);
    append(path, draftOf({ ...v2, eventId: '2222222222222222', aggregateId: OTHER, payload: { claimId: OTHER } }));
    expect(() => build(readLog(path))).toThrow(BeliefInvariantViolated);
    expect(() => build(readLog(path))).toThrow(/comparator is at fault/);
  });
});

describe('batch gate (cold start)', () => {
  const cfg = config.batchGate;
  it('is not applicable while the golden set is below the probe minimum', () => {
    expect(batchGate({ goldenItems: 4 }, cfg)).toEqual({ kind: 'not-applicable', goldenItems: 4, minimum: 10 });
    expect(batchGate({ goldenItems: 9, probe: { counts: { tp: 0, fp: 5, fn: 5 }, criticalErrors: 3 } }, cfg).kind).toBe('not-applicable');
  });

  it('above the minimum it is count-based: FN ≤ 1, FP ≤ 1, no critical error', () => {
    expect(batchGate({ goldenItems: 10, probe: { counts: { tp: 8, fp: 1, fn: 1 }, criticalErrors: 0 } }, cfg).kind).toBe('passed');
    expect(batchGate({ goldenItems: 10, probe: { counts: { tp: 8, fp: 2, fn: 0 }, criticalErrors: 0 } }, cfg).kind).toBe('rejected');
    expect(batchGate({ goldenItems: 10, probe: { counts: { tp: 9, fp: 0, fn: 0 }, criticalErrors: 1 } }, cfg).kind).toBe('rejected');
    expect(() => batchGate({ goldenItems: 10 }, cfg)).toThrow(/no probe items/);
  });
});

describe('audit sampling of class A', () => {
  it('100 % in cold start, 5 % human-rooted, 20 % import-rooted', () => {
    expect(auditRate('human', true)).toBe(1);
    expect(auditRate('import', true)).toBe(1);
    expect(auditRate('human', false)).toBe(0.05);
    expect(auditRate('import', false)).toBe(0.2);
  });

  it('is deterministic by claim id and close to the rate over many ids', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => i.toString(16).padStart(16, '0'));
    const picked = ids.filter((id) => isSampled(id, 0.2));
    expect(ids.filter((id) => isSampled(id, 0.2))).toEqual(picked);
    expect(picked.length / ids.length).toBeGreaterThan(0.15);
    expect(picked.length / ids.length).toBeLessThan(0.25);
    expect(ids.every((id) => isSampled(id, 1))).toBe(true);
  });
});

describe('prior: import from the system of record (not used live)', () => {
  it('reads compliance-register.csv: four rows, each with its character interval', () => {
    const text = readRegister();
    const rows = parseRegister(text);
    expect(rows.map((r) => r.subjectKey)).toEqual(['attivo.limite', 'ricavi.limite', 'dipendenti.limite', 'esercizi.consecutivi']);
    expect(rows[0]!.value).toEqual(money(4_000_000));
    expect(rows[3]!.value).toEqual({ type: 'integer', value: 2, unit: 'years' });
    for (const r of rows) expect(text.slice(r.start, r.end).startsWith(`cc-art2477,${r.subjectKey},`)).toBe(true);
  });

  it('appends as import-verified beliefs (20 % audit), idempotently', () => {
    const path = tmpLog();
    const drafts = importSystemOfRecord(readRegister(), { operator: 'luca' });
    for (const d of drafts) append(path, d);
    for (const d of drafts) expect(append(path, d).duplicate).toBe(true);
    const events = readLog(path);
    expect(events).toHaveLength(9);
    expect(events[0]).toMatchObject({ type: 'DocumentVersionIngested', actor: { kind: 'import' }, payload: { kind: 'system-of-record' } });
    const b = build(events);
    expect(b.size).toBe(4);
    for (const belief of b.values()) {
      expect(belief).toMatchObject({ verifiedBy: 'import', root: { kind: 'import' } });
      expect(auditRate(belief.root.kind, false)).toBe(0.2);
    }
  });
});
