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
  'ingest:v8': 'appends DocumentVersionIngested for v8, after checking its text against the hash in manifest.json',
  'ingest:v9': 'appends DocumentVersionIngested for v9, after checking its text against the hash in manifest.json',
  'extract:structure-v8': 'the structure agent proposes the section tree of v8 (StructureProposed): nothing is verified yet',
  'extract:claims-v8': 'the ACL turns the verified tree into extraction units; the claims agent proposes claims for comma 2 of v8',
  'extract:v9': 'v9: structure proposed and reconfirmed by the harness (class A), then claims proposed for commi 2, 3, 5',
  'review': 'the reviewer CLI (a process, actor human): shows each pending decision with its evidence; Enter confirms',
  'review:auto': 'applies the pending review stage from fixtures/review/decisions.json without waiting',
  'show': 'prints one event of the log as JSON: envelope, actor, causation, payload, evidence',
  'show:ricavi-v8': 'prints the ricavi.limite proposal as JSON: span, normalized value, extractor version, causation',
  'compare': 'the harness compares each v9 proposal with the current beliefs: class A verified, B queued, C contested',
  'layers-4-6': 'prints a hand-authored excerpt of the entities, policies and workflow layers (never appended to the log)',
};

export function narrate(script: string | undefined): void {
  if (!script || process.env.DNK_NARRATE === '0') return;
  const text = scriptNarration[script];
  if (!text) return;
  const line = `▸ ${script} — ${text}`;
  process.stderr.write(process.stderr.isTTY ? `\x1b[36m${line}\x1b[0m\n` : `${line}\n`);
}
