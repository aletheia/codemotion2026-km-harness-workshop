// One-off, deterministic generator for the fixtures. Run: npm run fixtures
// Output is committed; test/fixtures-generated.test.ts fails if the committed files drift.
// The documents are synthetic text written for this workshop; they are not a real policy.
import { writeTextFile } from '../src/adapters/files';
import { buildFixtures } from '../src/fixtures-gen/build';
import { repoPath } from '../src/adapters/paths';

for (const [rel, content] of Object.entries(buildFixtures())) writeTextFile(repoPath(rel), content);
console.log(JSON.stringify({ ok: true, command: 'fixtures' }));
