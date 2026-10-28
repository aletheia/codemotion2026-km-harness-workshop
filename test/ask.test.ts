import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ask, formatAsk, SOURCES_LINE, type Answered, type AskProjections, type AskQuery } from '../src/agents/ask';
import { config } from '../src/config';
import { readLog } from '../src/events/log';
import { buildAll } from '../src/projections/store';
import { segment4Log } from './walkthrough';

const fallback = (file: string) => readFileSync(`fallback/${file}`, 'utf8').trimEnd().split('\n');

// The agent's only inputs: the two projection files, as projections:build serializes them.
const path = segment4Log();
const events = readLog(path);
const { files } = buildAll(events);
const projections: AskProjections = { currentBeliefs: JSON.parse(files.CurrentBeliefs), timeline: JSON.parse(files.Timeline) };

const q = (over: Partial<AskQuery> = {}): AskQuery => ({ question: config.rag.query, lineageId: config.source.lineageId, ...over });
const answered = (query: AskQuery): Answered => {
  const a = ask(projections, query);
  if (a.kind !== 'answered') throw new Error(`refused: ${a.reason}`);
  return a;
};

describe('ask: consumption policy over the projections', () => {
  it('on 2019-04-30 answers 2,000,000 EUR citing clm-ricavi2m, human(luca), span [1067,1126) in v8', () => {
    const a = answered(q({ asOf: '2019-04-30' }));
    expect(a.subjectKey).toBe('ricavi.limite');
    expect(a.value).toEqual({ type: 'money', amount: 2_000_000, currency: 'EUR' });
    expect(a.label).toBe('clm-ricavi2m');
    expect(a.verified).toEqual({ actor: 'human(luca)', seq: 11 });
    expect(a.span).toEqual({ documentId: 'cc-art2477', version: 'v8', start: 1067, end: 1126 });
    expect(a.quote).toBe('ricavi delle vendite e delle prestazioni: 2 milioni di euro');
    expect(a.supersededLater).toEqual({ label: 'clm-ricavi4m', seq: 33 });
  });

  it('without a date answers 4,000,000 EUR citing clm-ricavi4m, verified after contestation', () => {
    const a = answered(q());
    expect(a.label).toBe('clm-ricavi4m');
    expect(a.value).toEqual({ type: 'money', amount: 4_000_000, currency: 'EUR' });
    expect(a.verified).toEqual({ actor: 'human(luca)', seq: 32 });
    expect(a.contested?.seq).toBe(28);
    expect(a.predecessor).toBe('clm-ricavi2m');
    expect(a.span).toEqual({ documentId: 'cc-art2477', version: 'v9', start: 1084, end: 1143 });
  });

  it('refuses assemblea.termine: the belief is only proposed (class B)', () => {
    const a = ask(projections, q({ question: "Entro quanti giorni deve provvedere l'assemblea?", subjectKey: 'assemblea.termine' }));
    expect(a.kind).toBe('refused');
    if (a.kind !== 'refused') return;
    expect(a.pending).toEqual([{ label: 'clm-term30', state: 'proposed' }]);
  });

  it('answers esercizi.consecutivi: the class-A reconfirmation is rooted in the v8 human verification', () => {
    const a = answered(q({ question: 'Quanti esercizi consecutivi?' }));
    expect(a.subjectKey).toBe('esercizi.consecutivi');
    expect(a.label).toBe('clm-eserc2b');
    expect(a.verified).toEqual({ actor: 'harness(compare)', seq: 25 });
    expect(a.root).toEqual({ label: 'clm-eserc2', actor: 'human(luca)', seq: 13 });
  });

  it('refuses a monetary belief whose chain is not rooted in a human decision', () => {
    // The same projections with the ricavi belief's verification re-attributed to an import.
    const timeline = structuredClone(projections.timeline) as unknown as Record<string, { label: string; entries: { type: string; actor: string }[] }>;
    const ricavi = Object.values(timeline).find((t) => t.label === 'clm-ricavi4m')!;
    for (const e of ricavi.entries) if (e.type === 'ClaimVerified') e.actor = 'import(compliance-register)';
    const a = ask({ ...projections, timeline: timeline as unknown as AskProjections['timeline'] }, q());
    expect(a.kind).toBe('refused');
  });

  it('prints fallback/seg6/ask.txt: the dated command with the policy, the undated one with the sources line', () => {
    const dated = q({ asOf: '2019-04-30' });
    const now = q();
    const out = [...formatAsk(dated, ask(projections, dated), { showPolicy: true }), ...formatAsk(now, ask(projections, now)), SOURCES_LINE];
    expect(out).toEqual(fallback('seg6/ask.txt'));
  });

  it('reads nothing but the projections: no file system, log or document access in the agent', () => {
    const source = readFileSync('src/agents/ask.ts', 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/gu)].map((m) => m[1]);
    expect(imports.filter((i) => /node:|events\/log|acl\/|replayer|fixtures/u.test(i!))).toEqual([]);
    expect(readLog(path)).toHaveLength(events.length);
  });
});
