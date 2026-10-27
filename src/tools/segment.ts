// npm run seg:<N> [-- --yes] — runs the live steps of segment N one by one, saying what each does and why,
// asking before each step, and printing the events each step appended to the log.
// --yes runs every step without asking (review becomes review:auto); it is also the default without a terminal.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { config } from '../config';
import { hasFlag } from './cli';
import { segments } from './segments';

/** The phase (AGENTS.md §14) that builds each segment's scripts. */
const builtIn: Readonly<Record<number, string>> = { 1: 'F1', 2: 'B', 3: 'C', 4: 'D', 5: 'E1', 6: 'E2' };

const argv = process.argv.slice(2);
const n = Number(argv[0]);
const auto = hasFlag(argv, 'yes') || !process.stdin.isTTY;
const tty = process.stdout.isTTY;
const bold = (s: string) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const cyan = (s: string) => (tty ? `\x1b[36m${s}\x1b[0m` : s);
const dim = (s: string) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

const eventCount = (): number =>
  existsSync(config.paths.log) ? readFileSync(config.paths.log, 'utf8').split('\n').filter((l) => l.trim()).length : 0;

const npm = (args: string[], env: NodeJS.ProcessEnv = process.env): number =>
  spawnSync('npm', ['run', '--silent', ...args], { stdio: 'inherit', env }).status ?? 1;

async function ask(prompt: string): Promise<string> {
  // A fresh interface per question: the step itself (review) needs stdin while it runs.
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim().toLowerCase();
  } finally {
    rl.close();
  }
}

const segment = segments[n];
if (!segment) {
  process.stderr.write(`seg:${argv[0] ?? '?'}: not implemented yet (phase ${builtIn[n] ?? '?'})\n`);
  process.exit(1);
}

const total = segment.steps.length;
process.stdout.write(`\n${bold(`━━ Segment ${n} · ${segment.title} ━━`)}  ${dim(`${total} steps`)}\n`);
if (segment.expectsEvents !== undefined) {
  const have = eventCount();
  const note = have === segment.expectsEvents ? 'as expected' : `expected ${segment.expectsEvents}: run the previous segments first`;
  process.stdout.write(dim(`log: ${have} events in ${config.paths.log} (${note})\n`));
}

for (const [i, step] of segment.steps.entries()) {
  const script = auto && step.auto ? step.auto : step.script;
  process.stdout.write(`\n${bold(`[${i + 1}/${total}] npm run ${script}`)}\n${cyan(`      ${step.why}`)}\n`);
  if (!auto) {
    const answer = await ask(dim('      ⏎ run · s skip · q quit  '));
    if (answer === 'q') process.exit(0);
    if (answer === 's') continue;
  }

  const before = eventCount();
  const status = npm([script]);
  const appended = eventCount() - before;
  if (appended > 0) {
    process.stdout.write(dim(`      +${appended} event${appended > 1 ? 's' : ''} appended to ${config.paths.log}:\n`));
    npm(['tail', '--', '--once', '--n', String(appended)], { ...process.env, DNK_NARRATE: '0' });
  } else if (status === 0) {
    process.stdout.write(dim('      (nothing appended to the log)\n'));
  }
  if (status !== 0) {
    process.stderr.write(`seg:${n}: npm run ${script} exited with ${status}\n`);
    process.exit(status);
  }
}

const next = n < 6 ? `git checkout ws-seg${n + 1} && npm run seg:${n + 1}` : 'end of the walkthrough';
process.stdout.write(`\n${bold(`Segment ${n} done.`)} ${dim(`log: ${eventCount()} events · next: ${next}`)}\n`);
