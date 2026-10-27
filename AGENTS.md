# AGENTS.md — single source of rules (Claude Code and Cursor)

This repo is a small, offline, event-sourced knowledge-extraction harness. Domain: the home-insurance
policy "Casa Protetta", editions 2024 and 2025, Article 12 ("Franchigie e scoperti"). All documents are
synthetic. No model is called by the tools: LLM output comes from recorded fixtures (`fixtures/llm`).

`CLAUDE.md` only imports this file. Skills and subagents are written once in `agent/` and copied to the
`.claude/` and `.cursor/` locations by `npm run sync` (never edit the copies).

## Rules for the agent

1. **Propose, never decide.** You may only run `npm run propose` (claims) and read things. You never verify,
   contest, supersede or promote anything. Verification belongs to a human or to the harness (class A only).
2. **Use only the `npm run` commands below.** Never write to `events/`, never edit `projections/`, never
   edit generated copies under `.claude/skills|agents` or `.cursor/skills|agents`.
3. **Quotes are verbatim.** `quote` must be an exact substring of the unit text and must lie inside the span
   you cite. Spans you pass are **section-local, half-open** `[start, end)`; the harness converts them.
4. **No guessing.** If a value is not written in the unit text, do not emit a claim for it.
5. **A rejection is information, not an obstacle.** A command that fails exits non-zero with one line on
   stderr. Read it, fix the claim you proposed, run again. Do not "fix" a quote to make it pass if the text
   does not support the claim.
6. **Tool output is JSON** (`{"ok":true,"command":...}`); add `--text` for a human table where supported.
   Exit codes: 1 usage/unexpected, 2 rejected by a domain rule, 3 log invalid.
7. Never invent measured numbers. Values in `src/config.ts` are illustrative.

## Commands

| Command | What it does |
|---|---|
| `npm run doctor` | Checks Node version, installed deps, required files, generated copies. |
| `npm run reset` | Returns the demo to a clean state (empties `events/` and `projections/`). Not pre-granted. |
| `npm run seg1 -- <sub>` | Segment 1 baseline: `query --q <text>`, `delete --edition <year>`, `extract --section art12`, `index`. Index is in `state/`; `reset` removes it. |
| `npm run seg2 -- <sub>` | Segment 2 pipeline: `log-init`, `ingest`, `extract structure\|claims`, `review`, `show`. |
| `npm run seg3 -- <sub>` | Segment 3: `ingest`, `extract --layers structure,claims`, `compare`, `review --auto`, `layers-4-6` (pre-computed excerpt). |
| `npm run seg4 -- <sub>` | Segment 4: `log-cat`, `projections-drop`, `projections-build`, `projections-diff`, `beliefs`, `replay --extractor claims@v2`. |
| `npm run seg5 -- <sub>` | Segment 5: `golden`, `eval`, `drift` (read-only over the log). |
| `npm run seg6 -- ask ...` / `npm run ask -- --q "franchigia incendio" [--as-of YYYY-MM-DD]` | Segment 6: answer from the projection only, citing the belief id, actor, evidence span and edition. `--as-of` is VALID time. Applies the consumption policy to the root of the evidence chain: a proposed or contested belief is never an answer; monetary subjects need a human root. Read-only. |
| `npm run golden [-- --layer claims\|structure --until N]` | The golden set: human `ClaimVerified` events up to `--until` (default: the cut-off after seg2, seq 15), harness/import decisions and prompt examples excluded. |
| `npm run eval -- --extractor claims@v1 [--summary]` | Per-item TP/FP/FN, precision and recall of one extractor version against the golden set (IoU threshold 0.8). Read-only. Run `replay --extractor` first for a version with no proposals. |
| `npm run drift -- --from claims@v1 --to claims@v2` | Per item: stable, regression, improvement, stable-wrong; the noise list; the four promotion criteria. Never promotes: promotion is a human decision. |
| `npm run log-cat [-- --chain <seq\|superseded>]` | The formatted log (seq, type, actor, aggregate, caused by) or one causation chain, root first. |
| `npm run beliefs [-- --at YYYY-MM-DD \| --seq N]` | CurrentBeliefs. `--at` is VALID time (edition in force on that date); `--seq` is TRANSACTION time (the log up to event N). |
| `npm run projections-diff` | What the promoted extractor version and a candidate proposed, side by side. |
| `npm run compare` | The comparator on the newest edition: class A (harness verifies and supersedes, evidence attached), B (stays proposed), C (contested, a human resolves). Prints the batch-gate line. |
| `npm run unit -- --doc cp-2024 [--section art12]` | Prints the extraction unit you are allowed to see. |
| `npm run propose -- --file <claims.json>` | Agent write path. Provenance checked inside; whole batch rejected on failure (exit 2). |
| `npm run replay` | Re-folds the log from scratch; prints counts and the CurrentBeliefs hash. |
| `npm run tail [-- --n 10 \| --all]` | Last events of the log. |
| `npm run sync` | Copies `agent/skills` and `agent/agents` to the `.claude/` and `.cursor/` locations. |
| `npm run fixtures` | Regenerates `fixtures/` (a test fails if they differ from the committed ones). |
| `npm test`, `npm run typecheck` | Test suite and type check. |


## Glossary (defined once)

- **Event log**: `events/events.jsonl`. Append-only; exactly one function appends (`src/adapters/eventLog.ts`).
  Every change of state is an event; state is a fold of the log.
- **Layers**: source → structure → claims → entities → policies → workflow. Each layer is built on the verified
  output of the previous one; a `ClaimProposed` event must be caused by a `StructureVerified` event.
- **Claim**: one statement about a subject (`fire.deductible`) with a normalized value, a verbatim quote and
  an absolute span in one document version.
- **Claim states**: `proposed` → `verified` → `contested` → `superseded`. Agents emit only `*Proposed`.
- **Actor kinds**: `human`, `agent`, `harness`, `import`, `process`. `process` is used for log/ingest/cursor
  facts and for ACL rejections.
- **Decision vs fact**: decision events (Verified, Contested, Superseded, Promoted) carry evidence; fact events
  (Ingested, Proposed, Rejected, Cursor) must not.
- **Span**: half-open `[start, end)` in UTF-16 code units of the document text. Absolute in the log;
  section-local in unit/propose input. The anti-corruption layer (ACL) adds the section base offset.
- **ACL**: the only code that turns a verified structure into the claims-extraction unit. It refuses when
  the structure is not verified (records `ACLRejected`).
- **Provenance check**: the quote appears verbatim in the document and inside the cited span. Runs inside
  the write path, not in a hook.
- **Comparator classes** (when a new edition's claim meets the current belief for the same subject):
  A reconfirmation (same normalized value), B novelty (no belief yet), C conflict (different value).
- **CurrentBeliefs**: the verified, non-superseded claims, at most one per (lineage, subject).
  Valid-time query = "which edition was in force on this date". Transaction-time query = "state of the log
  up to `SEQ=n`".
- **Golden set**: a query over the log, not a file: the decision events of a layer taken by a human, up to a
  sequence number, excluding decisions made by the harness or imported, and excluding prompt examples.
- **Extractor version**: `claims@v1`, `claims@v2`. Promotion is an event (`ExtractorVersionPromoted`).
- **Critical class**: monetary, exclusion, time-limit. A regression there blocks promotion.
