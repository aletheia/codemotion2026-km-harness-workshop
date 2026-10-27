// npm run log:reset — removes out/ (log, projections, dry-run outputs). Pre-talk only.
import { rmSync } from 'node:fs';
import { config } from '../config';
import { run } from './cli';

await run('log-reset', () => {
  rmSync(config.paths.outDir, { recursive: true, force: true });
  process.stdout.write(`log-reset  ${config.paths.outDir}/ removed\n`);
});
