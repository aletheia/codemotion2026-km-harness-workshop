// ask: answer a question from the PROJECTION only, with the belief cited. Raw documents are never read.
//   --as-of DATE is VALID time: the edition in force on DATE (from its effective date). No date: the newest edition.
import { CATALOG, subjectClassOf, type CatalogEntry } from '../catalog/catalog';
import { consume, ruleFor } from '../domain/consumption';
import { short } from '../domain/ids';
import { formatValue } from '../domain/value';
import { config } from '../config';
import type { ClaimRec, Fold } from '../projections/fold';
import { editionInForce, toBelief } from '../projections/views';
import { loadFold } from './context';
import { Rejection, UsageError } from './errors';

const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const tokens = (s: string): string[] => fold(s).split(/[^a-z0-9.]+/).filter((t) => t.length >= 4);

export function resolveSubject(q: string): CatalogEntry {
  const qt = new Set(tokens(q));
  const byKey = CATALOG.find((c) => fold(q).includes(c.subjectKey));
  if (byKey) return byKey;
  const hits = CATALOG.filter((c) => tokens(c.label).every((t) => qt.has(t)));
  if (hits.length === 1) return hits[0]!;
  const known = CATALOG.map((c) => `"${c.label.toLowerCase()}"`).join(', ');
  throw new Rejection(hits.length === 0 ? `no subject in the catalogue matches "${q}" (known: ${known})` : `"${q}" matches several subjects: ${hits.map((h) => h.subjectKey).join(', ')}`);
}

const rank = (r: ClaimRec): number => (r.decisions.some((d) => d.type === 'ClaimVerified') && (r.state === 'verified' || r.state === 'superseded') ? 3 : r.state === 'contested' ? 2 : 1);
const verifiedSeq = (r: ClaimRec): number => [...r.decisions].reverse().find((d) => d.type === 'ClaimVerified')?.seq ?? 0;

export interface AskResult {
  question: string; asOf: string; timeAxis: 'valid' | 'current';
  subjectKey: string; label: string; subjectClass: string; policy: { rule: string };
  edition: { documentId: string; version: string; effectiveFrom: string; inForceUntil: string | null };
  answerable: boolean;
  answer: { value: string } | null;
  refusal: string | null;
  claim: { claimId: string; state: string; value: string } | null;
  belief: null | {
    claimId: string; verifiedBy: string; verifiedSeq: number; root: string; rootActor: string | null; rootSeq: number | null; chain: string[];
    document: string; reviewedSpan: { start: number; end: number }; proposedSpan: { start: number; end: number }; quote: string;
    afterContestedSeq: number | null; successorOf: string | null; supersededBy: { claimId: string; seq: number; value: string } | null;
  };
  otherClaims: { claimId: string; state: string; value: string }[];
  logReadThroughSeq: number;
  sources: string;
}

export function ask(q: string, asOf: string | undefined, f: Fold = loadFold()): AskResult {
  if (!q.trim()) throw new UsageError('missing --q "<question>"');
  if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new UsageError(`--as-of expects YYYY-MM-DD, got "${asOf}"`);
  const subject = resolveSubject(q);
  const documentId = editionInForce(f, config.lineageId, asOf ?? '9999-12-31');
  const doc = documentId ? f.docs.get(documentId) : undefined;
  if (!doc) throw new Rejection(asOf ? `no edition was in force on ${asOf}` : 'no document has been ingested');
  const next = [...f.docs.values()].filter((d) => d.lineageId === doc.lineageId && d.effectiveFrom > doc.effectiveFrom).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const cls = subjectClassOf(subject.subjectKey);
  const recs = [...f.claims.values()].filter((r) => r.documentId === doc.documentId && r.claim.subjectKey === subject.subjectKey)
    .sort((a, b) => rank(b) - rank(a) || verifiedSeq(b) - verifiedSeq(a) || b.firstSeq - a.firstSeq);
  const base = {
    question: q, asOf: asOf ?? 'now', timeAxis: (asOf ? 'valid' : 'current') as 'valid' | 'current',
    subjectKey: subject.subjectKey, label: subject.label, subjectClass: cls, policy: { rule: ruleFor(cls) },
    edition: { documentId: doc.documentId, version: doc.version, effectiveFrom: doc.effectiveFrom, inForceUntil: next?.effectiveFrom ?? null },
    logReadThroughSeq: f.lastSeq,
    sources: 'projection only (CurrentBeliefs, Timeline); raw documents: not read',
  };
  const brief = (r: ClaimRec) => ({ claimId: r.claim.claimId, state: r.state, value: formatValue(r.claim.value) });
  const top = recs[0];
  if (!top) return { ...base, answerable: false, answer: null, refusal: `no claim about ${subject.subjectKey} is on record for edition ${doc.documentId}`, claim: null, belief: null, otherClaims: [], logReadThroughSeq: f.lastSeq };
  const others = recs.slice(1).map(brief);

  if (rank(top) < 3) {
    const c = consume({ subjectClass: cls, state: top.state, root: 'harness-only', verifier: null });
    return { ...base, answerable: false, answer: null, refusal: c.usable ? '' : c.reason, claim: brief(top), belief: null, otherClaims: others };
  }
  const b = toBelief(f, top);
  const c = consume({ subjectClass: cls, state: 'verified', root: b.root, verifier: b.verifiedBy.kind });
  const rootRec = f.claims.get(b.chain[b.chain.length - 1]!);
  const rootSeq = rootRec ? [...rootRec.decisions].reverse().find((d) => d.type === 'ClaimVerified')?.seq ?? null : null;
  const reviewed = b.verification.evidence?.kind === 'human' ? b.verification.evidence.reviewedSpans?.[0] : undefined;
  const prop = top.claim.spans[0];
  // the span this claim carries: the reviewer's if a human reviewed it, else the proposal's. A reconfirmed
  // claim's own span is its own proposal's span; the root's reviewed span is not copied onto it.
  const sp = reviewed ?? prop;
  const contested = [...top.decisions].reverse().find((d) => d.type === 'ClaimContested');
  const predecessor = [...f.claims.values()].find((r) => r.claim.successor === top.claim.claimId);
  const sup = [...top.decisions].reverse().find((d) => d.type === 'ClaimSuperseded');
  const succ = sup && top.claim.successor ? f.claims.get(top.claim.successor) : undefined;
  const belief = {
    claimId: top.claim.claimId, verifiedBy: `${b.verifiedBy.kind}:${b.verifiedBy.id}`, verifiedSeq: b.verification.seq, root: b.root,
    rootActor: b.rootActor ? `${b.rootActor.kind}:${b.rootActor.id}` : null, rootSeq, chain: b.chain,
    document: `${top.documentId}@${top.version}`, reviewedSpan: { start: sp.start, end: sp.end }, proposedSpan: { start: prop.start, end: prop.end }, quote: top.quote,
    afterContestedSeq: contested && contested.seq < b.verification.seq ? contested.seq : null,
    successorOf: predecessor?.claim.claimId ?? null,
    supersededBy: sup && succ ? { claimId: succ.claim.claimId, seq: sup.seq, value: formatValue(succ.claim.value) } : null,
  };
  if (!c.usable) return { ...base, answerable: false, answer: null, refusal: c.reason, claim: brief(top), belief, otherClaims: others };
  return { ...base, answerable: true, answer: { value: formatValue(top.claim.value) }, refusal: null, claim: brief(top), belief, otherClaims: others };
}

export function renderAsk(r: AskResult): string {
  const ed = r.edition;
  const out = [`ask  "${r.question}"  as-of=${r.asOf}  policy: ${r.subjectClass} → ${r.policy.rule}`, `subject: ${r.subjectKey} (${r.label}); edition ${ed.documentId}@${ed.version}, in force ${ed.effectiveFrom} → ${ed.inForceUntil ?? 'open'}`];
  const b = r.belief;
  if (!r.answerable) {
    out.push(`answer: none. The agent cannot assert this.`, `  reason: ${r.refusal}`);
    if (r.claim) out.push(`  on record: ${r.claim.value}, claim ${short(r.claim.claimId)}, state ${r.claim.state} (not an answer)`);
    if (b) out.push(`  belief ${short(b.claimId)} verified by ${b.verifiedBy} at seq ${b.verifiedSeq}; root ${b.rootActor ?? b.root}`);
  } else if (b) {
    out.push(`answer: ${r.answer!.value}`);
    out.push(`  belief   ${short(b.claimId)}  verified by ${b.verifiedBy} at seq ${b.verifiedSeq}${b.afterContestedSeq !== null ? ` after ClaimContested seq ${b.afterContestedSeq}` : ''}${b.successorOf ? `   successor of ${short(b.successorOf)}` : ''}`);
    if (b.root === 'human' && b.verifiedBy.startsWith('harness')) out.push(`  chain    class-A reconfirmation by the harness; root: ${b.rootActor} at seq ${b.rootSeq}; ${b.chain.map((c) => short(c)).join(' → ')}`);
    const spanTxt = `${b.document} [${b.reviewedSpan.start},${b.reviewedSpan.end})`;
    const differs = b.proposedSpan.start !== b.reviewedSpan.start || b.proposedSpan.end !== b.reviewedSpan.end;
    out.push(`  evidence span ${spanTxt}  "${b.quote}"${differs ? `  (proposed span [${b.proposedSpan.start},${b.proposedSpan.end}); the verified span is the reviewer's)` : ''}`);
    if (b.supersededBy) out.push(`  superseded later by ${short(b.supersededBy.claimId)} (${b.supersededBy.value}, seq ${b.supersededBy.seq}) — not applicable on ${r.asOf}`);
  }
  if (r.otherClaims.length) out.push(`  other claims on this subject in this edition: ${r.otherClaims.map((o) => `${o.value} (${o.state}, ${short(o.claimId)})`).join('; ')}`);
  out.push(`log read through seq ${r.logReadThroughSeq}; sources consulted: ${r.sources}`);
  return out.join('\n');
}
