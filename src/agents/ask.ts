// The consuming agent of segment 6: answers a question on one subject from the projections, never from the
// documents and never from the log. Its inputs are CurrentBeliefs (what is believed now) and Timeline (every
// claim with its period, span, quoted text and decisions), as projections:build writes them.
//
// Consumption policy (00-running-example.md §8): a monetary or time-limit quantity is asserted only from a
// verified belief whose evidence chain is rooted in a human decision. The policy is applied to the root of the
// chain, so a harness class-A reconfirmation of a human-verified claim qualifies (clm-eserc2b → clm-eserc2 →
// human(luca)). A proposed or contested claim is never asserted, whatever its class: the agent says it is pending.
import { displayValue } from '../catalog/normalizer';
import { lookupSubject, subjectBySynonym, type SubjectClass } from '../catalog/subjects';
import type { NormalizedValue } from '../domain/claim';
import type { Span } from '../domain/span';
import type { Belief } from '../harness/beliefs/currentBeliefs';
import type { ClaimTimeline, TimelineEntry } from '../projections/timeline';

/** Classes whose answers must be rooted in a human decision. */
export const HUMAN_ROOTED_CLASSES: ReadonlySet<SubjectClass> = new Set(['monetary', 'time-limit']);

export const POLICY_TEXT = 'monetary, time-limit → human-rooted verified only';

export interface AskProjections {
  readonly currentBeliefs: Readonly<Record<string, readonly Belief[]>>;     // CurrentBeliefs.json
  readonly timeline: Readonly<Record<string, ClaimTimeline>>;               // Timeline.json
}

export interface AskQuery {
  readonly question: string;
  readonly lineageId: string;
  /** Valid time (YYYY-MM-DD); absent = now, i.e. CurrentBeliefs. */
  readonly asOf?: string;
  /** Explicit subject; otherwise resolved from the question through the catalogue synonyms. */
  readonly subjectKey?: string;
}

/** A decision as cited on screen: actor and seq. */
export interface Cited {
  readonly actor: string;                    // 'human(luca)'
  readonly seq: number;
}

export interface Answered {
  readonly kind: 'answered';
  readonly subjectKey: string;
  readonly claimId: string;
  readonly label: string;
  readonly value: NormalizedValue;
  readonly verified: Cited;
  /** The human or import decision the chain ends at; equal to `verified` unless this is a class-A reconfirmation. */
  readonly root: Cited & { readonly label: string };
  readonly contested?: Cited;
  readonly predecessor?: string;             // label of the claim this one superseded
  readonly supersededLater?: { readonly label: string; readonly seq: number };
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly span: Span;
  readonly quote: string;
}

export interface Refused {
  readonly kind: 'refused';
  readonly subjectKey: string;
  readonly reason: string;
  /** Claims on the subject that exist but cannot be asserted (proposed, contested). */
  readonly pending: readonly { readonly label: string; readonly state: string }[];
}

export type Answer = Answered | Refused;

const lastOf = (t: ClaimTimeline, type: string): TimelineEntry | undefined => t.entries.filter((e) => e.type === type).at(-1);
const stateOf = (t: ClaimTimeline): string => t.entries.at(-1)?.state ?? 'proposed';

/** Follows class-A reconfirmations back to the decision that is not the harness's. */
function rootOf(timeline: AskProjections['timeline'], claimId: string): Answered['root'] {
  const t = timeline[claimId]!;
  const v = lastOf(t, 'ClaimVerified')!;
  if (v.reconfirmed) return rootOf(timeline, v.reconfirmed);
  return { actor: v.actor, seq: v.seq, label: t.label };
}

function answered(p: AskProjections, subjectKey: string, claimId: string, asOf: string | undefined): Answered {
  const t = p.timeline[claimId]!;
  const v = lastOf(t, 'ClaimVerified')!;
  const contested = lastOf(t, 'ClaimContested');
  const predecessor = Object.values(p.timeline).find((x) => x.entries.some((e) => e.type === 'ClaimSuperseded' && e.successor === claimId));
  const superseded = lastOf(t, 'ClaimSuperseded');
  return {
    kind: 'answered', subjectKey, claimId, label: t.label, value: t.value,
    verified: { actor: v.actor, seq: v.seq },
    root: rootOf(p.timeline, claimId),
    ...(contested ? { contested: { actor: contested.actor, seq: contested.seq } } : {}),
    ...(predecessor ? { predecessor: predecessor.label } : {}),
    ...(asOf && superseded ? { supersededLater: { label: p.timeline[superseded.successor!]!.label, seq: superseded.seq } } : {}),
    ...(t.validFrom ? { validFrom: t.validFrom } : {}), ...(t.validTo ? { validTo: t.validTo } : {}),
    span: t.span, quote: t.quote,
  };
}

/** The claim believed on `date`: verified, of the version in force, not corrected within that version. */
function believedOn(p: AskProjections, lineageId: string, subjectKey: string, date: string): string | undefined {
  const inForce = Object.entries(p.timeline).filter(([, t]) => t.lineageId === lineageId && t.subjectKey === subjectKey
    && t.validFrom !== undefined && t.validFrom <= date && (t.validTo === undefined || date < t.validTo));
  const believed = inForce.filter(([, t]) => {
    if (!lastOf(t, 'ClaimVerified') || stateOf(t) === 'contested') return false;
    const s = lastOf(t, 'ClaimSuperseded');
    return !(s && p.timeline[s.successor!]?.version === t.version);
  });
  if (believed.length > 1) throw new Error(`ask: two verified claims on ${subjectKey} in force on ${date} (${believed.map(([, t]) => t.label).join(', ')})`);
  return believed[0]?.[0];
}

export function ask(p: AskProjections, q: AskQuery): Answer {
  const subjectKey = q.subjectKey ?? subjectBySynonym(q.question)?.key;
  if (!subjectKey) return { kind: 'refused', subjectKey: '?', reason: 'the question names no subject of the catalogue', pending: [] };
  const cls = lookupSubject(subjectKey)?.cls;

  const claimId = q.asOf
    ? believedOn(p, q.lineageId, subjectKey, q.asOf)
    : p.currentBeliefs[q.lineageId]?.find((b) => b.subjectKey === subjectKey)?.claimId;

  if (!claimId) {
    // Nothing verified: report what exists and why it cannot be asserted.
    const pending = Object.values(p.timeline)
      .filter((t) => t.lineageId === q.lineageId && t.subjectKey === subjectKey && (stateOf(t) === 'proposed' || stateOf(t) === 'contested')
        && (q.asOf ? t.validFrom !== undefined && t.validFrom <= q.asOf && (t.validTo === undefined || q.asOf < t.validTo) : t.validTo === undefined))
      .map((t) => ({ label: t.label, state: stateOf(t) }));
    const reason = pending.length === 0
      ? `no claim on ${subjectKey}`
      : `${subjectKey} has no verified belief, only ${[...new Set(pending.map((x) => x.state))].join(' and ')} claims`;
    return { kind: 'refused', subjectKey, reason, pending };
  }

  const a = answered(p, subjectKey, claimId, q.asOf);
  if (cls && HUMAN_ROOTED_CLASSES.has(cls) && !a.root.actor.startsWith('human(')) {
    return { kind: 'refused', subjectKey, reason: `${subjectKey} is ${cls}; ${a.label} is rooted in ${a.root.actor}, not in a human decision`, pending: [] };
  }
  return a;
}

// ---------------------------------------------------------------- on screen

const ev = (seq: number): string => `ev-${String(seq).padStart(4, '0')}`;

export const SOURCES_LINE = 'sources consulted: projection only (CurrentBeliefs, Timeline); raw documents: not read';

export function formatAsk(q: AskQuery, a: Answer, opts: { showPolicy?: boolean } = {}): string[] {
  const header = `ask  "${q.question}"  as-of=${q.asOf ?? 'now'}` + (opts.showPolicy ? `  policy: ${POLICY_TEXT}` : '');
  if (a.kind === 'refused') {
    return [header, `answer: not answerable — ${a.reason}`, ...a.pending.map((x) => `  pending  ${x.label.padEnd(15)}${x.state}`)];
  }
  const verified = `verified by ${a.verified.actor} at ${ev(a.verified.seq)}` + (a.contested ? ` after ClaimContested ${ev(a.contested.seq)}` : '');
  const root = a.root.label === a.label ? [] : [`root ${a.root.label} verified by ${a.root.actor} at ${ev(a.root.seq)}`];
  const context = q.asOf
    ? [`in force ${a.validFrom ?? '?'} → ${a.validTo ?? ''}`.trimEnd()]
    : a.predecessor ? [`successor of ${a.predecessor}`] : [];
  const lines = [
    header,
    `answer: ${displayValue(a.value)}`,
    `  belief   ${a.label.padEnd(15)}${[verified, ...root, ...context].join('   ')}`,
    `  evidence span ${a.span.documentId}@${a.span.version} [${a.span.start},${a.span.end})  "${a.quote}"`,
  ];
  if (q.asOf && a.supersededLater) lines.push(`  superseded later by ${a.supersededLater.label} (${ev(a.supersededLater.seq)}) — not applicable on ${q.asOf}`);
  return lines;
}
