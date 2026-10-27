# fallback/seg3

Reserve for segment 3 if the live agent session misbehaves on stage.

## What goes here (from your rehearsal)

Paste into this folder, from your own rehearsal in Claude Code or Cursor:

- `session.md`: the transcript of the good run of segment 3 (copy it out of the tool; I could not produce one).
- `screenshots/`: optional.

A recorded session is the only thing that shows the agent's behaviour. Nothing in this repo can stand in for it.

## What is already here

- `expected-output.txt`: the **deterministic tool output, not a model session**: exactly what the `npm run`
  commands of segment 3 print when replayed from `fixtures/llm` in a clean checkout. A test fails if it is
  out of date; regenerate with `npm run dry-run -- --write-fallback`.
- `log-after-extract-2025.jsonl`: raw stdout of `npm run tail -- --all --jsonl` after the 2025 extraction (the file the run sheet names).
- `log-after-compare.jsonl`: same command after `compare` and the scripted review.
- `layers-4-6.jsonl`: the hand-written, pre-computed layers 4 to 6 excerpt (every line has `precomputed:true`; never produced by a live run).
