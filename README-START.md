# repo — starting folder

"Documents Are Not Knowledge" · Codemotion Milan 2026 · Luca Bianchi. The starting point of the repository: everything the build needs, nothing to generate by hand.

| Path | What it is |
| --- | --- |
| `AGENTS.md` | Agent-neutral instructions for the coding agent: constraints, layout, fixtures, scripts, acceptance, display ids, phases and tags |
| `CLAUDE.md` | One line that imports `AGENTS.md`, so Claude Code loads it automatically |
| `workshop/en/00-running-example.md` | Single source of truth for every value, span, date, label and script name |
| `workshop/en/03-walkthrough-script.md` | Every live step with its expected output |
| `workshop/en/04-domain-model-reference.md`, `05-harness-design.md` | Domain model, event catalogue, lifecycle, harness specification, TypeScript types |
| `workshop/en/01, 02, 06, 07` | Run sheet, slide outline, Q&A + checklist, handout (not needed by the build) |
| `workshop/it/` | Italian translations of the documents in `workshop/en/` (all except 02b and 02c), same file names; not needed by the build |
| `fixtures/documents/` | art. 2477 c.c., Normattiva versions 7/8/9, `manifest.json`, `compliance-register.csv` |
| `fallback/segN/*.txt` | Expected outputs of every live step: acceptance target for the build and safety net on stage (`cat`) |

The build prompts are in `../__project/PROMPTS.md` (not part of the repository); start at step 0, or at step 1b for the existing clone.
