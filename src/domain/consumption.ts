// Consumption policy: which verified beliefs an agent may rely on. Pure.
// Applied to the ROOT of the evidence chain, not to the last actor: a class-A reconfirmation by the harness
// carries the human verification it reconfirms, so "human-rooted" is satisfied by a chain that ends in a human.
import type { ClaimState } from './claim';

export type SubjectClassName = 'monetary' | 'exclusion' | 'time-limit' | 'other';
export type RootKind = 'human' | 'import' | 'harness-only';
export type VerifierKind = 'human' | 'agent' | 'harness' | 'import' | 'process';

export interface ConsumeInput {
  subjectClass: SubjectClassName;
  /** The state the claim had on the date asked about (a claim superseded by a later edition counts as verified then). */
  state: ClaimState;
  root: RootKind;
  /** Kind of the actor that made the claim verified (the last link of the chain). */
  verifier: VerifierKind | null;
}
export type Consumption = { usable: true; rule: string } | { usable: false; reason: string };

/** The rule, as one line, for a subject class. */
export const ruleFor = (c: SubjectClassName): string =>
  c === 'monetary' || c === 'exclusion' || c === 'time-limit' ? 'human-rooted verified only' : 'human- or harness-verified';

export function consume(i: ConsumeInput): Consumption {
  if (i.state === 'proposed') return { usable: false, reason: 'proposed: nobody has decided it yet, it waits in the review queue' };
  if (i.state === 'contested') return { usable: false, reason: 'contested: a human has to resolve the conflict first' };
  const rule = ruleFor(i.subjectClass);
  if (i.subjectClass !== 'other') {
    return i.root === 'human' ? { usable: true, rule } : { usable: false, reason: `the policy needs a human root of the evidence chain; the root here is ${i.root}` };
  }
  return i.verifier === 'human' || i.verifier === 'harness' ? { usable: true, rule } : { usable: false, reason: `verified by ${i.verifier ?? 'nobody'}, which the policy does not accept` };
}
