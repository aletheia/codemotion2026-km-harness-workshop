import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { foldEvents } from '../src/projections/fold';
import { diffDocument, extractorsFor } from '../src/projections/diff';
import type { AnyStoredEvent } from '../src/events/types';
import { read, root, sandbox, tool, type Sandbox } from './helpers';

describe('segment 4: log-cat, projections, replay, beliefs', { timeout: 300_000 }, () => {
  let sb: Sandbox;
  const must = (name: string, ...a: string[]) => { const r = tool(sb, name, ...a); expect(r.status, `${name} ${a.join(' ')}: ${r.stderr}`).toBe(0); return r; };
  const events = () => sb.lines().map((l) => JSON.parse(l) as AnyStoredEvent);
  const projFile = () => join(sb.dir, 'projections', 'current-beliefs.json');
  let linesAtSeg3 = 0;
  let beliefsHash = '';

  beforeAll(() => {
    sb = sandbox();
    must('seg2', 'log-init'); must('seg2', 'ingest', '--edition', '2024');
    must('seg2', 'extract', 'structure', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg2', 'extract', 'claims', '--doc', 'cp-2024'); must('seg2', 'review', '--auto', '--doc', 'cp-2024');
    must('seg3', 'ingest', '--edition', '2025');
    must('seg3', 'extract', '--layers', 'structure,claims', '--doc', 'cp-2025');
    must('compare'); must('seg3', 'review', '--auto');
    linesAtSeg3 = sb.lines().length;
    beliefsHash = String(must('replay').json!.beliefsHash);
  });

  it('log-cat: one row per event with a causation column; the chain starts at the ingested document and ends at the supersession', () => {
    const all = must('log-cat').json!;
    expect(all.total).toBe(linesAtSeg3);
    const rows = all.events as { seq: number; type: string; causedBy: number | null }[];
    expect(rows[0]!.causedBy).toBeNull();
    expect(rows.find((r) => r.type === 'ClaimSuperseded')!.causedBy).not.toBeNull();
    const chain = must('log-cat', '--chain', 'superseded').json!.events as { type: string }[];
    expect(chain[0]!.type).toBe('DocumentVersionIngested');
    expect(chain[chain.length - 1]!.type).toBe('ClaimSuperseded');
    expect(chain.map((c) => c.type)).toEqual(['DocumentVersionIngested', 'StructureProposed', 'StructureVerified', 'ClaimProposed', 'ClaimVerified', 'ClaimSuperseded']);
  });

  it('log-cat refuses an unknown event with one stderr line', () => {
    const r = tool(sb, 'log-cat', '--chain', '9999');
    expect(r.status).toBe(1);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('projections-diff before any replay says what to run (exit 2, one line)', () => {
    const r = tool(sb, 'projections-diff');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/replay -- --extractor claims@v2/);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('projections: drop with no file compares against the log; build writes the file; drop then build gives the same hash', () => {
    const d0 = must('projections-drop').json!;
    expect(d0).toMatchObject({ dropped: false, hashSource: 'log', hashBeforeDrop: beliefsHash });
    const b0 = must('projections-build').json!;
    expect(b0).toMatchObject({ hash: beliefsHash, matchesDropped: true, currentBeliefs: 4 });
    expect(existsSync(projFile())).toBe(true);
    const onDisk = JSON.parse(readFileSync(projFile(), 'utf8')) as { hash: string };
    expect(onDisk.hash).toBe(beliefsHash);
    const d1 = must('projections-drop').json!;
    expect(d1).toMatchObject({ dropped: true, hashSource: 'file', hashBeforeDrop: beliefsHash });
    expect(existsSync(projFile())).toBe(false);
    expect(must('projections-build').json).toMatchObject({ hash: beliefsHash, matchesDropped: true, hashSource: 'file' });
  });

  it('replay --extractor claims@v2 appends eleven ClaimProposed lines (5 + 6), modifies nothing, leaves CurrentBeliefs alone', () => {
    const before = sb.lines();
    const r = must('replay', '--extractor', 'claims@v2').json!;
    expect(r).toMatchObject({ appended: 11, earlierLinesUnchanged: true, currentBeliefsUnchanged: true, newClaims: 2 });
    expect(r.perDocument).toEqual([{ documentId: 'cp-2024', proposals: 5, deduplicated: 0 }, { documentId: 'cp-2025', proposals: 6, deduplicated: 0 }]);
    const after = sb.lines();
    expect(after.slice(0, before.length)).toEqual(before);
    const added = after.slice(before.length).map((l) => JSON.parse(l) as AnyStoredEvent);
    expect(added.every((e) => e.type === 'ClaimProposed' && e.actor.kind === 'agent')).toBe(true);
    expect(added.every((e) => e.actor.kind === 'agent' && e.actor.extractorVersion === 'claims@v2')).toBe(true);
    expect(must('replay').json!.beliefsHash).toBe(beliefsHash);
  });

  it('replay --extractor is idempotent: the second run appends nothing', () => {
    const n = sb.lines().length;
    expect(must('replay', '--extractor', 'claims@v2').json).toMatchObject({ appended: 0 });
    expect(sb.lines().length).toBe(n);
  });

  it('the fold keeps every proposal with its own span (v2 fire span differs from the first-proposal span)', () => {
    const f = foldEvents(events());
    const fire = [...f.claims.values()].find((c) => c.documentId === 'cp-2024' && c.claim.subjectKey === 'fire.deductible')!;
    const byV = Object.fromEntries(fire.proposals.filter((p) => p.actor.kind === 'agent').map((p) => [p.extractorVersion, [p.spans[0].start, p.spans[0].end]]));
    expect(byV['claims@v1']).toEqual([4238, 4280]);
    expect(byV['claims@v2']).toEqual([4240, 4280]);
    expect(fire.claim.spans[0].start).toBe(4240 - 2); // the claim aggregate keeps the first span
    expect(extractorsFor(f, 'cp-2024')).toEqual(['claims@v1', 'claims@v2']);
    const rows = diffDocument(f, 'cp-2024', 'claims@v1', 'claims@v2');
    expect(Object.fromEntries(rows.map((r) => [r.subjectKey, r.status]))).toEqual({
      'fire.deductible': 'same', 'theft.deductible': 'changed', 'theft.coinsurance': 'changed', 'hail.deductible': 'only-from', 'liability.limit': 'only-to', 'theft.limit': 'only-to',
    });
  });

  it('projections-diff prints v1 (promoted) against v2 (candidate) for both editions and says CurrentBeliefs is unchanged', () => {
    const r = must('projections-diff').json!;
    expect(r).toMatchObject({ promoted: 'claims@v1', from: 'claims@v1', to: 'claims@v2', toIsPromoted: false, beliefsHash });
    const docs = r.documents as { documentId: string; rows: { status: string }[] }[];
    expect(docs.map((d) => d.documentId)).toEqual(['cp-2024', 'cp-2025']);
    expect(docs[1]!.rows.every((x) => x.status === 'same')).toBe(true);
    expect(tool(sb, 'projections-diff', '--text').stdout).toMatch(/claims@v1 \(promoted\)\s+vs\s+claims@v2 \(candidate\)/);
  });

  it('beliefs --at is VALID time: 2024-03-01 gives the 2024 edition (fire 500), today gives 750', () => {
    const at = must('beliefs', '--at', '2024-03-01').json!;
    expect(at).toMatchObject({ timeAxis: 'valid', documentId: 'cp-2024', effectiveFrom: '2024-01-01' });
    const fire = (at.beliefs as { subjectKey: string; value: string; verifiedBy: string; stateNow: string }[]).find((b) => b.subjectKey === 'fire.deductible')!;
    expect(fire).toMatchObject({ value: '500 EUR', verifiedBy: 'human:luca', stateNow: 'superseded' });
    const now = must('beliefs').json!;
    expect((now.beliefs as { subjectKey: string; value: string }[]).find((b) => b.subjectKey === 'fire.deductible')!.value).toBe('750 EUR');
    const later = must('beliefs', '--at', '2025-06-01').json!;
    expect(later).toMatchObject({ documentId: 'cp-2025' });
    expect((later.beliefs as { subjectKey: string; value: string }[]).find((b) => b.subjectKey === 'fire.deductible')!.value).toBe('750 EUR');
    expect(must('beliefs', '--at', '2023-01-01').json).toMatchObject({ documentId: null, beliefs: [] });
  });

  it('beliefs --seq is TRANSACTION time: the log as it was after event 15 believed 500', () => {
    const r = must('beliefs', '--seq', '15').json!;
    expect(r).toMatchObject({ timeAxis: 'current', transactionTime: { throughSeq: 15 } });
    expect((r.beliefs as { subjectKey: string; value: string }[]).find((b) => b.subjectKey === 'fire.deductible')!.value).toBe('500 EUR');
  });

  it('beliefs refuses a malformed date with one stderr line (exit 1)', () => {
    const r = tool(sb, 'beliefs', '--at', '01/03/2024');
    expect(r.status).toBe(1);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('segment 4 fallbacks exist and are labelled deterministic tool output', () => {
    for (const f of ['log-cat.txt', 'projections-rebuilt.txt', 'projections-diff.txt', 'beliefs-at-2024-03-01.txt']) {
      expect(read(join(root, 'fallback/seg4', f))).toMatch(/DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION/);
    }
  });
});
