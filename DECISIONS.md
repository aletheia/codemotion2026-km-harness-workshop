# DECISIONS

Defaults chosen where the brief left a choice open. Change them here first, then in code.

## Defaults

1. **Cold-start batch gate.** Below the probe minimum (10 expected items, `config.gate.probeMinimum`) the gate
   is "not applicable". Class A is then decided by the comparator alone and class-A audit sampling is 100 %,
   for Structure and Claims alike.
2. **Time axes.** `beliefs AT=<date>` and `ask AS_OF=<date>` are **valid-time** queries (the edition in force on
   that date). **Transaction time** is `SEQ=<n>` (the log up to sequence number n).
3. **Actor kind `process`** for LogInitialised, DocumentVersionIngested, ACLRejected, CursorAdvanced.
4. **`eval` coordinates.** Prints absolute span coordinates with the section-local form in brackets.
5. **Segment 5 checkpoint wording** as in run-sheet change #8: v2 also fails criterion 1; drift lists both.

## Deviations from the run sheet (all deliberate)

- `make X` became `npm run X`, arguments after `--` (`AT=...` → `--at ...`).
- Event ids are real hashes (`sha256` truncated to 16 hex of producer, input artifact, extractor version,
  type, aggregate), not `ev-0006`; `occurredAt` comes from a logical clock (2026-10-28T13:00:00Z + seq seconds)
  so two runs are byte-identical.
- A claim keeps one `claimId` across extractor versions (hash of document, version, subject, value);
  re-proposing an existing claim only adds an attribution.
- `ClaimProposed` carries `quote` and `sectionPath`; a human `ClaimVerified` may carry `reviewedSpans`.
- The documents are synthetic: 4594 (2024) and 4736 (2025) UTF-16 code units, not the 7480/7612 of the sketch.
  Spans are UTF-16 offsets, half-open.
- No system-of-record import: the log starts from `LogInitialised` and the ingested documents.
- The default `eval` golden cut is the sequence number just before the second edition's
  `DocumentVersionIngested` event; `--until` overrides it.
- Batch ids look like `btc-2025-01`.
- The seg1 retriever is a deterministic hashed n-gram index (computed scores, not a neural embedding).
- `reset` is deliberately **not** pre-granted in `.claude/settings.json`: the presenter runs it.
- Tag mapping: `seg1-start` = skeleton commit, `segN-done` = the step commit, `segN+1-start` = `segN-done`,
  `workshop-v1` = final `main`.
- Cursor: project permissions file for the **CLI** only (`.cursor/cli.json`); the IDE allowlist file is not
  verified. Same-name skill de-duplication between `.claude/skills` and `.cursor/skills` is undocumented.
- Structure comparator, class A, compares tree **shape** (paths, types and titles in order), not offsets:
  offsets belong to a document version, so they differ between editions even when nothing changed.
- The seg1 retriever computes hashed n-gram TF-IDF cosine at query time. This deviates from the brief's
  "pre-computed vectors": nothing neural is stored, so nothing can be mistaken for a measured embedding result.
- The batch gate's `rejected` path is pure and unit-tested only. No `BatchRejected` event type exists, so the app
  never emits one; until the seg5 `eval` module supplies a probe, the app refuses (exit 2) to compare when the
  golden set holds 10 or more expected items.
- A golden claim item takes the human's reviewed span if there is one, else the claim's first-proposal span.
- Default `eval` golden cut-off: the sequence number after seg2's last review (seq 15), i.e. before the second
  edition is ingested.
- `ProposalRec` (the fold) keeps `valueText`, `quote` and `spans` of every `ClaimProposed` event: the claim aggregate
  keeps only the first proposal's span, but extractor versions share a claim id while their spans differ.
- `projections-drop` stores the hash it dropped in `state/projection-dropped.json` (from the file if one existed,
  else computed from the log and labelled so); `projections-build` compares against it. `reset` removes both.
- `log-cat --chain superseded` follows `causationId` back from the first `ClaimSuperseded` event.
- `replay --extractor X` replays recorded responses for Article 12 of every ingested document; it needs a verified
  structure and a recording for each document, otherwise it fails loudly (exit 2).
