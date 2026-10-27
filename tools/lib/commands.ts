// Command bodies shared by the segment dispatchers (tools/segN.ts) and the stand-alone aliases
// (tools/compare.ts, tools/beliefs.ts, ...). Each one parses its own flags and calls emit().
import { readFileSync } from 'node:fs';
import { editionByDocumentId } from '../../src/adapters/documents';
import { repoPath } from '../../src/adapters/paths';
import { compareDocument, reconfirmStructure } from '../../src/app/compare';
import { UsageError } from '../../src/app/errors';
import { extractClaims } from '../../src/app/extractClaims';
import { extractStructure } from '../../src/app/structure';
import { emit, flag, type Args } from './cli';
import { latestDocumentId } from './review';

export function cmdExtractLayers(args: Args, command: string): void {
  const doc = flag(args, 'doc') ?? latestDocumentId();
  if (!editionByDocumentId(doc)) throw new UsageError(`unknown document ${doc}`);
  const layers = (flag(args, 'layers') ?? 'structure,claims').split(',').map((s) => s.trim());
  for (const l of layers) if (l !== 'structure' && l !== 'claims') throw new UsageError(`unknown layer "${l}" (structure | claims)`);
  const section = flag(args, 'section') ?? 'art12';
  const out: Record<string, unknown> = { documentId: doc };
  const lines: string[] = [];
  let structureOk = true;
  if (layers.includes('structure')) {
    const s = extractStructure(doc);
    const c = reconfirmStructure(doc);
    out.structure = { proposed: s.event, comparator: c };
    lines.push(`${s.extractor} proposed ${s.nodes} nodes for ${doc} -> seq ${s.event.seq}`);
    if (c.status === 'reconfirmed') lines.push(`structure comparator: class A, StructureVerified by harness -> seq ${c.event!.seq}; ${c.gate}`);
    else if (c.status === 'queued') { structureOk = false; lines.push(`structure comparator: queued for human review (${c.reason})`); }
  }
  if (layers.includes('claims')) {
    if (!structureOk) throw new UsageError(`structure of ${doc} is not verified: review it first (npm run seg2 -- review --stage structure --doc ${doc})`);
    const r = extractClaims(doc, section);
    out.claims = r;
    lines.push(`${r.extractor} proposed ${r.proposed.length} claims for ${r.unit}`, ...r.proposed.map((p) => `  ${p.seq}  ${p.subjectKey} = ${p.valueText}`));
  }
  emit(command, out, lines.join('\n'), args);
}

export function cmdCompare(args: Args, command: string): void {
  const doc = flag(args, 'doc') ?? latestDocumentId();
  const r = compareDocument(doc);
  const lines = [
    `comparator on ${r.documentId}: A ${r.counts.A}, B ${r.counts.B}, C ${r.counts.C}, unexpected ${r.counts.UNEXPECTED}`,
    r.gate,
    ...r.rows.map((x) => `  ${x.cls}  ${x.subjectKey.padEnd(20)} ${x.value.padEnd(14)} ${x.action}${x.seq.length ? `  (seq ${x.seq.join(',')})` : ''}`),
  ];
  emit(command, r as unknown as Record<string, unknown>, lines.join('\n'), args);
}

export function cmdLayers46(args: Args, command: string): void {
  const raw = readFileSync(repoPath('fixtures/precomputed/layers-4-6.jsonl'), 'utf8').trimEnd().split('\n');
  const events = raw.map((l) => JSON.parse(l) as Record<string, unknown>);
  emit(command, { precomputed: true, note: 'hand-written excerpt, not produced by an executed extractor, not in events/', events }, raw.join('\n'), args);
}
