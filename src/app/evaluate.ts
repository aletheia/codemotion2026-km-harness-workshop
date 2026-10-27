// golden / eval / drift over the event log. Read-only: nothing here writes an event.
// The golden set is a QUERY over the log (src/harness/golden.ts); these functions only choose the cut-off and render.
import { existsSync } from 'node:fs';
import { loadRecording } from '../adapters/documents';
import { repoPath } from '../adapters/paths';
import { subjectClassOf } from '../catalog/catalog';
import { config } from '../config';
import { formatValue } from '../domain/value';
import { drift, type DriftResult } from '../harness/eval/drift';
import { evaluate, type EvalResult, type ProposalView } from '../harness/eval/metrics';
import { goldenClaims, goldenStructure, goldenVersion } from '../harness/golden';
import type { Fold } from '../projections/fold';
import { loadFold } from './context';
import { Rejection, UsageError } from './errors';

const isCritical = (key: string): boolean => (config.criticalClasses as readonly string[]).includes(subjectClassOf(key));

/** Default cut-off: the event just before the SECOND edition is ingested (= after the first edition's reviews). */
export function defaultCut(f: Fold): number {
  const docs = [...f.docs.values()].sort((a, b) => a.seq - b.seq);
  return docs.length >= 2 ? docs[1]!.seq - 1 : f.lastSeq;
}

function parseUntil(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new UsageError('--until expects a positive event number');
  return n;
}

function promptExamples(extractor: string): string[] {
  if (!existsSync(repoPath(`fixtures/llm/${extractor}.json`))) return [];
  return loadRecording<unknown>(extractor).promptExampleIds ?? [];
}

export function golden(opts: { layer: string; until?: string }) {
  const f = loadFold();
  const until = parseUntil(opts.until);
  if (until !== undefined && until > f.lastSeq) throw new UsageError(`--until ${until} is beyond the end of the log (${f.lastSeq})`);
  const harnessOrImport = [...f.claims.values()].flatMap((r) => r.decisions.filter((d) => d.type === 'ClaimVerified' && d.actor.kind !== 'human' && (until === undefined || d.seq <= until)));
  if (opts.layer === 'claims') {
    const items = goldenClaims(f, until);
    return {
      layer: 'claims', version: goldenVersion('claims', f, until), untilSeq: until ?? null, count: items.length,
      excluded: { harnessVerified: harnessOrImport.filter((d) => d.actor.kind === 'harness').length, importVerified: harnessOrImport.filter((d) => d.actor.kind === 'import').length },
      items: items.map((i) => ({ itemId: i.itemId, document: `${i.documentId}@${i.version}`, subjectKey: i.subjectKey, value: i.valueText, span: i.span, verifiedBy: i.verifiedBy, seq: i.seq })),
    };
  }
  if (opts.layer === 'structure') {
    const items = goldenStructure(f, until);
    return {
      layer: 'structure', version: goldenVersion('structure', f, until), untilSeq: until ?? null, count: items.length,
      excluded: { harnessVerified: [...f.trees.values()].filter((t) => t.verifiedBy?.kind === 'harness' && (until === undefined || (t.verifiedSeq ?? 0) <= until)).length, importVerified: 0 },
      items: items.map((i) => ({ itemId: i.itemId, document: `${i.documentId}@${i.version}`, subjectKey: 'tree', value: `${i.nodes.length} nodes`, span: { start: 0, end: 0 }, verifiedBy: i.verifiedBy, seq: i.seq })),
    };
  }
  throw new UsageError(`unknown layer "${opts.layer}" (claims | structure)`);
}
export type GoldenResult = ReturnType<typeof golden>;

export function renderGolden(r: GoldenResult): string {
  const head = `golden set ${r.version}: ${r.count} expected item(s) = human ${r.layer === 'claims' ? 'ClaimVerified' : 'StructureVerified'} events${r.untilSeq ? ` with seq <= ${r.untilSeq}` : ' (no cut-off)'}; excluded: ${r.excluded.harnessVerified} harness-verified, ${r.excluded.importVerified} import-verified`;
  const rows = r.items.map((i) => `  seq ${String(i.seq).padStart(3)}  ${i.document.padEnd(12)} ${i.subjectKey.padEnd(20)} ${i.value.padEnd(14)} ${r.layer === 'claims' ? `[${i.span.start},${i.span.end})`.padEnd(12) : ''} ${i.verifiedBy}`.trimEnd());
  return [head, ...rows].join('\n');
}

export function proposalsOf(f: Fold, extractor: string, documentIds: ReadonlySet<string>): ProposalView[] {
  const out: ProposalView[] = [];
  for (const rec of f.claims.values()) {
    if (!documentIds.has(rec.documentId)) continue;
    for (const p of rec.proposals) {
      if (p.actor.kind !== 'agent' || p.extractorVersion !== extractor) continue;
      out.push({ claimId: rec.claim.claimId, documentId: rec.documentId, subjectKey: rec.claim.subjectKey, valueText: p.valueText, value: rec.claim.value, span: { start: p.spans[0].start, end: p.spans[0].end }, seq: p.seq });
    }
  }
  return out.sort((a, b) => a.seq - b.seq);
}

export interface EvalOutput { extractor: string; goldenVersion: string; untilSeq: number; expectedItems: number; excludedPromptExamples: number; bases: Record<string, number>; result: EvalResult }

export function evalExtractor(f: Fold, extractor: string, untilRaw?: string): EvalOutput {
  const until = parseUntil(untilRaw) ?? defaultCut(f);
  const excludeIds = promptExamples(extractor);
  const items = goldenClaims(f, until, { excludeIds });
  if (items.length === 0) throw new Rejection(`golden set claims@${until} is empty: nothing to evaluate against`);
  const docs = new Set(items.map((i) => i.documentId));
  const props = proposalsOf(f, extractor, docs);
  if (props.length === 0) throw new Rejection(`no proposals by ${extractor} for ${[...docs].join(', ')}; replay it first: npm run replay -- --extractor ${extractor}`);
  const bases: Record<string, number> = {};
  for (const d of docs) {
    const tree = [...f.trees.values()].find((t) => t.documentId === d);
    bases[d] = tree?.nodes.find((n) => n.path === config.sectionPath)?.start ?? 0;
  }
  return { extractor, goldenVersion: goldenVersion('claims', f, until), untilSeq: until, expectedItems: items.length, excludedPromptExamples: excludeIds.length, bases, result: evaluate(items, props, config.thetaIoU, isCritical) };
}

const f2 = (x: number): string => x.toFixed(2);
const span = (s: { start: number; end: number }, base: number): string => `[${s.start},${s.end}) [${s.start - base},${s.end - base})`;

export function renderEval(o: EvalOutput, summary: boolean): string {
  const r = o.result;
  const head = `eval ${o.extractor} on golden set ${o.goldenVersion}: ${o.expectedItems} expected item(s), theta ${f2(r.theta)}; spans are absolute [start,end) with the section-local form after them`;
  const agg = `TP ${r.tp}  FP ${r.fp}  FN ${r.fn}   precision ${f2(r.precision)}  recall ${f2(r.recall)}`;
  if (summary) return `${head}\n${agg}`;
  const cell = (x: { valueText: string; span: { start: number; end: number } } | null, doc: string) => (x ? `${x.valueText} ${span(x.span, o.bases[doc] ?? 0)}` : '-');
  const w1 = Math.max(10, ...r.rows.map((x) => cell(x.expected, x.documentId).length));
  const w2 = Math.max(10, ...r.rows.map((x) => cell(x.proposed, x.documentId).length));
  const lines = r.rows.map((x) => {
    const iou = x.iou === null ? '-' : `${f2(x.iou)} (${x.inter}/${x.union})`;
    const out = x.outcome === 'WRONG' ? `wrong ${x.wrong}: 1 FP + 1 FN` : x.outcome === 'TP' ? 'correct: TP' : x.outcome === 'MISSED' ? 'not proposed: FN' : 'not expected: FP';
    return `  ${x.subjectKey.padEnd(20)} ${cell(x.expected, x.documentId).padEnd(w1)}  ${cell(x.proposed, x.documentId).padEnd(w2)}  ${iou.padEnd(12)} ${out}`;
  });
  return [head, `  ${'subject'.padEnd(20)} ${'expected'.padEnd(w1)}  ${'proposed'.padEnd(w2)}  ${'IoU'.padEnd(12)} outcome`, ...lines, agg].join('\n');
}

export function driftQuery(from: string, to: string, untilRaw?: string) {
  const f = loadFold();
  const a = evalExtractor(f, from, untilRaw);
  const b = evalExtractor(f, to, untilRaw);
  const d = drift(a.result, b.result, config.thetaIoU);
  const alreadyPromoted = f.promotions.some((p) => p.extractor === 'claims' && p.version === to);
  return { from, to, goldenVersion: a.goldenVersion, evalFrom: a, evalTo: b, drift: d, alreadyPromoted, promotionEventEmitted: false };
}
export type DriftOutput = ReturnType<typeof driftQuery>;

export function renderDrift(o: DriftOutput): string {
  const { drift: d } = o;
  const out: string[] = [`drift ${o.from} -> ${o.to} on golden set ${o.goldenVersion} (per item; aggregates are not compared)`];
  out.push(`  aggregate: precision ${f2(o.evalFrom.result.precision)} -> ${f2(o.evalTo.result.precision)}, recall ${f2(o.evalFrom.result.recall)} -> ${f2(o.evalTo.result.recall)} (TP/FP/FN ${o.evalFrom.result.tp}/${o.evalFrom.result.fp}/${o.evalFrom.result.fn} -> ${o.evalTo.result.tp}/${o.evalTo.result.fp}/${o.evalTo.result.fn})`);
  out.push('', `  ${'item'.padEnd(20)} ${o.from.padEnd(24)} ${o.to.padEnd(24)} cell`);
  for (const i of d.items) {
    const c = (r: typeof i.from) => (r.outcome === 'TP' ? `correct ${r.proposed!.valueText}` : r.outcome === 'MISSED' ? 'not proposed' : `wrong ${r.proposed!.valueText}`);
    out.push(`  ${i.subjectKey.padEnd(20)} ${c(i.from).padEnd(24)} ${c(i.to).padEnd(24)} ${i.cell.toUpperCase()}${i.cell === 'regression' && i.critical ? '  (monetary: critical subset)' : ''}`);
  }
  out.push('', `  noise in ${o.to} (proposals with no expected item): ${d.noise.length ? d.noise.map((n) => `${n.subjectKey} = ${n.valueText}${n.newIn === 'to' ? ' (new)' : ''}`).join('; ') : 'none'}`);
  out.push(`  provenance drift on value-correct items: ${d.provenance.length ? d.provenance.map((p) => `${p.subjectKey} IoU ${f2(p.iouFrom)} -> ${f2(p.iouTo)}${p.crossedTheta ? ' (crosses theta)' : ''}`).join('; ') : 'none'}`);
  out.push('', '  promotion criteria (all four must hold):');
  for (const c of d.criteria) out.push(`    ${c.n}. ${c.name}: ${c.met ? 'met' : 'FAILED'} (${c.detail})`);
  out.push('', d.meetsAll
    ? `  all criteria met; promoting ${o.to} is a human decision (ExtractorVersionPromoted, actor human): none is emitted here`
    : `  criteria failed: [${d.failed.join(', ')}]. ${o.to} is NOT promoted: no ExtractorVersionPromoted event is emitted; its proposals stay in the log as a candidate nobody consumes.`);
  return out.join('\n');
}
