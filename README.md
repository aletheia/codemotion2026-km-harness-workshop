# codemotion-harness

A small, offline, event-sourced knowledge-extraction harness. The agent side is **only markdown plus
TypeScript tools** (`npm run <name>`); it runs the same way from Claude Code and from Cursor.

Domain: a synthetic home-insurance policy, "Casa Protetta", editions 2024 and 2025, Article 12
("Franchigie e scoperti"). No model is called: the "extractors" replay recordings in `fixtures/llm`
(`modelId: fixture-replay`), and a missing recording fails loudly. All numbers in `src/config.ts` are
illustrative, not benchmarks.

## Quick start

```bash
nvm use            # Node 20.19.x, pinned in .nvmrc and package.json "engines"
npm ci
npm run doctor     # Node version, installed deps, required files, generated agent files
npm test
npm run dry-run    # whole rehearsal in a temp directory, no model, ~10 s
```

Working on the steps: every step is a tag. Checking a tag out leaves you on a detached HEAD, so branch first:

`git switch -c mio-lavoro seg3-start`

## Steps and tags

History on `main` is linear, one commit per step. `npm run tags` creates **annotated** tags:

| Tag | Points at |
|---|---|
| `seg1-start` | the verified skeleton commit (`step: skeleton`) |
| `segN-done` | the commit that adds segment N (`step: segN ...`) |
| `segN+1-start` | the same commit as `segN-done` |
| `workshop-v1` | the final state of `main`, created only once `step: seg6` exists |

`npm run verify-tags` clones the repo once per tag into a temp directory, checks the tag out, and runs
`npm ci`, `npm run doctor`, `npm run typecheck`, `npm test`. The same script runs in CI
(`.github/workflows/verify-tags.yml`). Segments present in this checkout: see `git tag -l` and the table below.

## Commands (`make` → `npm run`)

| Command | Purpose |
|---|---|
| `npm run doctor` | Node version, deps, required files, generated copies in sync |
| `npm run reset` | clean demo state (empties `events/`, `projections/`); not pre-granted to the agent |
| `npm run seg1 -- <query\|delete\|extract\|index>` | segment 1: the retrieval baseline that loses identity, provenance and time (hashed n-gram TF-IDF scores, not a neural embedding) |
| `npm run seg2 -- <log-init\|ingest\|extract\|review\|show>` | segment 2: build the log by hand |
| `npm run seg3 -- <ingest\|extract\|compare\|review\|layers-4-6>` | segment 3: second edition, comparator classes A/B/C |
| `npm run seg4 -- <log-cat\|projections-drop\|projections-build\|projections-diff\|beliefs\|replay>` | segment 4: the log as source of truth |
| `npm run log-cat`, `npm run beliefs`, `npm run projections-drop`, `npm run projections-build`, `npm run projections-diff` | the same commands without the `seg4 --` prefix |
| `npm run seg5 -- <golden\|eval\|drift>` | segment 5: the golden set, per-item evaluation, drift between extractor versions |
| `npm run seg6 -- ask --q "franchigia incendio" [--as-of 2024-03-01]`, `npm run ask` | segment 6: an answer from the projection that cites the belief; `--as-of` is valid time; the consumption policy is applied to the root of the evidence chain |
| `npm run golden`, `npm run eval`, `npm run drift` | the same commands without the `seg5 --` prefix |
| `npm run replay -- --extractor claims@v2` | replay recorded responses of another extractor version: appends `ClaimProposed` only |
| `npm run compare` | the comparator on its own (same as `seg3 compare`) |
| `npm run unit -- --doc cp-2024` | the extraction unit the ACL hands to an extractor |
| `npm run propose -- --file f.json` | agent write path; provenance enforced inside; exit 2 on rejection |
| `npm run replay` | re-fold the log from scratch; prints a hash of CurrentBeliefs |
| `npm run tail` | last events |
| `npm run sync` | copy `agent/skills`, `agent/agents` to `.claude/` and `.cursor/` |
| `npm run fixtures` | regenerate `fixtures/` |
| `npm run dry-run` | rehearsal in a temp dir; `-- --write-fallback` rewrites `fallback/*/expected-output.txt` |
| `npm run tags`, `npm run verify-tags` | create / verify the annotated tags |
| `npm run scan-names` | banned-name scan over files, `git log -p --all` and tag messages |
| `npm test`, `npm run typecheck` | tests, types |

`make` targets of the original run sheet became `npm run <name>`; arguments go after `--`
(`make beliefs AT=2024-03-01` → `npm run beliefs -- --at 2024-03-01`). Output is one JSON object
(`{"ok":true,"command":...}`); `--text` prints a table. A failing command prints ONE line on stderr and exits
non-zero: 1 usage, 2 rejected by a rule, 3 log invalid.

## The three classes (batch comparator)

When a claim from a new edition meets the current belief for the same subject:

| Class | Situation | What happens |
|---|---|---|
| A | reconfirmation: same normalized value as the belief | the harness verifies it and supersedes the old claim |
| B | novelty: no belief for the subject | stays `proposed` for a human |
| C | conflict: a different value | `ClaimContested`; a human resolves it |

A subject that is not in the catalogue is reported as `UNEXPECTED`. Policies and workflow are always B or C.
Below the probe minimum (see `DECISIONS.md`, default 1) class A is decided by the comparator alone and the
class-A audit sampling is 100 %.

## Golden set (definition)

A golden set is **a query over the event log, not a file**: the decision events of one layer taken by a
human actor, up to a sequence number (`untilSeq`), excluding decisions made by the harness or imported, and
excluding prompt examples. It is always read with a cut-off, so that an evaluation can be re-run later with
the same items.

## Claude Code and Cursor

| What | Claude Code | Cursor | Status |
|---|---|---|---|
| Rules | `CLAUDE.md` → `@AGENTS.md` | reads `AGENTS.md` at the root | Claude: [memory docs](https://code.claude.com/docs/en/memory.md) (a `CLAUDE.md` makes Claude ignore a bare `AGENTS.md`, hence the import). Cursor: [rules docs](https://cursor.com/docs/rules) |
| Skills | `.claude/skills/<name>/SKILL.md` | `.cursor/skills/…` (also loads `.claude/skills`, `.agents/skills`, `.codex/skills`) | docs: [Cursor skills](https://cursor.com/docs/skills) |
| Subagents | `.claude/agents/*.md` | `.cursor/agents/*.md` (also loads `.claude/agents`, `.codex/agents`; `.cursor` wins) | docs: [Cursor subagents](https://cursor.com/docs/subagents) |
| Pre-granted commands | `.claude/settings.json` `permissions.allow` | CLI: `.cursor/cli.json` `permissions` (`Shell(npm)`, `Write(glob)`) | Cursor CLI: [permissions docs](https://cursor.com/docs/cli/reference/permissions). **Cursor IDE allowlist file: not verified.** |
| Deny writes to `events/` | `Edit(/events/**)` (covers all edit tools) | CLI: `Write(events/**)` | Claude: [permissions docs](https://code.claude.com/docs/en/permissions.md); Cursor CLI as above |
| Optional hook | `PreToolUse` `matcher: "Bash"`, exit 2 blocks | Cursor loads Claude-style hooks ([hooks docs](https://cursor.com/docs/hooks)) | **Not verified here in either product**; only the pure check is unit-tested |

Skills and subagents are written **once** in `agent/skills` and `agent/agents`; `npm run sync` copies them to
both locations (`agent/targets.json`) and a test fails if a copy differs from its source. Because Cursor also
reads `.claude/skills`, the same skill can be visible twice there; whether Cursor de-duplicates same-name
skills is **not documented**. If it bothers you, remove the `.cursor/...` entries from `agent/targets.json`
and run `npm run sync`.

`.claude/settings.json` project allow rules apply after the workspace-trust dialog is accepted; `claude -p`
does not use them. `Edit(...)` deny rules also cover shell redirections that Claude Code recognises, but not a
script that writes files itself. That is why the real guarantees are in code (next section).

## Guarantees live in code, not in prompts

- **Append-only**: exactly one function writes events (`append` in `src/adapters/eventLog.ts`); a test fails
  if any other module calls a filesystem write API or names the events location.
- **Provenance** (a quote must appear verbatim in the source and inside the cited span): checked inside the
  TypeScript write path (`src/app/commit.ts`), before anything is appended; a violation rejects the whole batch
  with exit 2. The Claude hook is an optional extra.
- **Agents propose, never decide**: `checkMayEmit` rejects any decision event from an agent actor.
- **Domain logic is pure**: `src/domain`, `events`, `projections`, `catalog`, `acl`, `agents`, `config` do
  no I/O; a test checks the import direction. Adapters and tools are thin.

## Layout

```
AGENTS.md  CLAUDE.md  DECISIONS.md  README.md  LICENSE
agent/skills  agent/agents  agent/targets.json      single source of skills and subagents
.claude/  .cursor/                                     settings + generated copies (do not edit copies)
src/domain  src/events  src/projections  ...           pure logic
src/adapters  src/app                                  I/O and use cases
tools/                                                 the npm run commands (one-liners calling tsx)
fixtures/documents  fixtures/llm                       synthetic policy editions, recorded responses
fallback/seg1..seg6                                    reserves for a live demo (see each README)
events/  projections/                                  runtime state (events.jsonl is append-only)
test/                                                  vitest
```

## What is verified, what is not

Verified by `npm test` and the clean-clone scripts: the domain rules, the CLI contract and exit codes, byte-identical
reruns, generated-copy equality, tag contents on a clean clone (Linux, Node 20.19.2).
**Not verified**: how an agent behaves inside Claude Code or Cursor (permission prompts, hook execution, skill
discovery), macOS and Windows, and any real model output.

## License

MIT, see `LICENSE`.
