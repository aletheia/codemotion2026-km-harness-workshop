# dnk-workshop — starting folder

"Documents Are Not Knowledge" · Codemotion Milan 2026 · Luca Bianchi. The starting point of the repository: everything the build needs, nothing to generate by hand.

| Path | What it is |
| --- | --- |
| `PROMPTS.md` | The step-by-step build: shell commands, the six Claude Code prompts (phases A–F), the verification after each |
| `CLAUDE.md` | Instructions Claude Code loads automatically: constraints, layout, fixtures, scripts, acceptance, display ids, phases |
| `workshop/00-running-example.md` | Single source of truth for every value, span, date, label and script name |
| `workshop/03-walkthrough-script.md` | Every live step with its expected output |
| `workshop/04-domain-model-reference.md`, `05-harness-design.md` | Domain model, event catalogue, lifecycle, harness specification, TypeScript types |
| `workshop/01, 02, 06, 07` (+ `it/`) | Run sheet, slide outline, Q&A + checklist, handout (not needed by the build) |
| `fixtures/documents/` | art. 2477 c.c., Normattiva versions 7/8/9, `manifest.json`, `compliance-register.csv` |
| `fallback/segN/*.txt` | Expected outputs of every live step: acceptance target for the build and safety net on stage (`cat`) |

Start with `PROMPTS.md`, step 0.
