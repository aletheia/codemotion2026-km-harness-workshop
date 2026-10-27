---
name: extract-claims
description: Extract deductible, coinsurance and limit claims from one section of a Casa Protetta policy and propose them to the event log with verbatim quotes. Use when asked to extract or propose claims from Article 12. Never verifies.
---

# Extract claims from one unit

Goal: turn the text of one section into `*Proposed` claims. You propose; a human or the harness decides.

1. Get the unit you are allowed to see:
   `npm run unit -- --doc <documentId> --section art12`
   If this fails with one line saying the structure is not verified, stop and report it. Do not work around it.
2. Read `unit.text`. For each statement of a deductible, coinsurance or limit, write one claim:
   - `subjectKey`: `<topic>.<attribute>` such as `fire.deductible`, `theft.coinsurance`, `liability.limit`
   - `valueText`: the value as written (`500 EUR`, `15%`)
   - `quote`: the exact characters from the text that state it
   - `span`: `{start,end}` of that quote, **relative to the unit text**, half-open
3. Write the file as JSON: `{"unitId", "extractor": {"version","modelId","promptVersion"}, "claims":[...]}`
   (the exact shape is printed by step 1 under `inputFormat`).
4. `npm run propose -- --file <file>`.
5. Exit code 2 and a one-line message mean a claim was rejected and nothing was written. Re-read the text,
   correct only what the text supports, and run again. Never loosen a quote to get past the check.

Never emit verification, contest or supersession. Never touch `events/`.
