// npm run review (guided) / npm run review:auto (applies the pending stage without waiting, prints nothing).
import { reviewAuto, reviewInteractive } from '../processes/review';
import { hasFlag, run } from './cli';

await run('review', async () => {
  const stage = hasFlag(process.argv.slice(2), 'auto') ? reviewAuto() : await reviewInteractive();
  if (stage === undefined) process.stderr.write('review: nothing pending\n');
});
