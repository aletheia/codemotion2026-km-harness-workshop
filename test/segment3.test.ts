import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { displayValue } from '../src/catalog/normalizer';
import type { NormalizedValue } from '../src/domain/claim';
import { readLog } from '../src/events/log';
import { build } from '../src/harness/beliefs/currentBeliefs';
import { compareBatch, reconfirmStructure } from '../src/processes/compare';
import { reviewAuto } from '../src/processes/review';
import { extractClaimsStep } from '../src/tools/extract-claims';
import { extractStructureStep } from '../src/tools/extract-structure';
import { ingestStep } from '../src/tools/ingest';
import { readExcerpt } from '../src/tools/layers-4-6';
import { logInit } from '../src/tools/log-init';
import { formatLog } from '../src/tools/tail-format';
import { tmpLog } from './helpers';

const fallback = (file: string) => readFileSync(`fallback/${file}`, 'utf8').trimEnd().split('\n');

describe('segment 3 on a fresh log', () => {
  const path = tmpLog();
  logInit(path);
  ingestStep('v8', path);
  extractStructureStep('v8', path);
  reviewAuto(path);
  extractClaimsStep('v8', ['c2'], { path });
  reviewAuto(path);
  const beforeV9 = build(readLog(path));

  ingestStep('v9', path);
  extractStructureStep('v9', path);
  const structure = reconfirmStructure(path, 'tree-v9');
  extractClaimsStep('v9', ['c2', 'c3', 'c5'], { path });
  const afterExtract = readLog(path).length;
  const batch = compareBatch(path)!;
  const afterCompare = readLog(path).length;
  const stage = reviewAuto(path);
  const events = readLog(path);

  it('reconfirms tree-v9 against tree-v8 in cold start (structure golden set 1 item)', () => {
    expect(structure.reconfirmed?.treeId).toBe('tree-v8');
    expect(structure.gate).toEqual({ kind: 'not-applicable', goldenItems: 1, minimum: 10 });
  });

  it('compares six proposals against four beliefs: A, C, C, C, B, B with the gate not applicable', () => {
    expect(beforeV9.size).toBe(4);
    expect(afterExtract).toBe(24);
    expect(batch.batchId).toBe('btc-v9-01');
    expect(batch.beliefs).toBe(4);
    expect(batch.gate).toEqual({ kind: 'not-applicable', goldenItems: 4, minimum: 10 });
    expect(batch.auditRate).toBe(1);
    expect(batch.proposals.map((p) => `${p.proposal.payload.label}:${p.comparison.cls}`))
      .toEqual(['clm-eserc2b:A', 'clm-attivo4m:C', 'clm-ricavi4m:C', 'clm-dip20:C', 'clm-cess3:B', 'clm-term30:B']);
    expect(afterCompare).toBe(29);
  });

  it('review stage 3 resolves the three conflicts: 35 events, equal to the fallback log', () => {
    expect(stage).toBe('conflicts-v9');
    expect(events).toHaveLength(35);
    expect(formatLog(events)).toEqual(fallback('seg3/log-after-compare.txt'));
  });

  it('CurrentBeliefs holds 4 keys; esercizi is harness-verified with a human root', () => {
    const beliefs = [...build(events).values()].map((b) =>
      `${b.subjectKey}=${displayValue(b.value as NormalizedValue)} ${b.label} by ${b.verifiedBy} root ${b.root.kind}`);
    expect(beliefs.sort()).toEqual([
      'attivo.limite=4,000,000 EUR clm-attivo4m by human root human',
      'dipendenti.limite=20 clm-dip20 by human root human',
      'esercizi.consecutivi=2 years clm-eserc2b by harness root human',
      'ricavi.limite=4,000,000 EUR clm-ricavi4m by human root human',
    ]);
  });

  it('is idempotent: running compare and review again appends nothing', () => {
    compareBatch(path);
    reviewAuto(path);
    expect(readLog(path)).toHaveLength(35);
  });

  it('the layers 4–6 excerpt parses, is never in the log, and its first cause is ev-0030', () => {
    const excerpt = readExcerpt();
    expect(excerpt.map((e) => e.type)).toEqual(['EntityProposed', 'EntityResolved', 'PolicyProposed', 'PolicyVerified', 'WorkflowStepProposed', 'WorkflowStepVerified']);
    expect(excerpt.some((x) => events.some((e) => e.eventId === x.eventId))).toBe(false);
    expect(excerpt[0]!.causationId).toBe(events[29]!.eventId);
  });
});
