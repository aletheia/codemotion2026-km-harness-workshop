import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildFixtures } from '../src/fixtures-gen/build';
import { read, root } from './helpers';

describe('fixtures', () => {
  it('committed fixtures equal the generator output (run `npm run fixtures` after changing the generator)', () => {
    for (const [rel, content] of Object.entries(buildFixtures())) expect(read(join(root, rel)), rel).toBe(content);
  });
  it('generator is deterministic', () => {
    expect(buildFixtures()).toEqual(buildFixtures());
  });
  it('recordings declare that no model sits behind them', () => {
    for (const f of ['structure@v1', 'claims@v1']) expect((JSON.parse(read(join(root, `fixtures/llm/${f}.json`))) as { modelId: string }).modelId).toBe('fixture-replay');
  });
});
