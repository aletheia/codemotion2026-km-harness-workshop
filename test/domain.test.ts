import { describe, expect, it } from 'vitest';
import { makeClaimId } from '../src/domain/claim';
import { asDocumentId, hash16 } from '../src/domain/ids';
import { checkMayEmit } from '../src/domain/policy';
import { checkProvenance } from '../src/domain/provenance';
import { absoluteToLocal, iou, localToAbsolute } from '../src/domain/span';
import { checkStructure } from '../src/domain/structure';
import { TransitionError, transition } from '../src/domain/transition';
import { NormalizationError, normalize, valueEquals } from '../src/domain/value';
import { looksLikeEventsWrite } from '../src/domain/guard';
import { bannedPatterns, scanText } from '../src/domain/bannedNames';
import { planTags } from '../src/domain/tagPlan';

const doc = asDocumentId('d');

describe('spans', () => {
  it('local <-> absolute round trip with the section base offset', () => {
    const abs = localToAbsolute({ start: 5, end: 12 }, 4000, doc, 'v1');
    expect([abs.start, abs.end]).toEqual([4005, 4012]);
    expect(absoluteToLocal(abs, 4000)).toEqual({ start: 5, end: 12 });
  });
  it('IoU on half-open intervals', () => {
    const s = (a: number, b: number) => ({ documentId: doc, version: 'v1', start: a, end: b });
    expect(iou(s(0, 10), s(0, 10))).toBe(1);
    expect(iou(s(0, 10), s(10, 20))).toBe(0);
    expect(iou(s(0, 10), s(5, 15))).toBeCloseTo(5 / 15);
  });
});

describe('values', () => {
  it('normalizes the forms of the documents', () => {
    expect(normalize('1.000.000 EUR')).toEqual({ type: 'money', amount: 1000000, currency: 'EUR' });
    expect(normalize('€ 500')).toEqual({ type: 'money', amount: 500, currency: 'EUR' });
    expect(normalize('10 %')).toEqual({ type: 'percent', value: 10 });
    expect(valueEquals(normalize('500 EUR'), normalize('EUR 500'))).toBe(true);
    expect(valueEquals(normalize('500 EUR'), normalize('750 EUR'))).toBe(false);
  });
  it('refuses what it cannot normalize', () => {
    expect(() => normalize('a lot')).toThrow(NormalizationError);
  });
});

describe('ids', () => {
  it('are deterministic 16-hex hashes', () => {
    expect(hash16('a', 'b')).toMatch(/^[0-9a-f]{16}$/);
    expect(hash16('a', 'b')).toBe(hash16('a', 'b'));
    expect(hash16('ab', '')).not.toBe(hash16('a', 'b'));
  });
  it('claimId depends on document, version, subject and value', () => {
    const v = normalize('500 EUR');
    const base = makeClaimId(doc, 'v1', 'fire.deductible', v);
    expect(makeClaimId(doc, 'v1', 'fire.deductible', v)).toBe(base);
    expect(makeClaimId(doc, 'v2', 'fire.deductible', v)).not.toBe(base);
    expect(makeClaimId(doc, 'v1', 'theft.deductible', v)).not.toBe(base);
    expect(makeClaimId(doc, 'v1', 'fire.deductible', normalize('750 EUR'))).not.toBe(base);
  });
});

describe('provenance', () => {
  const text = 'Franchigia incendio: 500 EUR per sinistro.';
  const span = { documentId: doc, version: 'v1', start: 0, end: text.length };
  it('accepts a verbatim quote inside the span', () => expect(checkProvenance(text, span, '500 EUR').ok).toBe(true));
  it('rejects a quote that is not in the text', () => expect(checkProvenance(text, span, '600 EUR')).toMatchObject({ ok: false }));
  it('rejects a quote outside the cited span', () => expect(checkProvenance(text, { ...span, end: 10 }, '500 EUR')).toMatchObject({ ok: false }));
  it('rejects empty quotes and spans outside the document', () => {
    expect(checkProvenance(text, span, '  ')).toMatchObject({ ok: false });
    expect(checkProvenance(text, { ...span, end: 999 }, '500 EUR')).toMatchObject({ ok: false });
  });
});

describe('structure', () => {
  const n = (path: string, start: number, end: number) => ({ path, type: 'article' as const, title: path, start, end });
  it('accepts a tiling and rejects gaps, overlaps, duplicates and a short cover', () => {
    expect(checkStructure([n('a', 0, 5), n('b', 5, 9)], 9)).toBeNull();
    expect(checkStructure([n('a', 0, 5), n('b', 6, 9)], 9)).toMatch(/gap or overlap/);
    expect(checkStructure([n('a', 0, 5), n('a', 5, 9)], 9)).toMatch(/duplicate/);
    expect(checkStructure([n('a', 0, 5)], 9)).toMatch(/document length/);
  });
});

describe('who may emit', () => {
  it('agents only propose; humans verify; harness only with class evidence', () => {
    expect(checkMayEmit('ClaimProposed', 'agent', undefined)).toBeNull();
    expect(checkMayEmit('ClaimVerified', 'agent', 'human')).toMatch(/may not emit/);
    expect(checkMayEmit('ClaimVerified', 'human', 'human')).toBeNull();
    expect(checkMayEmit('ClaimVerified', 'harness', 'class-A')).toBeNull();
    expect(checkMayEmit('ClaimVerified', 'harness', 'human')).not.toBeNull();
    expect(checkMayEmit('ExtractorVersionPromoted', 'harness', 'class-A')).toMatch(/may not emit/);
  });
  it('process is the actor kind of log facts (default 3)', () => {
    for (const t of ['LogInitialised', 'DocumentVersionIngested', 'ACLRejected', 'CursorAdvanced']) expect(checkMayEmit(t, 'process', undefined), t).toBeNull();
  });
});

describe('claim state machine', () => {
  it('follows proposed -> verified -> contested -> superseded', () => {
    expect(transition(undefined, 'ClaimProposed', { actorKind: 'agent' })).toBe('proposed');
    expect(transition('proposed', 'ClaimVerified', { actorKind: 'human' })).toBe('verified');
    expect(transition('verified', 'ClaimContested', { actorKind: 'human' })).toBe('contested');
    expect(transition('verified', 'ClaimSuperseded', { actorKind: 'harness' })).toBe('superseded');
  });
  it('refuses illegal moves', () => {
    expect(transition('superseded', 'ClaimVerified', { actorKind: 'human' })).toBeInstanceOf(TransitionError);
    expect(transition('proposed', 'ClaimSuperseded', { actorKind: 'harness' })).toBeInstanceOf(TransitionError);
    expect(transition('verified', 'ClaimContested', { actorKind: 'harness' })).toBeInstanceOf(TransitionError);
  });
  it('a different verified value blocks verification until contested', () => {
    expect(transition('proposed', 'ClaimVerified', { actorKind: 'human', conflictingVerifiedClaimId: 'x'.repeat(16) as never })).toBeInstanceOf(TransitionError);
    expect(transition('contested', 'ClaimVerified', { actorKind: 'human', conflictingVerifiedClaimId: 'x'.repeat(16) as never })).toBe('verified');
  });
});

describe('events guard heuristic (optional hook)', () => {
  it('blocks shell writes to events/ and lets reads and npm tools through', () => {
    expect(looksLikeEventsWrite('echo x >> events/events.jsonl')).toBe(true);
    expect(looksLikeEventsWrite('sed -i s/a/b/ events/events.jsonl')).toBe(true);
    expect(looksLikeEventsWrite('rm -f events/events.jsonl')).toBe(true);
    expect(looksLikeEventsWrite('cat events/events.jsonl | head')).toBe(false);
    expect(looksLikeEventsWrite('npm run seg2 -- show 3')).toBe(false);
    expect(looksLikeEventsWrite('npm run tail -- --n 5')).toBe(false);
  });
});

describe('banned-name scan', () => {
  it('matches the banned names and phrases (assembled from fragments) and nothing in normal text', () => {
    const j = (...p: string[]) => p.join('');
    expect(scanText(`we thank ${j('Rad', 'ixia')}`)).toHaveLength(1);
    expect(scanText(`${j('Del', 'ta')}_${j('K', 'ai')} team`)).toHaveLength(1);
    expect(scanText(j('an order of ', 'magnitude cheaper', ' thing'))).toHaveLength(1);
    expect(scanText('Franchigia incendio: 500 EUR; the mesas are not a name')).toHaveLength(0);
    expect(scanText('acme', bannedPatterns(['acme']))).toHaveLength(1);
  });
});

describe('tag plan', () => {
  const c = (sha: string, subject: string) => ({ sha, subject });
  it('maps the linear history to segN-start / segN-done (workshop-v1 only after seg6)', () => {
    const plan = planTags([c('a1', 'step: skeleton'), c('b2', 'step: seg1 retrieval'), c('c3', 'step: seg2 log'), c('d4', 'docs: readme')], 'd4');
    expect(plan.map((t) => `${t.name}@${t.sha}`)).toEqual(['seg1-start@a1', 'seg1-done@b2', 'seg2-start@b2', 'seg2-done@c3', 'seg3-start@c3']);
  });
  it('plans nothing before the first step commit and refuses duplicate steps', () => {
    expect(planTags([c('x', 'chore: init')], 'x')).toEqual([]);
    expect(() => planTags([c('a', 'step: seg1'), c('b', 'step: seg1 again')], 'b')).toThrow(/two commits/);
  });
  it('seg6-done has no seg7-start', () => {
    const plan = planTags([c('a', 'step: skeleton'), ...[1, 2, 3, 4, 5, 6].map((n) => c(`s${n}`, `step: seg${n}`))], 's6');
    expect(plan.map((t) => t.name)).not.toContain('seg7-start');
    expect(plan.at(-1)!.name).toBe('workshop-v1');
  });
});
