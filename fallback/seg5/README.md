# fallback/seg5

Reserve for segment 5 if the live agent session misbehaves on stage.

## What goes here (from your rehearsal)

Paste into this folder, from your own rehearsal in Claude Code or Cursor:

- `session.md`: the transcript of the good run of segment 5 (copy it out of the tool; I could not produce one).
- `screenshots/`: optional.

A recorded session is the only thing that shows the agent's behaviour. Nothing in this repo can stand in for it.

## What is already here

- `expected-output.txt`: the **deterministic tool output, not a model session**: exactly what the `npm run`
  commands of segment 5 print when replayed from `fixtures/llm` in a clean checkout. A test fails if it is
  out of date; regenerate with `npm run dry-run -- --write-fallback`.
- `golden-claims.txt`: the golden set at the seg2 cut-off (four items)
- `eval-v1.txt`: per-item evaluation of claims@v1: TP 2, FP 2, FN 2
- `eval-v2-summary.txt`: claims@v2 summary after the replay
- `drift-v1-v2.txt`: drift between the two versions, criteria 1 and 3 failed
