import { beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { consume, ruleFor } from '../src/domain/consumption';
import { resolveSubject } from '../src/app/ask';
import { read, root, sandbox, tool, type Sandbox } from './helpers';

describe('segment 6: consumption policy (pure)', () => {
  it('monetary: only a human-rooted verified belief is usable', () => {
    expect(consume({ subjectClass: 'monetary', state: 'verified', root: 'human', verifier: 'harness' })).toMatchObject({ usable: true });
    expect(consume({ subjectClass: 'monetary', state: 'verified', root: 'human', verifier: 'human' })).toMatchObject({ usable: true });
    expect(consume({ subjectClass: 'monetary', state: 'verified', root: 'harness-only', verifier: 'harness' })).toMatchObject({ usable: false });
    expect(consume({ subjectClass: 'monetary', state: 'verified', root: 'import', verifier: 'import' })).toMatchObject({ usable: false });
  });
  it('any class: never proposed, never contested', () => {
    for (const subjectClass of ['monetary', 'exclusion', 'time-limit', 'other'] as const) {
      expect(consume({ subjectClass, state: 'proposed', root: 'human', verifier: 'human' }).usable).toBe(false);
      expect(consume({ subjectClass, state: 'contested', root: 'human', verifier: 'human' }).usable).toBe(false);
    }
  });
  it('other classes accept a human or a harness verification, not an import', () => {
    expect(consume({ subjectClass: 'other', state: 'verified', root: 'harness-only', verifier: 'harness' }).usable).toBe(true);
    expect(consume({ subjectClass: 'other', state: 'verified', root: 'import', verifier: 'import' }).usable).toBe(false);
    expect(ruleFor('exclusion')).toBe('human-rooted verified only');
    expect(ruleFor('other')).toBe('human- or harness-verified');
  });
});

describe('segment 6: question to subject', () => {
  it('matches the catalogue label ignoring case and accents, or a subject key', () => {
    expect(resolveSubject('Franchigia INCENDIO').subjectKey).toBe('fire.deductible');
    expect(resolveSubject('qual è il massimale responsabilita civile?').subjectKey).toBe('liability.limit');
    expect(resolveSubject('theft.coinsurance').subjectKey).toBe('theft.coinsurance');
  });
  it('rejects a question that names no catalogue subject and lists the catalogue', () => {
    expect(() => resolveSubject('franchigia terremoto')).toThrow(/no subject in the catalogue matches/);
    expect(() => resolveSubject('furto')).toThrow(/known:/);
  });
});

describe('segment 6: ask answers from the projection and cites the belief', { timeout: 300_000 }, () => {
  let sb: Sandbox;
  const must = (name: string, ...a: string[]) => { const r = tool(sb, name, ...a); expect(r.status, `${name} ${a.join(' ')}: ${r.stderr}`).toBe(0); return r; };
  type Ask = { answerable: boolean; answer: { value: string } | null; refusal: string | null; belief: Record<string, any> | null; claim: { state: string } | null; edition: { documentId: string }; asOf: string; timeAxis: string };
  const ask = (...a: string[]) => must('ask', ...a).json as unknown as Ask;

  beforeAll(() => {
    sb = sandbox();
    must('seg2', 'log-init'); must('seg2', 'ingest', '--edition', '2024');
    must('seg2', 'extract', 'structure', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg2', 'extract', 'claims', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg3', 'ingest', '--edition', '2025');
    must('seg3', 'extract', '--layers', 'structure,claims', '--doc', 'cp-2025');
    must('compare'); must('seg3', 'review', '--auto');
  });

  it('as of 2024-03-01 (valid time): 500 EUR, the 2024 belief, human, reviewed span, superseded later', () => {
    const r = ask('--q', 'franchigia incendio', '--as-of', '2024-03-01');
    expect(r).toMatchObject({ answerable: true, answer: { value: '500 EUR' }, asOf: '2024-03-01', timeAxis: 'valid', edition: { documentId: 'cp-2024' } });
    expect(r.belief).toMatchObject({ verifiedBy: 'human:luca', root: 'human', reviewedSpan: { start: 4240, end: 4280 }, document: 'cp-2024@2024' });
    expect(r.belief!.supersededBy).toMatchObject({ value: '750 EUR' });
    const text = tool(sb, 'ask', '--q', 'franchigia incendio', '--as-of', '2024-03-01', '--text').stdout;
    expect(text).toMatch(/answer: 500 EUR/);
    expect(text).toMatch(/not applicable on 2024-03-01/);
    expect(text).toMatch(/raw documents: not read/);
  });

  it('without a date: 750 EUR, the 2025 belief, verified by a human after the contestation, successor of the 2024 belief', () => {
    const now = ask('--q', 'franchigia incendio');
    const then = ask('--q', 'franchigia incendio', '--as-of', '2024-03-01');
    expect(now).toMatchObject({ answerable: true, answer: { value: '750 EUR' }, asOf: 'now', edition: { documentId: 'cp-2025' } });
    expect(now.belief).toMatchObject({ verifiedBy: 'human:luca', document: 'cp-2025@2025', reviewedSpan: { start: 4300, end: 4340 } });
    expect(now.belief!.afterContestedSeq).toBeTypeOf('number');
    expect(now.belief!.afterContestedSeq).toBeLessThan(now.belief!.verifiedSeq);
    expect(now.belief!.successorOf).toBe(then.belief!.claimId);
    expect(now.belief!.claimId).not.toBe(then.belief!.claimId);
  });

  it('Theft deductible 2025: usable, verified by the harness, root is the human decision of 2024', () => {
    const r = ask('--q', 'franchigia furto');
    expect(r).toMatchObject({ answerable: true, answer: { value: '250 EUR' } });
    expect(r.belief).toMatchObject({ verifiedBy: 'harness:comparator', root: 'human', rootActor: 'human:luca' });
    expect(r.belief!.chain).toHaveLength(2);
  });

  it('Hail deductible 2025: still proposed, so the agent cannot assert it, and says why', () => {
    const r = ask('--q', 'franchigia grandine');
    expect(r).toMatchObject({ answerable: false, answer: null, claim: { state: 'proposed' } });
    expect(r.refusal).toMatch(/proposed/);
    expect(tool(sb, 'ask', '--q', 'franchigia grandine', '--text').stdout).toMatch(/answer: none/);
  });

  it('Theft co-insurance 2024: the hand-added human claim (10 %) is the answer, not the wrong 15 % proposal', () => {
    const r = ask('--q', 'scoperto furto', '--as-of', '2024-06-01');
    expect(r.answer).toEqual({ value: '10 %' });
    expect(r.belief).toMatchObject({ verifiedBy: 'human:luca' });
  });

  it('ask appends nothing to the log', () => {
    const before = sb.lines();
    must('ask', '--q', 'franchigia incendio'); must('ask', '--q', 'franchigia furto', '--as-of', '2024-03-01');
    expect(sb.lines()).toEqual(before);
  });

  it('errors: unknown subject exit 2; no edition in force exit 2; bad date and missing --q exit 1; each one stderr line', () => {
    const cases: [string[], number][] = [
      [['--q', 'franchigia terremoto'], 2],
      [['--q', 'franchigia incendio', '--as-of', '2023-01-01'], 2],
      [['--q', 'franchigia incendio', '--as-of', '1 marzo 2024'], 1],
      [[], 1],
    ];
    for (const [a, code] of cases) {
      const r = tool(sb, 'ask', ...a);
      expect(r.status, a.join(' ')).toBe(code);
      expect(r.stderr.trim().split('\n'), a.join(' ')).toHaveLength(1);
      expect(r.stderr).toMatch(/^error: /);
    }
  });

  it('segment 6 fallbacks exist and are labelled deterministic tool output', () => {
    for (const f of ['ask.txt', 'ask-now.txt', 'ask-theft.txt', 'ask-hail.txt']) expect(read(join(root, 'fallback/seg6', f))).toMatch(/DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION/);
  });
});
