// Heuristic for the OPTIONAL PreToolUse hook: does a shell command look like it writes to events/ ?
// Pure. This is a convenience layer only. The real guarantees are in code:
//   - the only function that appends is src/adapters/eventLog.ts `append` (test/append-only.test.ts)
//   - every provenance/state-machine check runs inside src/app/commit.ts before `append`
//   - .claude/settings.json denies Edit/Write on events/ (file tools, and the shell redirections/tee/sed
//     that Claude Code itself recognises)
const TOUCHES_EVENTS = /(^|[\s"'=:/])(\.\/)?events(\/|\b)(?!-)/;
const WRITE_WORDS = /(^|[\s;&|(])(rm|mv|cp|truncate|dd|tee|sed\s+-i|perl\s+-i|install|ln|chmod|touch|shred)(\s|$)|>>?|\bwriteFile|\bappendFile|\bopen\(.*['"][wa]/;

export function looksLikeEventsWrite(command: string): boolean {
  return TOUCHES_EVENTS.test(command) && WRITE_WORDS.test(command);
}
