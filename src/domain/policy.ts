// Who may emit what. Agents emit only *Proposed events; "verified" comes from a human,
// or from the harness in class A only. Pure.
export type EvActorKind = 'human' | 'agent' | 'harness' | 'import' | 'process';

const FACT_BY: Record<string, readonly EvActorKind[]> = {
  LogInitialised: ['process'],
  DocumentVersionIngested: ['process'],
  ACLRejected: ['process'],
  CursorAdvanced: ['process'],
  StructureProposed: ['agent'],
  ClaimProposed: ['agent', 'human'],
};

const DECISION_BY: Record<string, readonly EvActorKind[]> = {
  StructureVerified: ['human', 'harness'],
  ClaimVerified: ['human', 'harness'],
  ClaimContested: ['human', 'harness'],
  ClaimSuperseded: ['human', 'harness'],
  ExtractorVersionPromoted: ['human'],
};

const EVIDENCE_BY_HARNESS: Record<string, readonly string[]> = {
  StructureVerified: ['class-A'],
  ClaimVerified: ['class-A'],
  ClaimContested: ['class-C'],
  ClaimSuperseded: ['supersession'],
};
const EVIDENCE_BY_HUMAN: Record<string, readonly string[]> = {
  StructureVerified: ['human'],
  ClaimVerified: ['human'],
  ClaimContested: ['human'],
  ClaimSuperseded: ['supersession'],
  ExtractorVersionPromoted: ['human'],
};

/** Returns null when allowed, otherwise a one-line reason. */
export function checkMayEmit(type: string, actorKind: EvActorKind, evidenceKind: string | undefined): string | null {
  const allowed = FACT_BY[type] ?? DECISION_BY[type];
  if (!allowed) return `unknown event type ${type}`;
  if (!allowed.includes(actorKind)) {
    return `actor kind "${actorKind}" may not emit ${type} (allowed: ${allowed.join(', ')})`;
  }
  if (type in DECISION_BY) {
    const okKinds = (actorKind === 'harness' ? EVIDENCE_BY_HARNESS : EVIDENCE_BY_HUMAN)[type] ?? [];
    if (evidenceKind === undefined || !okKinds.includes(evidenceKind)) {
      return `${actorKind} ${type} needs evidence kind ${okKinds.join(' | ')} (got ${evidenceKind ?? 'none'})`;
    }
  }
  return null;
}
