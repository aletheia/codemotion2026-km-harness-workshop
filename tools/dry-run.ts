// npm run dry-run [-- --write-fallback]
// Rehearsal without a model: runs every step of tools/lib/runsheet.ts against a TEMP events directory,
// checks each exit code, and prints a summary. --write-fallback also (re)writes
// fallback/segN/expected-output.txt (deterministic tool output, not a model session).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { makeTempDir, removeTree, writeTextFile } from '../src/adapters/files';
import { repoPath, repoRoot } from '../src/adapters/paths';
import { Rejection } from '../src/app/errors';
import { emit, parseArgs, run } from './lib/cli';
import { steps } from './lib/runsheet';

export interface Recorded { npm: string; exit: number; stdout: string; stderr: string; note?: string; fallback?: string }

export function execute(): Map<number, Recorded[]> {
  const dir = makeTempDir('dry-run-');
  for (const d of ['events', 'projections', 'state']) writeTextFile(join(dir, d, '.keep'), '');
  const env = { ...process.env, HARNESS_EVENTS_DIR: join(dir, 'events'), HARNESS_PROJECTIONS_DIR: join(dir, 'projections'), HARNESS_STATE_DIR: join(dir, 'state') };
  const out = new Map<number, Recorded[]>();
  try {
    for (const s of steps) {
      let args = s.args;
      if (s.writeFile) {
        const f = join(dir, s.writeFile.name);
        writeTextFile(f, s.writeFile.content);
        args = args.map((a) => (a === '$FILE' ? f : a));
      }
      const r = spawnSync(join(repoRoot, 'node_modules', '.bin', 'tsx'), [join(repoRoot, 'tools', `${s.tool}.ts`), ...args], { cwd: repoRoot, env, encoding: 'utf8' });
      const rec: Recorded = { npm: s.npm, exit: r.status ?? -1, stdout: r.stdout.replaceAll(dir, '<tmp>'), stderr: r.stderr.replaceAll(dir, '<tmp>'), ...(s.note ? { note: s.note } : {}), ...(s.fallback ? { fallback: s.fallback } : {}) };
      (out.get(s.segment) ?? out.set(s.segment, []).get(s.segment)!).push(rec);
      if (rec.exit !== s.expectExit) throw new Rejection(`dry-run: "${s.npm}" exited ${rec.exit}, expected ${s.expectExit}: ${rec.stderr.trim().split('\n').pop() ?? ''}`);
    }
  } finally {
    removeTree(dir);
  }
  return out;
}

const LABEL = [
  '# DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION.',
  '# It is what the npm command prints when replayed from fixtures/llm in a clean checkout.',
  '# Regenerate: npm run dry-run -- --write-fallback   (a test fails if this file is out of date)',
];

/** One run-sheet-named fallback file: the stdout of a single step. .jsonl files stay raw (one event per line). */
export function renderNamed(rec: Recorded): string {
  if (rec.fallback?.endsWith('.jsonl')) return rec.stdout;
  return [...LABEL, `$ ${rec.npm}`, '', rec.stdout.trimEnd(), ''].join('\n');
}

export function renderFallback(segment: number, recs: Recorded[]): string {
  const head = [
    `# fallback/seg${segment}/expected-output.txt`,
    '# DETERMINISTIC TOOL OUTPUT, NOT A MODEL SESSION.',
    '# It is what the npm commands print when replayed from fixtures/llm in a clean checkout.',
    '# Regenerate: npm run dry-run -- --write-fallback   (a test fails if this file is out of date)',
    '',
  ];
  const body = recs.flatMap((r) => [
    `$ ${r.npm}${r.note ? `    # ${r.note}` : ''}`,
    ...(r.stdout.trim() ? [r.stdout.trimEnd()] : []),
    ...(r.stderr.trim() ? [`[stderr]`, r.stderr.trimEnd()] : []),
    `[exit ${r.exit}]`,
    '',
  ]);
  return [...head, ...body].join('\n');
}

if (process.argv[1]?.endsWith('dry-run.ts')) {
  const args = parseArgs(process.argv.slice(2), ['text', 'write-fallback']);
  void run(() => {
    const all = execute();
    const written: string[] = [];
    if (args.flags['write-fallback']) {
      for (const [seg, recs] of all) {
        const rel = `fallback/seg${seg}/expected-output.txt`;
        writeTextFile(repoPath(rel), renderFallback(seg, recs));
        written.push(rel);
        for (const r of recs) {
          if (!r.fallback) continue;
          const named = `fallback/seg${seg}/${r.fallback}`;
          writeTextFile(repoPath(named), renderNamed(r));
          written.push(named);
        }
      }
    }
    const summary = [...all].map(([seg, recs]) => ({ segment: seg, steps: recs.length, exits: recs.map((r) => r.exit) }));
    emit('dry-run', { segments: summary, fallbackWritten: written }, summary.map((s) => `seg${s.segment}: ${s.steps} steps, exits ${s.exits.join(',')}`).join('\n'), args);
  });
}
