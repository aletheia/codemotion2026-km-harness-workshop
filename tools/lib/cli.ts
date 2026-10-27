// CLI plumbing shared by every tool. Contract:
//   success -> exit 0, ONE JSON object on stdout: {"ok":true,"command":"<name>", ...}
//              (or human tables when --text is given)
//   failure -> non-zero exit, ONE line on stderr: "error: <message>", nothing on stdout
//   exit codes: 1 usage/unexpected, 2 rejected by a domain rule, 3 the log is invalid
import { LogInvalid, Rejection, UsageError } from '../../src/app/errors';

export interface Args { _: string[]; flags: Record<string, string | true> }

export function parseArgs(argv: string[], booleans: readonly string[] = []): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq));
    if (eq !== -1) out.flags[key] = a.slice(eq + 1);
    else if (booleans.includes(key) || i + 1 >= argv.length || argv[i + 1]!.startsWith('--')) out.flags[key] = true;
    else out.flags[key] = argv[++i]!;
  }
  return out;
}

export function flag(args: Args, name: string): string | undefined {
  const v = args.flags[name];
  return typeof v === 'string' ? v : undefined;
}
export function need(args: Args, name: string): string {
  const v = flag(args, name);
  if (!v) throw new UsageError(`missing --${name}`);
  return v;
}

export function fail(message: string, code: number): never {
  process.stderr.write(`error: ${message.replace(/\s*\n\s*/g, ' ').trim()}\n`);
  process.exit(code);
}

export function emit(command: string, data: Record<string, unknown>, text?: string, args?: Args): void {
  if (args?.flags.text && text !== undefined) process.stdout.write(`${text}\n`);
  else process.stdout.write(`${JSON.stringify({ ok: true, command, ...data })}\n`);
}

export async function run(fn: () => unknown | Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Rejection) fail(msg, 2);
    if (e instanceof LogInvalid) fail(`log invalid: ${msg}`, 3);
    if (e instanceof UsageError) fail(msg, 1);
    fail(msg, 1);
  }
}
