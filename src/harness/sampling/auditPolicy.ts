// Audit sampling of class-A reconfirmations (04-domain-model-reference.md §5): a share of the harness's
// own verifications goes back to a human. The rate depends on the root of the reconfirmed belief and on
// cold start; the pick is deterministic by claim id, so two runs sample the same claims.
import { config } from '../../config';
import { sha256_16 } from '../../domain/hash';
import type { RootKind } from '../beliefs/currentBeliefs';

/** 100 % in cold start; otherwise 5 % for human-rooted beliefs, 20 % for import-rooted ones (less trusted). */
export function auditRate(root: RootKind, coldStart: boolean, rates = config.sampling): number {
  if (coldStart) return rates.coldStart;
  return root === 'import' ? rates.importRooted : rates.humanRooted;
}

/** Position of a claim id in [0, 1): the first 8 hex chars of SHA-256 over the id, scaled. */
export const samplePoint = (claimId: string): number => parseInt(sha256_16(claimId).slice(0, 8), 16) / 0x1_0000_0000;

/** rate ≥ 1 short-circuits, so cold start samples every claim regardless of where its point falls. */
export const isSampled = (claimId: string, rate: number): boolean => rate >= 1 || samplePoint(claimId) < rate;
