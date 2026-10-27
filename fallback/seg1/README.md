# fallback/seg1

Reserve for segment 1 if the live agent session misbehaves on stage.

## What goes here (from your rehearsal)

Paste into this folder, from your own rehearsal in Claude Code or Cursor:

- `session.md`: the transcript of the good run of segment 1 (copy it out of the tool; I could not produce one).
- `screenshots/`: optional.

A recorded session is the only thing that shows the agent's behaviour. Nothing in this repo can stand in for it.

## What is already here

- `expected-output.txt`: the **deterministic tool output, not a model session**: exactly what the `npm run`
  commands of segment 1 print when replayed from `fixtures/llm` in a clean checkout. A test fails if it is
  out of date; regenerate with `npm run dry-run -- --write-fallback`.
- `rag-query.txt`: the run-sheet fallback for the first query (two chunks, 500 and 750 EUR).
- `rag-after-delete.txt`: the same query after `seg1 delete --edition 2024` (one result).
- `rag-extract.txt`: the one-shot blob (a recorded response, no model call).
