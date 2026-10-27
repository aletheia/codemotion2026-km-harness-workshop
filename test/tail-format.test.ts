import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../src/events/schema';
import { displayEventId, EVIDENCE_MAX, formatLog, formatTailLine } from '../src/tools/tail-format';
import { actors, proposed, verified } from './helpers';

const asLog = (e: unknown, seq: number) => ({ ...(e as object), seq }) as LogEvent;

describe('tail format', () => {
  it('display ids are ev-<seq, 4 digits>', () => {
    expect(displayEventId(7)).toBe('ev-0007');
    expect(displayEventId(1234)).toBe('ev-1234');
  });

  it('shows causation as ev-NNNN, ★ on decisions, agent by extractor version', () => {
    const p = asLog({ ...proposed(actors.agent), payload: { ...proposed(actors.agent).payload, label: 'clm-ricavi2m' } }, 7);
    const v = asLog({ ...verified(actors.human, { kind: 'human', note: 'ok' }), causationId: p.eventId }, 11);
    const [lp, lv] = formatLog([p, v]);
    expect(lp).toBe('0007 · ClaimProposed             · agent(claims@v1)    · claims    · clm-ricavi2m  ·');
    expect(lv).toMatch(/^0011 ★ ClaimVerified {13}· human\(luca\) {9}· claims {4}· [0-9a-f]{16} · ← ev-0007  evidence: note "ok"$/u);
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
