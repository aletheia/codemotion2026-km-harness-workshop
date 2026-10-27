import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { read, root } from './helpers';

interface Claude { permissions: { allow: string[]; deny: string[] }; hooks?: { PreToolUse?: { matcher?: string; hooks: { type: string; command: string }[] }[] } }
const claude = JSON.parse(read(join(root, '.claude/settings.json'))) as Claude;
const cursor = JSON.parse(read(join(root, '.cursor/cli.json'))) as { version: number; permissions: { allow: string[]; deny: string[] } };

describe('permissions', () => {
  it('claude: segment commands are pre-granted, reset and destructive commands are not', () => {
    expect(claude.permissions.allow).toContain('Bash(npm run seg*)');
    expect(claude.permissions.allow).toContain('Bash(npm run replay*)');
    expect(claude.permissions.allow.join('\n')).not.toMatch(/reset|rm |git push|install/);
  });
  it('claude: Edit on events/ and on generated copies is denied (Edit rules cover all edit tools)', () => {
    expect(claude.permissions.deny).toContain('Edit(/events/**)');
    for (const g of ['.claude/skills', '.claude/agents', '.cursor/skills', '.cursor/agents']) expect(claude.permissions.deny).toContain(`Edit(/${g}/**)`);
  });
  it('claude: every hook entry carries a matcher key (Cursor loads these hooks too)', () => {
    for (const e of claude.hooks?.PreToolUse ?? []) expect(typeof e.matcher).toBe('string');
  });
  it('claude: the hook command points at a script that exists', () => {
    const cmd = claude.hooks!.PreToolUse![0]!.hooks[0]!.command;
    expect(cmd).toContain('tools/hooks/guard-events.ts');
    expect(read(join(root, 'tools/hooks/guard-events.ts'))).toContain('process.exit(2)');
  });
  it('cursor cli: versioned file that denies writes to events/', () => {
    expect(cursor.version).toBe(1);
    expect(cursor.permissions.deny).toContain('Write(events/**)');
  });

  it('the hook script exits 2 on an events/ write and 0 on a normal command (hook stdin format from the Claude docs)', () => {
    const run = (command: string) => spawnSync(join(root, 'node_modules/.bin/tsx'), [join(root, 'tools/hooks/guard-events.ts')], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
    const blocked = run('echo x >> events/events.jsonl');
    expect(blocked.status).toBe(2);
    expect(blocked.stderr.trim().split('\n')).toHaveLength(1);
    expect(run('npm run tail').status).toBe(0);
  });
});
