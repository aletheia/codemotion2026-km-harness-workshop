# fallback/seg6

Reserve for segment 6 if the live agent session misbehaves on stage.

## What goes here (from your rehearsal)

Paste into this folder, from your own rehearsal in Claude Code or Cursor:

- `session.md`: the transcript of the good run of segment 6 (copy it out of the tool; I could not produce one).
- `screenshots/`: optional.

A recorded session is the only thing that shows the agent's behaviour. Nothing in this repo can stand in for it.

## What is already here

- `expected-output.txt`: the **deterministic tool output, not a model session**: exactly what the `npm run`
  commands of segment 6 print when replayed from `fixtures/llm` in a clean checkout. A test fails if it is
  out of date; regenerate with `npm run dry-run -- --write-fallback`.
- `ask.txt`: the run-sheet command: fire deductible as of 2024-03-01 (500 EUR)
- `ask-now.txt`: the same question without a date (750 EUR)
- `ask-theft.txt`: Theft deductible 2025: usable, harness-verified with a human root
- `ask-hail.txt`: Hail deductible 2025: still proposed, the agent cannot assert it
