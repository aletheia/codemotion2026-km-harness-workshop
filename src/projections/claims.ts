// One record per claim, folded from the log: the shared input of every Claims-layer projection.
// The first ClaimProposed defines the claim (label, spans, section); later proposals of the same claim id
// by other extractors are agreement and only add to `proposers`. State comes from transition() via
// claimStates, so a projection can never disagree with the lifecycle table.
import type { NormalizedValue, SubjectKey } from '../domain/claim';
import type { Span } from '../domain/span';
import { claimStates } from '../events/fold';
import { ofType } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import type { ClaimState } from '../domain/claim';

/** A decision on the claim, as the projections show it: which event, who. */
export interface DecisionRef {
  readonly eventId: string;
  readonly seq: number;
  readonly actor: string;                    // 'human(luca)', 'harness(compare)'
}

export interface ClaimRecord {
  readonly claimId: string;
  readonly label: string;
  readonly lineageId: string;
  readonly documentId: string;
  readonly version: string;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly spans: readonly Span[];
  readonly sectionPath: string;
  readonly state: ClaimState;
  /** Who proposed it, in log order: the extractor version for agents ('claims@v1'), 'human' otherwise. */
  readonly proposers: readonly string[];
  readonly verified?: DecisionRef;
  readonly contested?: DecisionRef & { readonly conflictingClaimId: string };
  readonly superseded?: DecisionRef & { readonly successor: string; readonly reason: string };
}

const actorOf = (e: LogEvent): string => `${e.actor.kind}(${e.actor.id})`;
const ref = (e: LogEvent): DecisionRef => ({ eventId: e.eventId, seq: e.seq, actor: actorOf(e) });

/** Claim records in the order the claims first appear in the log. */
export function claimRecords(events: readonly LogEvent[]): ClaimRecord[] {
  const states = claimStates(events);
  const records = new Map<string, ClaimRecord>();
  const update = (id: string, patch: Partial<ClaimRecord>) => records.set(id, { ...records.get(id)!, ...patch });

  for (const e of events) {
    switch (e.type) {
      case 'ClaimProposed': {
        const proposer = e.actor.kind === 'agent' ? e.actor.extractorVersion : e.actor.kind;
        const existing = records.get(e.payload.claimId);
        if (existing) {
          update(e.payload.claimId, { proposers: [...existing.proposers, proposer] });
          break;
        }
        const span = e.payload.spans[0]!;
        records.set(e.payload.claimId, {
          claimId: e.payload.claimId,
          label: e.payload.label ?? `clm-${e.payload.claimId.slice(0, 8)}`,
          lineageId: e.payload.lineageId,
          documentId: span.documentId,
          version: span.version,
          subjectKey: e.payload.subjectKey as SubjectKey,
          value: e.payload.normalizedValue as NormalizedValue,
          spans: e.payload.spans as Span[],
          sectionPath: e.payload.sectionPath,
          state: 'proposed',
          proposers: [proposer],
        });
        break;
      }
      case 'ClaimVerified': update(e.payload.claimId, { verified: ref(e) }); break;
      case 'ClaimContested': update(e.payload.claimId, { contested: { ...ref(e), conflictingClaimId: e.payload.conflictingClaimId } }); break;
      case 'ClaimSuperseded': update(e.payload.claimId, { superseded: { ...ref(e), successor: e.payload.successor, reason: e.evidence.reason } }); break;
    }
  }
  return [...records.values()].map((r) => ({ ...r, state: states.get(r.claimId as never)! }));
}

/** Validity of each document version of a lineage: [effectiveFrom, next version's effectiveFrom). */
export interface VersionValidity {
  readonly documentId: string;
  readonly version: string;
  readonly from: string;
  readonly to?: string;                      // exclusive; absent for the version in force today
}

export function versionValidity(events: readonly LogEvent[], lineageId: string): VersionValidity[] {
  const versions = ofType(events, 'DocumentVersionIngested')
    .filter((e) => e.payload.lineageId === lineageId)
    .map((e) => ({ documentId: e.payload.documentId, version: e.payload.version, from: e.payload.effectiveFrom }))
    .sort((a, b) => a.from.localeCompare(b.from));
  return versions.map((v, i) => (versions[i + 1] ? { ...v, to: versions[i + 1]!.from } : v));
}
