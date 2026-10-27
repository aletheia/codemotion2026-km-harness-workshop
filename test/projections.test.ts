import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayValue } from '../src/catalog/normalizer';
import type { NormalizedValue } from '../src/domain/claim';
import { claimStates } from '../src/events/fold';
import { readLog } from '../src/events/log';
import { ofType } from '../src/events/lookup';
import { build } from '../src/harness/beliefs/currentBeliefs';
import { replayClaims } from '../src/processes/replay';
import { beliefsAtDate, beliefsAtSeq } from '../src/projections/beliefsAt';
import { extractorDiff } from '../src/projections/extractorDiff';
import { reviewQueue } from '../src/projections/reviewQueue';
import { buildAll, dropAll, PROJECTION_NAMES, projectionHash, writeAll } from '../src/projections/store';
import { segment3Log } from './walkthrough';

const show = (subjectKey: string, value: unknown, label: string) => `${subjectKey}=${displayValue(value as NormalizedValue)} ${label}`;

describe('projections: droppable and rebuildable', () => {
  it('drop + build gives the same CurrentBeliefs, byte for byte and by hash', () => {
    const path = segment3Log();
    const dir = join(dirname(path), 'projections');
    writeAll(buildAll(readLog(path)), dir);
    const before = readFileSync(join(dir, 'CurrentBeliefs.json'), 'utf8');
    expect(dropAll(dir)).toEqual(PROJECTION_NAMES);
    expect(() => readFileSync(join(dir, 'CurrentBeliefs.json'))).toThrow();
    writeAll(buildAll(readLog(path)), dir);
    const after = readFileSync(join(dir, 'CurrentBeliefs.json'), 'utf8');
    expect(after).toBe(before);
    expect(projectionHash(after)).toBe(projectionHash(before));
    expect(dropAll(dir)).toEqual(PROJECTION_NAMES);   // dropping twice is fine
  });
});

describe('replay of the Claims layer with claims@v2', () => {
  const path = segment3Log();
  const beliefsBefore = buildAll(readLog(path)).files.CurrentBeliefs;
  const linesBefore = readFileSync(path, 'utf8');
  const first = replayClaims('claims@v2', path);
  const afterFirst = readLog(path);
  const second = replayClaims('claims@v2', path);

  it('re-runs the units the promoted extractor read: v8 c2 and v9 c2, c3, c5; appends 11 without touching a line', () => {
    expect(first.promoted).toBe(false);
    expect(first.inputs.map((i) => `${i.version}:${i.sections.join(',')}:${i.results.length}`)).toEqual(['v8:c2:5', 'v9:c2,c3,c5:6']);
    expect(afterFirst).toHaveLength(46);
    expect(readFileSync(path, 'utf8').startsWith(linesBefore)).toBe(true);
  });

  it('replaying the same extractor version twice appends nothing the second time', () => {
    expect(second.inputs.flatMap((i) => i.results).every((r) => r.duplicate)).toBe(true);
    expect(readLog(path)).toHaveLength(46);
  });

  it('a re-proposal of an existing claim keeps its state; CurrentBeliefs does not change', () => {
    const states = claimStates(afterFirst);
    const v2 = ofType(afterFirst.slice(35), 'ClaimProposed');
    const byLabel = (l: string) => states.get(v2.find((e) => e.payload.label === l)!.payload.claimId as never);
    expect(byLabel('clm-v2-attivo2m')).toBe('superseded');   // same claim as clm-attivo2m
    expect(byLabel('clm-v2-attivo4m')).toBe('verified');     // same claim as clm-attivo4m
    expect(byLabel('clm-v2-ricavi2k')).toBe('proposed');     // a new claim (2,000 EUR)
    expect(buildAll(afterFirst).files.CurrentBeliefs).toBe(beliefsBefore);
  });

  it('candidate proposals are not reviewer work; the per-version diff shows the ricavi regression on v8', () => {
    expect(reviewQueue(afterFirst).map((r) => r.label)).toEqual(['clm-eserc3', 'clm-capitale', 'clm-cess3', 'clm-term30']);
    const rows = extractorDiff(afterFirst, 'cc-art2477', 'claims@v2').rows;
    expect(rows.filter((r) => r.status === 'DIFFERS').map((r) => `${r.version} ${r.subjectKey}`)).toEqual(['v8 ricavi.limite']);
    expect(rows.find((r) => r.version === 'v8' && r.subjectKey === 'cessazione.esercizi')?.notInUnit).toBe('c2');
  });
});

describe('beliefs at a date (valid time) and at a seq (transaction time)', () => {
  const events = readLog(segment3Log());

  it('on 2019-04-30 the v8 thresholds, verified by the human, with their period and successor', () => {
    const rows = beliefsAtDate(events, 'cc-art2477', '2019-04-30');
    expect(rows.map(({ record: r }) => show(r.subjectKey, r.value, r.label))).toEqual([
      'attivo.limite=2,000,000 EUR clm-attivo2m',
      'ricavi.limite=2,000,000 EUR clm-ricavi2m',
      'dipendenti.limite=10 clm-dip10',
      'esercizi.consecutivi=2 years clm-eserc2',
    ]);
    expect(rows.every(({ validity }) => validity.from === '2019-03-16' && validity.to === '2019-06-18')).toBe(true);
    expect(rows.map(({ record: r }) => r.superseded?.reason)).toEqual(['human-resolution', 'human-resolution', 'human-resolution', 'reconfirmation-chain']);
  });

  it('on 2019-06-18 (and later) the v9 values; before v8 nothing', () => {
    expect(beliefsAtDate(events, 'cc-art2477', '2019-06-18').map(({ record: r }) => r.label)).toEqual(['clm-attivo4m', 'clm-ricavi4m', 'clm-dip20', 'clm-eserc2b']);
    expect(beliefsAtDate(events, 'cc-art2477', '2019-06-17').map(({ record: r }) => r.label)[0]).toBe('clm-attivo2m');
    expect(beliefsAtDate(events, 'cc-art2477', '2019-01-01')).toEqual([]);
  });

  it('--seq folds the log prefix: at seq 15 the v8 beliefs, at 35 the current ones', () => {
    const at = (seq: number) => [...beliefsAtSeq(events, seq).values()].map((b) => b.label).sort();
    expect(at(15)).toEqual(['clm-attivo2m', 'clm-dip10', 'clm-eserc2', 'clm-ricavi2m']);
    expect(at(35)).toEqual([...build(events).values()].map((b) => b.label).sort());
  });
});
