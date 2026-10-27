---
name: inspect-log
description: Read the event log and the current state without changing anything. Use to answer "what happened", "what is the state", "why was this accepted or rejected".
---

# Inspect the log (read only)

- `npm run tail -- --n 10 --text` shows the latest events.
- `npm run replay` re-folds the log from scratch and prints counts and the CurrentBeliefs hash.
- `npm run seg2 -- show <seq> --text` prints one event in full, including its evidence.

Report what the output says. Do not infer events that are not in the log. Do not run anything that writes.
