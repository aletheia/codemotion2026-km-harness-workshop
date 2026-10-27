import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listTs, read, root } from './helpers';

// "Append-only" is enforced by code structure: one function appends, nothing else writes files in events/.
const WRITE_API = /\b(appendFile|appendFileSync|writeFile|writeFileSync|createWriteStream|truncate|truncateSync|ftruncate|ftruncateSync|rename|renameSync|copyFile|copyFileSync|unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|open|openSync|write|writeSync|cp|cpSync|symlink|symlinkSync|utimes|chmod)\s*\(/;

describe('event log is append-only by construction', () => {
  const files = [...listTs(join(root, 'src')), ...listTs(join(root, 'tools'))].map((f) => relative(root, f).replace(/\\/g, '/'));

  it('eventLog.ts exports exactly readAll, append, resetLog and has one appendFileSync call', () => {
    const src = read(join(root, 'src/adapters/eventLog.ts'));
    const exported = [...src.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
    expect(exported.sort()).toEqual(['append', 'readAll', 'resetLog']);
    expect(src.match(/appendFileSync\(/g)).toHaveLength(1);
    expect(src).not.toMatch(/writeFileSync|createWriteStream|truncate|renameSync/);
  });

  it('no file outside src/adapters/{eventLog,files}.ts calls a filesystem write API', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f === 'src/adapters/eventLog.ts' || f === 'src/adapters/files.ts') continue;
      if (f === 'tools/lib/agentFiles.ts') continue; // writes the agent copies; the next test checks it never names the events dir
      const text = read(join(root, f));
      if (/from ['"]node:fs(\/promises)?['"]/.test(text) && WRITE_API.test(text.replace(/\/\/.*$/gm, ''))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('the exception (agent-file sync) and the scratch-dir tools never reference the real events location', () => {
    for (const f of ['tools/lib/agentFiles.ts', 'tools/verify-tags.ts', 'tools/dry-run.ts']) {
      expect(read(join(root, f)), f).not.toMatch(/eventsDir|eventsFile|events\.jsonl|repoPath\(['"]events/);
    }
  });

  it('only eventLog.ts, files.ts (guard) and paths.ts mention the events location', () => {
    const mention = files.filter((f) => /eventsDir|eventsFile|events\.jsonl/.test(read(join(root, f))));
    expect(mention.sort()).toEqual(['src/adapters/eventLog.ts', 'src/adapters/files.ts', 'src/adapters/paths.ts']);
  });

  describe('behaviour', () => {
    let dir: string;
    const saved = process.env.HARNESS_EVENTS_DIR;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'append-')); process.env.HARNESS_EVENTS_DIR = dir; });
    afterEach(() => { if (saved === undefined) delete process.env.HARNESS_EVENTS_DIR; else process.env.HARNESS_EVENTS_DIR = saved; });

    it('append is idempotent on eventId and assigns increasing seq', async () => {
      const { append, readAll } = await import('../src/adapters/eventLog');
      const { buildEvent } = await import('../src/events/build');
      const d1 = buildEvent({ type: 'LogInitialised', aggregateId: 'log', actor: { kind: 'process', id: 't' }, inputArtifactId: 'log', causationId: null, correlationId: 'c', payload: { logId: 'x', format: 'events-jsonl-v1' } });
      const a = append(d1);
      const b = append(d1);
      expect(a).toMatchObject({ seq: 1, deduplicated: false });
      expect(b).toMatchObject({ seq: 1, deduplicated: true });
      expect(readAll()).toHaveLength(1);
    });

    it('writeTextFile refuses to write inside the events directory', async () => {
      const { writeTextFile, removeFile } = await import('../src/adapters/files');
      expect(() => writeTextFile(join(dir, 'events.jsonl'), 'x')).toThrow(/event log/);
      expect(() => removeFile(join(dir, 'events.jsonl'))).toThrow(/event log/);
      writeFileSync(join(tmpdir(), 'harness-ok.txt'), 'ok');
      expect(() => writeTextFile(join(tmpdir(), 'harness-ok.txt'), 'ok')).not.toThrow();
    });
  });
});
