// OPTIONAL Claude Code PreToolUse hook (matcher: Bash). Reads the hook JSON on stdin; exits 2
// (= block, stderr is shown to the model) when the command looks like a write to events/.
// Everything it does is also enforced in code; this only gives the agent an earlier, clearer refusal.
// Not verified inside Claude Code or Cursor in this repo's tests: only the pure check is unit-tested.
import { looksLikeEventsWrite } from '../../src/domain/guard';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw) as { tool_input?: { command?: string } };
    const cmd = input.tool_input?.command ?? '';
    if (looksLikeEventsWrite(cmd)) {
      process.stderr.write('blocked: events/ is append-only; only the npm run tools may add events.\n');
      process.exit(2);
    }
  } catch {
    // unreadable hook input: do not block (the permission rules and the code-level guard still apply)
  }
  process.exit(0);
});
