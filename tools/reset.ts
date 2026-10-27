// npm run reset - return the demo to a clean state: delete the event log and derived state.
// Deliberately NOT pre-granted to the agent in .claude/settings.json: the presenter runs it.
import { resetLog } from '../src/adapters/eventLog';
import { removeFile } from '../src/adapters/files';
import { projectionsDir, stateDir } from '../src/adapters/paths';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { emit, parseArgs, run } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const hadLog = resetLog();
  const removed: string[] = [];
  for (const dir of [projectionsDir(), stateDir()]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name === '.gitkeep') continue;
      const p = join(dir, name);
      if (statSync(p).isFile()) { removeFile(p); removed.push(name); }
    }
  }
  emit('reset', { eventLogRemoved: hadLog, derivedFilesRemoved: removed }, `reset: event log ${hadLog ? 'deleted' : 'was already empty'}; ${removed.length} derived file(s) removed`, args);
});
