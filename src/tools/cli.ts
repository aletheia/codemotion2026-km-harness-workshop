// Shared CLI plumbing: argument lookup and the one-line-on-stderr error contract.
import { EventRejected, LogInvalid } from '../events/log';

export function argValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export const hasFlag = (argv: readonly string[], name: string): boolean => argv.includes(`--${name}`);

/** Exit codes: 1 usage/unexpected, 2 rejected by a domain rule, 3 log invalid. */
export async function run(name: string, main: () => void | Promise<void>): Promise<void> {
  try {
    await main();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${name}: ${message}\n`);
    process.exitCode = err instanceof LogInvalid ? 3 : err instanceof EventRejected ? 2 : 1;
  }
}
