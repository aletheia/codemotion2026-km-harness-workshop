// Projection per extractor version (04 §6): the candidate extractor's proposals folded as if verified,
// next to the promoted projection, per document version. Per version and not on CurrentBeliefs, because
// by segment 4 the v8 claims are superseded: a diff of the current state would hide the v2 regression on
// ricavi.limite (2,000 EUR against 2,000,000 EUR on the March text). The candidate is never a belief.
import type { NormalizedValue } from '../domain/claim';
import { ofType, promotedVersion } from '../events/lookup';
import type { LogEvent } from '../events/schema';
import { claimRecords, versionValidity, type ClaimRecord } from './claims';

export type DiffStatus = 'same' | 'DIFFERS' | 'candidate only' | 'promoted only';

export interface DiffRow {
  readonly version: string;
  readonly subjectKey: string;
  /** The verified claim of the version (superseded or not); absent when there is none. */
  readonly promoted?: { readonly value: NormalizedValue; readonly superseded: boolean };
  /** No verified claim, but the promoted extractor proposed one (still in the ReviewQueue). */
  readonly promotedProposed: boolean;
  readonly candidate?: { readonly value: NormalizedValue; readonly sectionPath: string };
  readonly status: DiffStatus;
  /** Set when the candidate claims the subject in a unit where the promoted claims never put it. */
  readonly notInUnit?: string;
}

export function extractorDiff(events: readonly LogEvent[], lineageId: string, candidateVersion: string): { promoted: string; rows: DiffRow[] } {
  const promoted = promotedVersion(events, 'claims') ?? '—';
  const records = claimRecords(events);
  const byId = new Map(records.map((r) => [r.claimId, r] as const));
  const trusted = (r: ClaimRecord) => r.proposers.some((p) => p === promoted || p === 'human');
  const candidateProposals = ofType(events, 'ClaimProposed').filter((e) => e.actor.kind === 'agent' && e.actor.extractorVersion === candidateVersion);

  const rows: DiffRow[] = [];
  for (const v of versionValidity(events, lineageId)) {
    const inVersion = records.filter((r) => r.lineageId === lineageId && r.documentId === v.documentId && r.version === v.version);
    // The promoted side: per subject, the verified claim not replaced within the same version.
    const verified = new Map(inVersion
      .filter((r) => r.verified && !(r.superseded && byId.get(r.superseded.successor)?.version === r.version))
      .map((r) => [r.subjectKey as string, r] as const));
    const proposedOnly = new Set(inVersion.filter((r) => r.state === 'proposed' && r.proposers.includes(promoted)).map((r) => r.subjectKey as string));

    // The candidate side, in the order the candidate proposed (first proposal per subject).
    const candidate = new Map<string, { value: NormalizedValue; sectionPath: string; claimId: string }>();
    for (const e of candidateProposals) {
      const span = e.payload.spans[0]!;
      if (span.documentId !== v.documentId || span.version !== v.version || candidate.has(e.payload.subjectKey)) continue;
      candidate.set(e.payload.subjectKey, { value: e.payload.normalizedValue as NormalizedValue, sectionPath: e.payload.sectionPath, claimId: e.payload.claimId });
    }

    const keys = [...candidate.keys(), ...[...verified.keys()].filter((k) => !candidate.has(k))];
    for (const subjectKey of keys) {
      const p = verified.get(subjectKey);
      const c = candidate.get(subjectKey);
      const status: DiffStatus = p && c ? (p.claimId === c.claimId ? 'same' : 'DIFFERS') : c ? 'candidate only' : 'promoted only';
      // Where do the trusted claims of this subject live? If never in the candidate's unit, say so.
      const elsewhere = c && records.filter((r) => r.subjectKey === subjectKey && r.claimId !== c.claimId && trusted(r)).map((r) => r.sectionPath);
      rows.push({
        version: v.version,
        subjectKey,
        ...(p ? { promoted: { value: p.value, superseded: p.state === 'superseded' } } : {}),
        promotedProposed: !p && proposedOnly.has(subjectKey),
        ...(c ? { candidate: { value: c.value, sectionPath: c.sectionPath } } : {}),
        status,
        ...(c && elsewhere && elsewhere.length > 0 && !elsewhere.includes(c.sectionPath) ? { notInUnit: c.sectionPath } : {}),
      });
    }
  }
  return { promoted, rows };
}
