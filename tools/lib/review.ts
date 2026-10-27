// Interactive and scripted (--auto) review sessions. The prompts live here (adapter);
// the decisions are committed through src/app/review.ts, so a human and the script take the same path.
import { createInterface } from 'node:readline/promises';
import { readJson } from '../../src/adapters/documents';
import { documentText } from '../../src/adapters/documents';
import { loadFold } from '../../src/app/context';
import { UsageError, Rejection } from '../../src/app/errors';
import { addClaimByHand, contestedClaims, findClaimBySubject, proposedClaims, resolveContested, verifyClaim } from '../../src/app/review';
import { treeSummary, verifyStructure, treeIdOf } from '../../src/app/structure';
import { fmtSpan } from '../../src/domain/span';

interface Script {
  structure: { note: string };
  claims: Record<string, ({ action: 'verify'; subjectKey: string; valueText: string; note: string; reviewedSpan?: { start: number; end: number } }
    | { action: 'add'; subjectKey: string; valueText: string; note: string; start: number; end: number; quote: string })[]>;
  contested: Record<string, { action: 'accept-new' | 'keep-old'; subjectKey: string; valueText: string; note: string; reviewedSpan?: { start: number; end: number } }[]>;
}
export const loadScript = (): Script => readJson<Script>('fixtures/review-script.json');

export function latestDocumentId(): string {
  const f = loadFold();
  const docs = [...f.docs.values()].sort((a, b) => b.seq - a.seq);
  if (docs.length === 0) throw new UsageError('no document ingested yet');
  return docs[0]!.documentId;
}

export function nextStage(documentId: string): 'structure' | 'claims' | 'contested' {
  const f = loadFold();
  const t = f.trees.get(treeIdOf(documentId));
  if (t && !t.verifiedEventId) return 'structure';
  return contestedClaims(f).some((c) => c.documentId === documentId) ? 'contested' : 'claims';
}

type Log = (s: string) => void;

export async function reviewStructure(documentId: string, auto: boolean, log: Log) {
  const f = loadFold();
  const t = f.trees.get(treeIdOf(documentId));
  if (!t) throw new UsageError(`no structure proposed for ${documentId}; run: npm run seg2 -- extract structure --doc ${documentId}`);
  log(`Proposed structure of ${documentId}: ${JSON.stringify(treeSummary(t))}`);
  for (const n of t.nodes) log(`  ${n.path.padEnd(6)} ${n.type.padEnd(8)} ${fmtSpan(n).padEnd(14)} ${n.title}`);
  if (auto) return verifyStructure(documentId, loadScript().structure.note);
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const ans = (await rl.question('Verify this structure? [y/N] ')).trim().toLowerCase();
    if (ans !== 'y') throw new Rejection('structure not verified (nothing written)');
    const note = (await rl.question('Note: ')).trim() || 'verified by reviewer';
    return verifyStructure(documentId, note);
  } finally { rl.close(); }
}

export async function reviewClaims(documentId: string, auto: boolean, log: Log) {
  const done: { action: string; subjectKey: string; valueText: string; seq: number[] }[] = [];
  if (auto) {
    const steps = loadScript().claims[documentId] ?? [];
    if (steps.length === 0) throw new UsageError(`no scripted decisions for ${documentId} in fixtures/review-script.json`);
    for (const s of steps) {
      if (s.action === 'verify') {
        const rec = findClaimBySubject(loadFold(), documentId, s.subjectKey, s.valueText, ['proposed', 'contested']);
        if (!rec) throw new Rejection(`scripted claim ${s.subjectKey} = ${s.valueText} is not pending for ${documentId}`);
        done.push({ action: 'verify', subjectKey: s.subjectKey, valueText: s.valueText, seq: verifyClaim(rec.claim.claimId, s.note, s.reviewedSpan).map((o) => o.seq) });
      } else {
        const r = addClaimByHand({ documentId, subjectKey: s.subjectKey, valueText: s.valueText, quote: s.quote, span: { start: s.start, end: s.end }, note: s.note });
        done.push({ action: 'add', subjectKey: s.subjectKey, valueText: s.valueText, seq: r.map((o) => o.seq) });
      }
    }
    return done;
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const text = documentText(documentId);
    for (const rec of proposedClaims(loadFold(), documentId)) {
      const sp = rec.claim.spans[0];
      log(`\n${rec.claim.subjectKey} = ${rec.valueText}   span ${fmtSpan(sp)}   (${rec.claim.claimId.slice(0, 8)})`);
      log(`  quote : ${rec.quote}`);
      log(`  source: ${text.slice(sp.start, sp.end).replace(/\n/g, '⏎')}`);
      const a = (await rl.question('  [v]erify / [s]kip: ')).trim().toLowerCase();
      if (a === 'v') {
        const note = (await rl.question('  note: ')).trim() || 'verified by reviewer';
        done.push({ action: 'verify', subjectKey: rec.claim.subjectKey, valueText: rec.valueText, seq: verifyClaim(rec.claim.claimId, note).map((o) => o.seq) });
      }
    }
    while ((await rl.question('\nAdd a claim by hand? [y/N] ')).trim().toLowerCase() === 'y') {
      const subjectKey = (await rl.question('  subject key (e.g. liability.limit): ')).trim();
      const valueText = (await rl.question('  value as written (e.g. 1.000.000 EUR): ')).trim();
      const [start, end] = (await rl.question('  absolute span start,end: ')).split(',').map((x) => Number(x.trim())) as [number, number];
      const quote = (await rl.question('  verbatim quote: ')).trim();
      const note = (await rl.question('  note: ')).trim() || 'added by reviewer';
      const r = addClaimByHand({ documentId, subjectKey, valueText, quote, span: { start, end }, note });
      done.push({ action: 'add', subjectKey, valueText, seq: r.map((o) => o.seq) });
    }
    return done;
  } finally { rl.close(); }
}

/** Human resolution of contested claims: accept the new value (the old belief is superseded) or keep the old one. */
export async function reviewContested(documentId: string, auto: boolean, log: Log) {
  const done: { action: string; subjectKey: string; valueText: string; seq: number[] }[] = [];
  const pending = () => contestedClaims(loadFold()).filter((c) => c.documentId === documentId);
  if (pending().length === 0) throw new Rejection(`no contested claims for ${documentId}`);
  if (auto) {
    const steps = loadScript().contested[documentId] ?? [];
    if (steps.length === 0) throw new UsageError(`no scripted resolutions for ${documentId} in fixtures/review-script.json`);
    for (const s of steps) {
      const rec = pending().find((c) => c.claim.subjectKey === s.subjectKey && c.valueText === s.valueText);
      if (!rec) throw new Rejection(`scripted contested claim ${s.subjectKey} = ${s.valueText} is not pending for ${documentId}`);
      done.push({ action: s.action, subjectKey: s.subjectKey, valueText: s.valueText, seq: resolveContested(rec.claim.claimId, s.action, s.note, s.reviewedSpan).map((o) => o.seq) });
    }
    return done;
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const text = documentText(documentId);
    for (const rec of pending()) {
      const sp = rec.claim.spans[0];
      const ev = [...rec.decisions].reverse().find((d) => d.type === 'ClaimContested')?.evidence;
      log(`\n${rec.claim.subjectKey}: proposed ${rec.valueText} ${fmtSpan(sp)} against belief ${ev?.kind === 'class-C' ? ev.beliefValue : '?'}`);
      log(`  source: ${text.slice(sp.start, sp.end).replace(/\n/g, '⏎')}`);
      const a = (await rl.question('  [a]ccept new value (supersedes the belief) / [k]eep the belief / [s]kip: ')).trim().toLowerCase();
      if (a !== 'a' && a !== 'k') continue;
      const note = (await rl.question('  note: ')).trim() || 'resolved by reviewer';
      const action = a === 'a' ? 'accept-new' : 'keep-old';
      done.push({ action, subjectKey: rec.claim.subjectKey, valueText: rec.valueText, seq: resolveContested(rec.claim.claimId, action, note).map((o) => o.seq) });
    }
    return done;
  } finally { rl.close(); }
}
