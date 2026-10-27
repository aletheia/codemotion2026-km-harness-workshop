# PROMPTS.md — building the repository with Claude Code, step by step

Each step: run the shell commands, paste the prompt into Claude Code, wait until it reports the acceptance check passing, run the verification yourself, commit. Do not paste the next prompt until the current verification passes. One phase per Claude Code session (`/clear` between phases) keeps the context small; `CLAUDE.md` is reloaded automatically.

## Step 0 — set up (5 min)

```
cp -R "<OneDrive>/operations/personal-branding/talks/2026-Codemotion-Milan/updated-version/dnk-workshop-start" ~/code/dnk-workshop
cd ~/code/dnk-workshop
git init && git add -A && git commit -m "start: fixtures, workshop docs, expected outputs"
node --version        # must be >= 20
claude
```

Inside Claude Code: `/model` → the strongest model available; accept-edits mode (Shift+Tab) so it can write files without asking at every step. It still asks before running commands unless you allow them; allow `npm`, `npx`, `node`, `git`.

## Step 1 — Phase A: domain, events, log, tail (30–40 min)

```
Read CLAUDE.md in full, then workshop/04-domain-model-reference.md §1, §3, §4, §5, §7 and workshop/03-walkthrough-script.md up to the end of segment 2.

Implement Phase A of CLAUDE.md §14 only:
- package.json (type module, Node >= 20) with every npm script name of CLAUDE.md §11 declared now (scripts of later phases may print "not implemented yet" and exit 1), devDependencies tsx, typescript, vitest, @types/node; dependency zod. tsconfig strict, ESM, noEmit.
- src/config.ts (illustrative values, golden cut-off g1 = 15, fixed clock).
- src/domain/: branded ids, DocumentVersion, Span, Claim, NormalizedValue (including integer and reference), the transition() state machine of 04 §5 with both harness exceptions.
- src/events/: the envelope, zod schemas for every event type of 04 §4 split into fact and decision families (evidence required on decisions, forbidden on facts), deterministic eventId (SHA-256, 16 hex), idempotent append to out/events.jsonl, read, fold.
- src/tools/log-init.ts (LogInitialised + bootstrap ExtractorVersionPromoted(claims@v1) by human(luca)), log-reset.ts, tail-format.ts (the tail line format of CLAUDE.md §10, ev-NNNN display ids of §13), log-cat.ts, and the scripts log:init, log:reset, tail, log:cat.
- Unit tests: every allowed and every forbidden transition, eventId determinism, append idempotency (duplicate returns the existing seq), schema rejects a decision event without evidence and a fact event with evidence.

Acceptance: npm test is green; after npm run log:reset && npm run log:init, the output of npm run log:cat is identical to the first two lines of fallback/seg2/log-after-extract.txt. Show me both outputs side by side, then commit with message "phase A: domain, events, log, tail".
```

Verify yourself:

```
npm test
npm run log:reset && npm run log:init && npm run log:cat
head -2 fallback/seg2/log-after-extract.txt
```

## Step 2 — Phase B: segment 2 (45–60 min)

```
/clear
Read CLAUDE.md, workshop/00-running-example.md §3–§6 and §11, workshop/04-domain-model-reference.md §2, fixtures/documents/README.md and manifest.json, and the segment 2 part of workshop/03-walkthrough-script.md.

Implement Phase B of CLAUDE.md §14 only:
- src/catalog/: the subject catalogue of 00 §4 with synonyms and critical classes (monetary, count, time-limit), the value normalizer ("2 milioni di euro" → money 2000000 EUR; "10 unità" → integer 10 count; "due esercizi" → integer 2 years; "trenta giorni" → integer 30 days), labels.ts with the table of CLAUDE.md §13.
- src/agents/: the fixture replayer of CLAUDE.md §6 (throws FixtureMissing, never calls a model) and the structure and claims extractors.
- fixtures/llm/: structure@v1 on v8 (tree from manifest.json) and claims@v1 on v8 c2 exactly as CLAUDE.md §6 (section-local spans).
- src/acl/structureToClaims.ts as CLAUDE.md §7.
- src/processes/review.ts: the guided reviewer CLI of CLAUDE.md §8 with fixtures/review/decisions.json for the first two stages; review:auto applies a stage without waiting.
- tools and scripts: ingest:v8, extract:structure-v8, review, review:auto, extract:claims-v8, show:ricavi-v8 (and generic show -- --event <ref>).
- Unit tests: normalizer forms, span conversion local → absolute (attivo local [278,342) + 720 = [998,1062)), ACL skips the note node and rejects a tree without intervals with ACLRejected, replayer throws on a missing fixture, labels.

Acceptance: running npm run log:reset, log:init, ingest:v8, extract:structure-v8, review:auto, extract:claims-v8, review:auto in this order produces a log of exactly 15 events, and npm run log:cat equals fallback/seg2/log-after-verify.txt line by line; each step's output composed as in CLAUDE.md §12 (stdout followed by the tail lines it appended) equals its file in fallback/seg2/; npm run show:ricavi-v8 matches fallback/seg2/show-ricavi-v8.txt except the eventId hash. Show me the diffs (expected empty), then commit with message "phase B: catalog, replayer, ACL, reviewer, segment 2".
```

Verify yourself:

```
npm run log:reset && npm run log:init && npm run ingest:v8 && npm run extract:structure-v8 && npm run review:auto && npm run extract:claims-v8 && npm run review:auto
npm run log:cat | diff - fallback/seg2/log-after-verify.txt && echo SEG2 OK
npm run show:ricavi-v8
npm run review          # try the guided mode once: Enter confirms
```

## Step 3 — Phase C: segment 3 (40–50 min)

```
/clear
Read CLAUDE.md §4, §6, §8, §9, §13, workshop/05-harness-design.md §5–§7, workshop/00-running-example.md §6 and §9, and the segment 3 part of workshop/03-walkthrough-script.md.

Implement Phase C of CLAUDE.md §14 only:
- src/harness/beliefs/currentBeliefs.ts, compare/comparator.ts, sampling/auditPolicy.ts, prior/importSystemOfRecord.ts (tested, not used live), the cold-start batch gate.
- Structure class-A reconfirmation in extract:v9 (same paths and types as the verified v8 tree → StructureVerified by harness(compare)).
- fixtures/llm/: structure@v1 on v9, claims@v1 on v9 c2, c3, c5 (six correct claims).
- src/processes/compare.ts and the compare script: prints the batch line, the cold-start gate line and one line per proposal with its class, then appends 1 ClaimVerified(harness) + 1 ClaimSuperseded(reconfirmation-chain) + 3 ClaimContested; class B and UNEXPECTED stay proposed.
- The third review stage in fixtures/review/decisions.json (verify the three v9 claims, supersede the three v8 claims).
- fixtures/layers-4-6/excerpt.jsonl (hand-authored from 00 §9) and the layers-4-6 script (prints it through the tail formatter with seq "—", never appends).
- Unit tests: one per comparator class and UNEXPECTED, CurrentBeliefs throws on two verified non-superseded claims for one key, Policies/Workflow never take class A, gate returns not-applicable below the minimum.

Acceptance: continuing the segment 2 log with ingest:v9, extract:v9, compare, review:auto gives exactly 35 events; log:cat equals fallback/seg3/log-after-compare.txt; compare equals fallback/seg3/compare.txt; layers-4-6 equals fallback/seg3/layers-4-6.txt; CurrentBeliefs holds 4 keys (attivo 4 M, ricavi 4 M, dipendenti 20, esercizi 2 by harness with human root). Show me the diffs, then commit with message "phase C: comparator, beliefs, cold-start gate, segment 3".
```

Verify yourself:

```
npm run ingest:v9 && npm run extract:v9 && npm run compare && npm run review:auto
npm run log:cat | diff - fallback/seg3/log-after-compare.txt && echo SEG3 OK
npm run layers-4-6
```

## Step 4 — Phase D: segment 4 (30–40 min)

```
/clear
Read CLAUDE.md §3, §6, §11, workshop/04-domain-model-reference.md §6 and the segment 4 part of workshop/03-walkthrough-script.md.

Implement Phase D of CLAUDE.md §14 only:
- src/projections/: CurrentBeliefs, ClaimsByDocumentVersion, ConflictQueue, ReviewQueue, Timeline, beliefsAt (--at = valid time by the effective dates of the ingested versions; --seq = transaction-time fold). Written to out/projections/, droppable and rebuildable.
- fixtures/llm/: claims@v2 on v8 c2 (CLAUDE.md §6, including ricavi 2,000 EUR and the unexpected cessazione) and on v9 c2, c3, c5 (six correct).
- scripts: projections:drop, projections:build, replay:claims-v2 (re-runs the claims layer with claims@v2 over every StructureVerified in the log: appends 11 ClaimProposed, never modifies a line), projections:diff (candidate claims@v2 vs promoted claims@v1 per document version), beliefs:at-2019-04-30, beliefs.
- Unit tests: drop + build gives the same CurrentBeliefs; replay of the same extractor version twice appends nothing the second time; beliefsAt on 2019-04-30 returns the v8 values.

Acceptance: from the end of segment 3, projections:drop + projections:build equals fallback/seg4/projections-rebuilt.txt; replay:claims-v2 equals fallback/seg4/replay-claims-v2.txt and the log has 46 events; projections:diff equals fallback/seg4/projections-diff.txt; beliefs:at-2019-04-30 followed by beliefs equals fallback/seg4/beliefs-at-2019-04-30.txt. Show me the diffs, then commit with message "phase D: projections, replay, valid-time beliefs".
```

Verify yourself:

```
npm run projections:drop && npm run projections:build
npm run replay:claims-v2 && npm run projections:diff
npm run beliefs:at-2019-04-30 && npm run beliefs
```

## Step 5 — Phase E: segments 5 and 6 (40–50 min)

```
/clear
Read CLAUDE.md §5, workshop/05-harness-design.md §1–§4 and §7, workshop/00-running-example.md §6–§8, and the segment 5 and 6 parts of workshop/03-walkthrough-script.md.

Implement Phase E of CLAUDE.md §14 only:
- src/harness/golden/query.ts (pure; human decisions only; harness/import excluded; prompt examples excluded; named cut-off g1 = 15).
- src/harness/eval/: align, classify, count, metrics (micro-average, IoU on half-open intervals, θ = 0.8), drift, promotion (four criteria), batchGate. eval appends EvalCompleted; promotion appends ExtractorVersionPromoted only when all criteria hold.
- scripts: golden:claims-until-seg2, golden:claims, eval:claims-v1, eval:claims-v2-summary, drift:v1-v2, ask:ricavi-2019-04-30, ask:ricavi (the consumption policy of 00 §8: monetary and time-limit quantities only from human-rooted verified beliefs; never proposed or contested; answers cite belief, actor, event and span; reads projections only).
- Unit tests with the worked numbers: v1 TP 2 FP 2 FN 2 P 0.50 R 0.50, attivo IoU 62/64; v2 TP 3 FP 2 FN 1 P 0.60 R 0.75; drift row ricavi.limite = regression; promotion fails criteria 1 and 3; golden exclusions.

Acceptance: from the end of segment 4 (46 events), the scripts in the order above produce outputs equal to fallback/seg5/golden-claims.txt, eval-v1.txt, eval-v2-summary.txt, drift-v1-v2.txt and fallback/seg6/ask.txt; golden:claims prints "inputs: 2 · expected items: 7"; the log ends at 48 events. Show me the diffs, then commit with message "phase E: golden sets, eval, drift, promotion, ask".
```

Verify yourself:

```
npm run golden:claims-until-seg2 && npm run golden:claims
npm run eval:claims-v1 && npm run eval:claims-v2-summary && npm run drift:v1-v2
npm run ask:ricavi-2019-04-30 && npm run ask:ricavi
```

## Step 6 — Phase F: segment 1, dry-run, README (30–40 min)

```
/clear
Read CLAUDE.md §11, §12, §15 and the segment 1 part of workshop/03-walkthrough-script.md.

Implement Phase F of CLAUDE.md §14 only:
- src/rag-baseline/: deterministic local retriever over the three files in fixtures/documents (fixed-size chunks of about 160 characters, TF-IDF vectors computed at index time, cosine similarity; no embedding model, no network), stored in out/rag/. Scripts rag:index, rag:query, rag:delete-v8, rag:extract-c2 (the one-shot extraction replayed from fixtures/llm/oneshot@v1). rag:query must return the three lettera c) passages of v7, v8 and v9 in its top 3; similarity values may differ from the fallback file.
- dry-run: runs log:reset and every script of CLAUDE.md §11 in walkthrough order (review:auto instead of review), writes each output to out/dry-run/<segment>/<name>.txt, diffs against fallback/ and prints "dry-run: OK" or the first differing file. dry-run --update overwrites fallback/ with the real outputs (same file names).
- README.md with the sections of CLAUDE.md §15.
- Tests: an end-to-end test that runs the dry-run in a temporary out/ and asserts it is OK; a test asserting that no file under src/agents imports a decision-event constructor.

Then run npm run dry-run -- --update once, inspect git diff fallback/ and tell me every change that is not a similarity score or an id hash, run npm run dry-run three times, run npm test, and commit with message "phase F: rag baseline, dry-run, README".
```

Verify yourself:

```
npm run dry-run && npm run dry-run && npm run dry-run
npm test
git diff HEAD~1 -- fallback/ | head -80
```

## Step 7 — pre-talk hardening (15 min)

```
rm -rf node_modules && npm ci          # with network, once
# turn Wi-Fi off
npm run dry-run && npm test
npm run log:reset && npm run rag:index
```

Copy the whole folder (with `node_modules`) to a USB stick. Terminal at 18 pt, light theme; right pane `npm run tail`; left pane the repository root; a second tab in `fallback/`.

## If a phase does not close

Stop at the last green commit. The segments after it run from `fallback/` with `cat` (the sentence to say is under "Fallback" in `workshop/03-walkthrough-script.md`). If Claude Code loops on a diff, paste the diff into a new message with: "Make only this output match fallback/<file>; do not change any other module."
