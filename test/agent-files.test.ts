import { cpSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffs, expectedFiles, syncAll } from '../tools/lib/agentFiles';
import { read, root } from './helpers';

describe('skills and subagents: one source, generated copies', () => {
  it('every generated copy equals its source (fails if someone edited a copy or forgot `npm run sync`)', () => {
    expect(diffs(root)).toEqual([]);
  });

  it('exposes every source file under .claude/ and .cursor/', () => {
    const files = [...expectedFiles(root).keys()].map((f) => f.replace(/\\/g, '/'));
    expect(files).toContain('.claude/skills/extract-claims/SKILL.md');
    expect(files).toContain('.cursor/skills/extract-claims/SKILL.md');
    expect(files).toContain('.claude/agents/claims-extractor.md');
    expect(files).toContain('.cursor/agents/claims-extractor.md');
  });

  it('detects an edited copy, a missing copy and a stale file; sync repairs all three', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'agentfiles-'));
    try {
      cpSync(join(root, 'agent'), join(tmp, 'agent'), { recursive: true });
      cpSync(join(root, '.claude'), join(tmp, '.claude'), { recursive: true });
      cpSync(join(root, '.cursor'), join(tmp, '.cursor'), { recursive: true });
      expect(diffs(tmp)).toEqual([]);
      writeFileSync(join(tmp, '.claude/skills/extract-claims/SKILL.md'), `${read(join(root, '.claude/skills/extract-claims/SKILL.md'))}\nedited`);
      rmSync(join(tmp, '.cursor/agents/log-auditor.md'));
      mkdirSync(join(tmp, '.cursor/skills/inspect-log'), { recursive: true });
      writeFileSync(join(tmp, '.cursor/skills/inspect-log/old.md'), 'stale');
      const problems = diffs(tmp).map((d) => d.problem).sort();
      expect(problems).toEqual(['differs', 'missing', 'stale']);
      syncAll(tmp);
      expect(diffs(tmp)).toEqual([]);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  it('skills have name + description front matter and the name matches the folder', () => {
    for (const f of [...expectedFiles(root).keys()].filter((k) => k.startsWith('.claude/skills/') && k.endsWith('SKILL.md'))) {
      const text = read(join(root, f));
      const dirName = f.split('/')[2];
      expect(text).toMatch(new RegExp(`^---\\nname: ${dirName}\\ndescription: .+\\n(?:[a-z-]+: .*\\n)*---\\n`));
    }
  });

  it('CLAUDE.md only points to AGENTS.md; the glossary exists exactly once', () => {
    expect(read(join(root, 'CLAUDE.md')).trim()).toBe('@AGENTS.md');
    const agents = read(join(root, 'AGENTS.md'));
    expect(agents.match(/^## Glossary/gm)).toHaveLength(1);
    for (const f of [...expectedFiles(root).keys()]) expect(read(join(root, f))).not.toMatch(/^## Glossary/m);
  });
});
