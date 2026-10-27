# fallback/seg4

Reserve for segment 4 if the live agent session misbehaves on stage.

## What goes here (from your rehearsal)

Paste into this folder, from your own rehearsal in Claude Code or Cursor:

- `session.md`: the transcript of the good run of segment 4 (copy it out of the tool; I could not produce one).
- `screenshots/`: optional.

A recorded session is the only thing that shows the agent's behaviour. Nothing in this repo can stand in for it.

## What is already here

- `expected-output.txt`: the **deterministic tool output, not a model session**: exactly what the `npm run`
  commands of segment 4 print when replayed from `fixtures/llm` in a clean checkout. A test fails if it is
  out of date; regenerate with `npm run dry-run -- --write-fallback`.
- `log-cat.txt`: deterministic tool output of `npm run log-cat -- --text` at the end of segment 3.
- `projections-rebuilt.txt`: `projections-build` after `projections-drop`: same hash.
- `projections-diff.txt`: `projections-diff` after the claims@v2 replay.
- `beliefs-at-2024-03-01.txt`: `beliefs --at 2024-03-01` (valid time).
