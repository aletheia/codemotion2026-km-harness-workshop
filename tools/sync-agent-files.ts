// npm run sync [-- --check]
// Copies agent/skills and agent/agents to the .claude/ and .cursor/ locations (see agent/targets.json).
// --check changes nothing and exits 2 when a copy differs from its source.
import { repoRoot } from '../src/adapters/paths';
import { diffs, syncAll } from './lib/agentFiles';
import { emit, parseArgs, run } from './lib/cli';
import { Rejection } from '../src/app/errors';

const args = parseArgs(process.argv.slice(2), ['text', 'check']);
void run(() => {
  if (args.flags.check) {
    const d = diffs(repoRoot);
    if (d.length) throw new Rejection(`generated agent files out of date (${d.length}): ${d.map((x) => `${x.path} ${x.problem}`).join(', ')}; run: npm run sync`);
    emit('sync', { upToDate: true }, 'agent files up to date', args);
    return;
  }
  const r = syncAll(repoRoot);
  emit('sync', r, `sync: ${r.written.length} written, ${r.removed.length} removed`, args);
});
