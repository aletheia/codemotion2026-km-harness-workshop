import { describe, expect, it } from 'vitest';
import { deriveEventId } from '../src/events/eventId';
import {
  ClaimProposed, ClaimVerified, DECISION_TYPES, eventSchema, ExtractorVersionPromoted, FACT_TYPES, LogInitialised,
} from '../src/events/schema';
import { actors, classA, contested, humanNote, proposed, superseded, verified } from './helpers';

const idInput = { producer: 'agent:claims-extractor', inputArtifactId: 'abcdef0123456789', extractorVersion: 'claims@v1', eventType: 'ClaimProposed', aggregateId: 'x' };

describe('eventId', () => {
  it('is deterministic: SHA-256 truncated to 16 hex chars', () => {
    const a = deriveEventId(idInput);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(deriveEventId({ ...idInput })).toBe(a);
  });

  it('changes when any of the five inputs changes', () => {
    const base = deriveEventId(idInput);
    for (const [k, v] of Object.entries({ producer: 'human:luca', inputArtifactId: '0123456789abcdef', extractorVersion: 'claims@v2', eventType: 'ClaimVerified', aggregateId: 'y' })) {
      expect(deriveEventId({ ...idInput, [k]: v })).not.toBe(base);
    }
    expect(deriveEventId({ ...idInput, extractorVersion: null })).not.toBe(base);
  });

  it('keeps field boundaries: shifting text across fields gives another id', () => {
    expect(deriveEventId({ ...idInput, producer: 'a', inputArtifactId: 'bc' })).not.toBe(deriveEventId({ ...idInput, producer: 'ab', inputArtifactId: 'c' }));
  });
});

describe('catalogue: fact and decision families', () => {
  it('covers every event type of 04 §4, each in exactly one family', () => {
    const facts = ['LogInitialised', 'DocumentVersionIngested', 'StructureProposed', 'ClaimProposed', 'EntityProposed',
      'PolicyProposed', 'WorkflowStepProposed', 'ACLRejected', 'CursorAdvanced'];
    const decisions = ['StructureVerified', 'ClaimVerified', 'ClaimContested', 'ClaimSuperseded', 'EntityResolved', 'EntityMerged',
      'PolicyVerified', 'PolicyContested', 'PolicySuperseded', 'WorkflowStepVerified', 'WorkflowStepSuperseded',
      'EvalCompleted', 'ExtractorVersionPromoted', 'BatchRejected'];
    expect([...FACT_TYPES].sort()).toEqual([...facts].sort());
    expect([...DECISION_TYPES].sort()).toEqual([...decisions].sort());
  });

  it('accepts well-formed facts and decisions', () => {
    for (const e of [proposed(actors.agent), verified(actors.human, humanNote), verified(actors.harness, classA), contested(actors.harness), superseded(actors.human, 'human-resolution')]) {
      expect(eventSchema.safeParse(e).success, e.type).toBe(true);
    }
  });

  it('rejects a decision event without evidence', () => {
    const { evidence: _drop, ...bare } = verified(actors.human, humanNote);
    expect(ClaimVerified.safeParse(bare).success).toBe(false);
    expect(eventSchema.safeParse(bare).success).toBe(false);

    const promoted = {
      eventId: '0123456789abcdef', seq: 2, aggregateVersion: 1, type: 'ExtractorVersionPromoted', layer: 'harness',
      aggregateId: 'claims@v1', actor: actors.human, correlationId: 'log-init', occurredAt: '2026-10-28T13:37:02Z',
      payload: { extractor: 'claims', version: 'claims@v1', previous: null },
    };
    expect(ExtractorVersionPromoted.safeParse(promoted).success).toBe(false);
    expect(ExtractorVersionPromoted.safeParse({ ...promoted, evidence: { kind: 'bootstrap', note: 'initial version' } }).success).toBe(true);
  });

  it('rejects a fact event with evidence', () => {
    const withEvidence = { ...proposed(actors.agent), evidence: humanNote };
    expect(ClaimProposed.safeParse(withEvidence).success).toBe(false);
    expect(eventSchema.safeParse(withEvidence).success).toBe(false);

    const init = {
      eventId: '0123456789abcdef', seq: 1, aggregateVersion: 1, type: 'LogInitialised', layer: 'source', aggregateId: 'log',
      actor: { kind: 'process', id: 'log-init' }, correlationId: 'log-init', occurredAt: '2026-10-28T13:37:01Z',
      payload: { logId: 'dnk-workshop', format: 'events-jsonl-v1', createdAt: '2026-10-28T13:37:01Z' },
    };
    expect(LogInitialised.safeParse(init).success).toBe(true);
    expect(LogInitialised.safeParse({ ...init, evidence: { kind: 'bootstrap', note: 'x' } }).success).toBe(false);
  });

  it('admits only the catalogue producers: an agent cannot emit ClaimVerified', () => {
    expect(eventSchema.safeParse(verified(actors.agent, humanNote)).success).toBe(false);
    expect(eventSchema.safeParse(contested(actors.human)).success).toBe(false);
    expect(eventSchema.safeParse(proposed(actors.harness)).success).toBe(false);
  });

  it('an agent actor must carry modelId, promptVersion and extractorVersion', () => {
    const { modelId: _m, ...partial } = actors.agent;
    expect(eventSchema.safeParse({ ...proposed(actors.agent), actor: partial }).success).toBe(false);
  });

  it('a ClaimProposed needs at least one well-formed half-open Span', () => {
    expect(eventSchema.safeParse(proposed(actors.agent, [])).success).toBe(false);
    const empty = { ...proposed(actors.agent).payload.spans[0], end: 1067 };
    expect(eventSchema.safeParse(proposed(actors.agent, [empty])).success).toBe(false);
  });
});
