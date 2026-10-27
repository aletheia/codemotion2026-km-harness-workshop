// What each npm script does, in one sentence, printed on stderr when the script starts so the room can follow.
// stderr keeps stdout byte-identical with fallback/ (AGENTS.md §12). DNK_NARRATE=0 silences it.
export const scriptNarration: Readonly<Record<string, string>> = {
  'log:reset': 'removes out/ (event log and projections): the next log:init starts again from seq 1',
  'log:init': 'creates the append-only log out/events.jsonl: LogInitialised, then claims@v1 promoted by a human',
  'log:cat': 'prints the whole log through the tail formatter: the log is the only state',
  'viewer': 'serves a read-only browser view of the log on localhost: it re-reads the log on every request',
  'tail': 'follows out/events.jsonl and prints every appended event (★ = decision event, with its evidence)',
  'rag:index': 'chunks v7, v8, v9 of art. 2477 one paragraph per chunk and embeds them in a local vector index',
  'rag:query': 'asks the index the segment-6 question: the top chunks by similarity, with no version or validity date',
  'rag:delete-v8': 'deletes the v8 chunks from the index: what the index "knew" disappears with the document',
  'rag:extract-c2': 'one-shot extraction of comma 2 of v8 from the retrieved chunk: a JSON blob, no span, no version, no date',
};

export function narrate(script: string | undefined): void {
  if (!script || process.env.DNK_NARRATE === '0') return;
  const text = scriptNarration[script];
  if (!text) return;
  const line = `▸ ${script} — ${text}`;
  process.stderr.write(process.stderr.isTTY ? `\x1b[36m${line}\x1b[0m\n` : `${line}\n`);
}
