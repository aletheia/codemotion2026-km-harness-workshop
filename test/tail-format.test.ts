import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../src/events/schema';
import { displayEventId, EVIDENCE_MAX, formatLog, formatTailLine } from '../src/tools/tail-format';
import { actors, humanNote, proposed, span, verified } from './helpers';

const asLog = (e: unknown, seq: number) => ({ ...(e as object), seq }) as LogEvent;

describe('tail format', () => {
  it('display ids are ev-<seq, 4 digits>', () => {
    expect(displayEventId(7)).toBe('ev-0007');
    expect(displayEventId(1234)).toBe('ev-1234');
  });

  it('shows causation as ev-NNNN, ★ on decisions, agent by extractor version, the proposal label on later claim events', () => {
    const p = asLog({ ...proposed(actors.agent), payload: { ...proposed(actors.agent).payload, label: 'clm-ricavi2m' } }, 7);
    const v = asLog({ ...verified(actors.human, { kind: 'human', note: 'ok' }), causationId: p.eventId }, 11);
    const [lp, lv] = formatLog([p, v]);
    expect(lp).toBe('0007 · ClaimProposed             · agent(claims@v1)    · claims    · clm-ricavi2m  ·');
    expect(lv).toBe('0011 ★ ClaimVerified             · human(luca)         · claims    · clm-ricavi2m  · ← ev-0007  evidence: note "ok"');
  });

  it('summarises a human tree check and the span a reviewer read', () => {
    const tree = asLog({ ...verified(actors.human, humanNote), evidence: { kind: 'human', note: 'x', nodesChecked: 8, nodesTotal: 8, covers: [0, 1990] } }, 5);
    expect(formatTailLine(tree).endsWith('evidence: 8/8 nodes, intervals cover 0..1990')).toBe(true);
    const claim = asLog(verified(actors.human, { kind: 'human', note: 'ok', checkedSpan: { ...span, start: 998, end: 1062 } }), 10);
    expect(formatTailLine(claim).endsWith('evidence: note "ok"; span [998,1062)')).toBe(true);
  });

  it('keeps evidence within 60 characters', () => {
    const long = asLog(verified(actors.human, { kind: 'human', note: 'x'.repeat(200) }), 3);
    const evidence = formatTailLine(long).split('evidence: ')[1]!;
    expect(evidence.length).toBeLessThanOrEqual(EVIDENCE_MAX);
    expect(evidence.endsWith('…')).toBe(true);
  });

  it('accepts a seq label for events outside the log', () => {
    expect(formatTailLine(asLog(proposed(actors.agent), 1), { seqLabel: '—   ' }).startsWith('—    · ClaimProposed')).toBe(true);
  });
});
