import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { append, EventRejected, LogInvalid, readLog } from '../src/events/log';
import { claimStates } from '../src/events/fold';
import { formatLog } from '../src/tools/tail-format';
import { logInit } from '../src/tools/log-init';
import { actors, CLAIM, draftOf, humanNote, proposed, tmpLog, verified } from './helpers';

describe('append', () => {
  it('assigns seq, aggregateVersion and the fixed-clock occurredAt', () => {
    const path = tmpLog();
    expect(append(path, draftOf(proposed(actors.agent)))).toEqual({ seq: 1, duplicate: false });
    expect(append(path, draftOf(verified(actors.human, humanNote)))).toEqual({ seq: 2, duplicate: false });
    const [a, b] = readLog(path);
    expect([a!.aggregateVersion, b!.aggregateVersion]).toEqual([1, 2]);
    expect([a!.occurredAt, b!.occurredAt]).toEqual(['2026-10-28T13:37:01Z', '2026-10-28T13:37:02Z']);
  });

  it('is idempotent: a duplicate eventId returns the existing seq and writes nothing', () => {
    const path = tmpLog();
    append(path, draftOf(proposed(actors.agent)));
    append(path, draftOf(verified(actors.human, humanNote)));
    const before = readFileSync(path, 'utf8');
    expect(append(path, draftOf(proposed(actors.agent)))).toEqual({ seq: 1, duplicate: true });
    expect(() => append(path, draftOf(verified(actors.human, humanNote)))).not.toThrow();
    expect(append(path, draftOf(verified(actors.human, humanNote)))).toEqual({ seq: 2, duplicate: true });
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('rejects a draft that fails its schema and writes nothing', () => {
    const path = tmpLog();
    append(path, draftOf(proposed(actors.agent)));
    const before = readFileSync(path, 'utf8');
    expect(() => append(path, draftOf({ ...verified(actors.agent, humanNote) }))).toThrow(EventRejected);
    const { evidence: _e, ...bare } = verified(actors.human, humanNote);
    expect(() => append(path, draftOf(bare))).toThrow(EventRejected);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('readLog refuses a corrupted log', () => {
    const path = tmpLog();
    append(path, draftOf(proposed(actors.agent)));
    writeFileSync(path, readFileSync(path, 'utf8').replace('"seq":1', '"seq":7'));
    expect(() => readLog(path)).toThrow(LogInvalid);
  });
});

describe('fold', () => {
  it('replays Claims-layer events through transition()', () => {
    const path = tmpLog();
    append(path, draftOf(proposed(actors.agent)));
    expect(claimStates(readLog(path)).get(CLAIM)).toBe('proposed');
    append(path, draftOf(verified(actors.human, humanNote)));
    expect(claimStates(readLog(path)).get(CLAIM)).toBe('verified');
  });
});

describe('log:init', () => {
  const fallback = readFileSync('fallback/seg2/log-after-extract.txt', 'utf8').split('\n').slice(0, 2);

  it('log:cat after log:init = the first two lines of fallback/seg2/log-after-extract.txt', () => {
    const path = tmpLog();
    expect(logInit(path).created).toBe(true);
    expect(formatLog(readLog(path))).toEqual(fallback);
  });

  it('is byte-identical across runs and idempotent on re-run', () => {
    const p1 = tmpLog();
    const p2 = tmpLog();
    logInit(p1);
    logInit(p2);
    expect(readFileSync(p1, 'utf8')).toBe(readFileSync(p2, 'utf8'));
    const again = logInit(p1);
    expect(again.created).toBe(false);
    expect(again.results).toEqual([{ seq: 1, duplicate: true }, { seq: 2, duplicate: true }]);
    expect(readLog(p1)).toHaveLength(2);
  });
});
