import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listTs, read, root } from './helpers';
import { checkMayEmit } from '../src/domain/policy';
import { DECISION_TYPES } from '../src/events/types';

describe('agents propose, they do not decide', () => {
  it('the policy rejects every decision event from an agent actor', () => {
    for (const t of DECISION_TYPES) expect(checkMayEmit(t, 'agent', 'human'), t).toMatch(/may not emit/);
  });
  it('the replay "agent" module never builds events and never names a decision type', () => {
    for (const f of listTs(join(root, 'src/agents'))) {
      const text = read(f);
      expect(text).not.toMatch(/buildEvent|events\/build|ClaimVerified|ClaimContested|ClaimSuperseded|StructureVerified|ExtractorVersionPromoted/);
    }
  });
  it('the agent-facing write path (propose) builds ClaimProposed only', () => {
    const text = read(join(root, 'src/app/propose.ts'));
    expect(text).not.toMatch(/ClaimVerified|ClaimContested|ClaimSuperseded|StructureVerified/);
  });
  it('agent-facing instructions never tell the agent to run a state-changing command', () => {
    for (const f of ['agent/skills/extract-claims/SKILL.md', 'agent/agents/claims-extractor.md']) {
      expect(read(join(root, f))).not.toMatch(/npm run (seg\d|reset)/);
    }
  });
});
