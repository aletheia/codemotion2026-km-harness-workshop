// Command bodies shared by the segment dispatchers (tools/segN.ts) and the stand-alone aliases
// (tools/compare.ts, tools/beliefs.ts, ...). Each one parses its own flags and calls emit().
import { readFileSync } from 'node:fs';
import { catRows, causationChain, renderCat, firstSeqOfType } from '../../src/app/query';
import { projectionsBuild, projectionsDrop } from '../../src/app/projections';
import { projectionsDiff, renderDiff } from '../../src/app/projectionsDiff';
import { queryBeliefs, renderBeliefs } from '../../src/app/beliefs';
import { readAll } from '../../src/adapters/eventLog';
import { driftQuery, evalExtractor, golden, renderDrift, renderEval, renderGolden } from '../../src/app/evaluate';
import { ask, renderAsk } from '../../src/app/ask';
import { loadFold } from '../../src/app/context';
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

// ---- segment 4 ----

export function cmdLogCat(args: Args, command: string): void {
  const chain = flag(args, 'chain');
  if (chain) {
    const ref = chain === 'superseded' ? String(firstSeqOfType('ClaimSuperseded')) : chain;
    const rows = causationChain(ref);
    return emit(command, { chainTo: rows[rows.length - 1]!.seq, events: rows }, `causation chain, root first:\n${renderCat(rows)}`, args);
  }
  const rows = catRows(readAll());
  emit(command, { total: rows.length, events: rows }, renderCat(rows), args);
}

export function cmdProjectionsDrop(args: Args, command: string): void {
  const r = projectionsDrop();
  emit(command, r, `${r.dropped ? 'dropped' : 'no file on disk; nothing to drop:'} ${r.file}; CurrentBeliefs hash before the drop: ${r.hashBeforeDrop} (from the ${r.hashSource})`, args);
}

export function cmdProjectionsBuild(args: Args, command: string): void {
  const r = projectionsBuild();
  const cmp = r.matchesDropped === null ? '' : r.matchesDropped ? `; identical to the hash before the drop (${r.hashBeforeDrop})` : `; DIFFERENT from the hash before the drop (${r.hashBeforeDrop})`;
  emit(command, r, `rebuilt ${r.file} from ${r.builtFromEvents} events: ${r.currentBeliefs} beliefs, hash ${r.hash}${cmp}`, args);
}

export function cmdProjectionsDiff(args: Args, command: string): void {
  const r = projectionsDiff({ from: flag(args, 'from'), to: flag(args, 'to'), doc: flag(args, 'doc') });
  emit(command, r as unknown as Record<string, unknown>, renderDiff(r), args);
}

export function cmdBeliefs(args: Args, command: string): void {
  const seq = flag(args, 'seq');
  const r = queryBeliefs({ at: flag(args, 'at'), seq: seq === undefined ? undefined : Number(seq) });
  emit(command, r as unknown as Record<string, unknown>, renderBeliefs(r), args);
}

// ---- segment 5 ----

export function cmdGolden(args: Args, command: string): void {
  const r = golden({ layer: flag(args, 'layer') ?? 'claims', until: flag(args, 'until') });
  emit(command, r as unknown as Record<string, unknown>, renderGolden(r), args);
}

export function cmdEval(args: Args, command: string): void {
  const extractor = flag(args, 'extractor');
  if (!extractor) throw new UsageError('missing --extractor (for example claims@v1)');
  const o = evalExtractor(loadFold(), extractor, flag(args, 'until'));
  const data = args.flags.summary
    ? { extractor: o.extractor, goldenVersion: o.goldenVersion, expectedItems: o.expectedItems, tp: o.result.tp, fp: o.result.fp, fn: o.result.fn, precision: o.result.precision, recall: o.result.recall }
    : (o as unknown as Record<string, unknown>);
  emit(command, data, renderEval(o, Boolean(args.flags.summary)), args);
}

export function cmdDrift(args: Args, command: string): void {
  const from = flag(args, 'from');
  const to = flag(args, 'to');
  if (!from || !to) throw new UsageError('usage: drift --from claims@v1 --to claims@v2 [--until N]');
  const o = driftQuery(from, to, flag(args, 'until'));
  emit(command, o as unknown as Record<string, unknown>, renderDrift(o), args);
}

// ---- segment 6 ----

export function cmdAsk(args: Args, command: string): void {
  const q = flag(args, 'q');
  if (!q) throw new UsageError('missing --q "<question>" (for example --q "franchigia incendio")');
  const r = ask(q, flag(args, 'as-of'));
  emit(command, r as unknown as Record<string, unknown>, renderAsk(r), args);
}
