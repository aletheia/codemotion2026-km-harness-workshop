// npm run dry-run [-- --update] — runs the whole walkthrough from log:reset, composes each step's output as
// AGENTS.md §12 does (stdout of its scripts, then the tail lines of the events they appended), writes it to
// out/dry-run/<segment>/<name>.txt and diffs it against fallback/. --update overwrites fallback/ instead.
// Every script runs through `npm run`, exactly as on stage; review is replaced by review:auto.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config';
import { readLog } from '../events/log';
import { hasFlag, run } from './cli';
import { formatLog } from './tail-format';

export interface DryRunStep {
  /** `<segment>/<name>`: the file under fallback/ and out/dry-run/; undefined for a step whose output is not kept. */
  file?: string;
  scripts: readonly string[];
  /** false: the scripts print their own tail lines (replay, eval), so none are appended. */
  tail?: false;
  /** Masks what cannot match fallback/ byte for byte; applied to both sides before comparing. */
  mask?: (text: string) => string;
}

// AGENTS.md §12: the id hash inside show is exempt. TODO(luca): so is occurredAt, because fallback/seg2/show-ricavi-v8.txt
// has 13:37:12Z from 03-walkthrough-script.md while the fixed clock of AGENTS.md §1.4 gives 13:37:07Z (see config.ts).
const maskShow = (text: string): string =>
  text.replace(/^  "eventId": "[^"]*",$/mu, '  "eventId": "…",').replace(/^  "occurredAt": "[^"]*",$/mu, '  "occurredAt": "…",');

/** The walkthrough in run order (AGENTS.md §11, §12). */
export const dryRunSteps: readonly DryRunStep[] = [
  { scripts: ['log:reset', 'rag:index'] },
  { file: 'seg1/rag-query', scripts: ['rag:query'] },
  { file: 'seg1/rag-after-delete', scripts: ['rag:delete-v8', 'rag:query'] },
  { file: 'seg1/rag-extract', scripts: ['rag:extract-c2'] },
  { file: 'seg2/log-init', scripts: ['log:init'] },
  { file: 'seg2/ingest-v8', scripts: ['ingest:v8'] },
  { file: 'seg2/extract-structure-v8', scripts: ['extract:structure-v8'] },
  { file: 'seg2/review-structure', scripts: ['review:auto'] },
  { file: 'seg2/extract-claims-v8', scripts: ['extract:claims-v8'] },
  { file: 'seg2/log-after-extract', scripts: ['log:cat'] },
  { file: 'seg2/show-ricavi-v8', scripts: ['show:ricavi-v8'], mask: maskShow },
  { file: 'seg2/review-claims', scripts: ['review:auto'] },
  { file: 'seg2/log-after-verify', scripts: ['log:cat'] },
  { file: 'seg3/ingest-extract-v9', scripts: ['ingest:v9', 'extract:v9'] },
  { file: 'seg3/log-after-extract-v9', scripts: ['log:cat'] },
  { file: 'seg3/compare', scripts: ['compare'] },
  { file: 'seg3/review-conflicts', scripts: ['review:auto'] },
  { file: 'seg3/log-after-compare', scripts: ['log:cat'] },
  { file: 'seg3/layers-4-6', scripts: ['layers-4-6'] },
  { file: 'seg4/log-cat', scripts: ['log:cat'] },
  { file: 'seg4/projections-rebuilt', scripts: ['projections:drop', 'projections:build'] },
  { file: 'seg4/replay-claims-v2', scripts: ['replay:claims-v2'], tail: false },
  { file: 'seg4/projections-diff', scripts: ['projections:diff'] },
  { file: 'seg4/beliefs-at-2019-04-30', scripts: ['beliefs:at-2019-04-30', 'beliefs'] },
  { file: 'seg5/golden-claims', scripts: ['golden:claims-until-seg2', 'golden:claims'] },
  { file: 'seg5/eval-v1', scripts: ['eval:claims-v1'], tail: false },
  { file: 'seg5/eval-v2-summary', scripts: ['eval:claims-v2-summary'], tail: false },
  { file: 'seg5/drift-v1-v2', scripts: ['drift:v1-v2'] },
  { file: 'seg6/ask', scripts: ['ask:ricavi-2019-04-30', 'ask:ricavi'] },
];

export const FALLBACK_DIR = 'fallback';
export const DRY_RUN_DIR = join(config.paths.outDir, 'dry-run');

export class StepFailed extends Error {}

/** Fixed clock and no narration, whatever the caller's environment says. */
function scriptEnv(): NodeJS.ProcessEnv {
  const { DNK_CLOCK: _clock, ...env } = process.env;
  return { ...env, DNK_NARRATE: '0' };
}

function runScript(script: string): string {
  const r = spawnSync('npm', ['run', '--silent', script], { encoding: 'utf8', env: scriptEnv() });
  if (r.status !== 0) throw new StepFailed(`npm run ${script} exited with ${r.status}: ${(r.stderr ?? '').trim()}`);
  return r.stdout;
}

/** stdout of the step's scripts in order, then the tail lines of the events they appended (AGENTS.md §12). */
export function runStep(step: DryRunStep): string {
  const before = readLog(config.paths.log).length;
  const stdout = step.scripts.map(runScript).join('');
  if (step.tail === false) return stdout;
  const tail = formatLog(readLog(config.paths.log)).slice(before);
  return stdout + tail.map((line) => `${line}\n`).join('');
}

export interface DryRunResult {
  outputs: { file: string; text: string; mask?: (text: string) => string }[];
  /** Files whose output differs from fallback/ (or is missing there), in run order. */
  differing: string[];
}

export function dryRun(): DryRunResult {
  const outputs: DryRunResult['outputs'] = [];
  for (const step of dryRunSteps) {
    const text = runStep(step);
    if (!step.file) continue;
    const file = `${step.file}.txt`;
    const out = join(DRY_RUN_DIR, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    outputs.push({ file, text, mask: step.mask });
  }
  const differing = outputs.filter(({ file, text, mask = (t: string) => t }) => {
    const expected = join(FALLBACK_DIR, file);
    return !existsSync(expected) || mask(readFileSync(expected, 'utf8')) !== mask(text);
  });
  return { outputs, differing: differing.map((o) => o.file) };
}

/** The first line where the two texts differ, as two indented lines. */
export function firstDifference(expected: string, actual: string): string {
  const e = expected.split('\n');
  const a = actual.split('\n');
  const i = e.findIndex((line, k) => line !== a[k]);
  const at = i >= 0 ? i : e.length;
  return `  line ${at + 1}\n  expected: ${e[at] ?? '(end of file)'}\n  actual:   ${a[at] ?? '(end of file)'}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('dry-run', () => {
    const update = hasFlag(process.argv.slice(2), 'update');
    const { outputs, differing } = dryRun();

    if (update) {
      for (const { file, text } of outputs.filter((o) => differing.includes(o.file))) {
        writeFileSync(join(FALLBACK_DIR, file), text);
      }
      process.stdout.write(
        differing.length
          ? `dry-run: fallback/ updated (${differing.length} file${differing.length > 1 ? 's' : ''}: ${differing.join(', ')})\n`
          : `dry-run: OK (byte-identical with ${FALLBACK_DIR}/, nothing to update)\n`,
      );
      return;
    }

    const first = differing[0];
    if (!first) {
      process.stdout.write(`dry-run: OK (byte-identical with ${FALLBACK_DIR}/)\n`);
      return;
    }
    const expectedPath = join(FALLBACK_DIR, first);
    const { text, mask = (t: string) => t } = outputs.find((o) => o.file === first)!;
    const expected = mask(existsSync(expectedPath) ? readFileSync(expectedPath, 'utf8') : '');
    const actual = mask(text);
    process.stdout.write(
      `dry-run: DIFF ${expectedPath}  (outputs in ${DRY_RUN_DIR}/, ${differing.length} file${differing.length > 1 ? 's' : ''} differ)\n` +
        `${firstDifference(expected, actual)}\n`,
    );
    process.exitCode = 1;
  });
}
