// npm run tags [-- --dry-run]
// Creates ANNOTATED tags on the linear history of main (see src/domain/tagPlan.ts for the mapping).
// Never moves or deletes a tag: if a tag exists at another commit this fails (exit 2).
import { repoRoot } from '../src/adapters/paths';
import { Rejection } from '../src/app/errors';
import { planTags } from '../src/domain/tagPlan';
import { emit, parseArgs, run } from './lib/cli';
import { git, tryGit } from './lib/git';

const args = parseArgs(process.argv.slice(2), ['text', 'dry-run']);
void run(() => {
  const branch = git(repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') throw new Rejection(`tags are made from main (current: ${branch})`);
  const merges = git(repoRoot, 'rev-list', '--merges', 'main');
  if (merges) throw new Rejection('history of main is not linear (merge commits found)');
  const log = git(repoRoot, 'log', 'main', '--reverse', '--format=%H%x09%s');
  const commits = log.split('\n').filter(Boolean).map((l) => { const [sha, ...rest] = l.split('\t'); return { sha: sha!, subject: rest.join('\t') }; });
  const plan = planTags(commits, git(repoRoot, 'rev-parse', 'HEAD'));
  const result: { name: string; sha: string; status: 'created' | 'exists' | 'planned' }[] = [];
  for (const t of plan) {
    const existing = tryGit(repoRoot, 'rev-parse', '--verify', '--quiet', `refs/tags/${t.name}^{commit}`);
    if (existing && existing !== t.sha) throw new Rejection(`tag ${t.name} already points at ${existing.slice(0, 7)}, not ${t.sha.slice(0, 7)}; tags are never moved`);
    if (existing) { result.push({ name: t.name, sha: t.sha, status: 'exists' }); continue; }
    if (args.flags['dry-run']) { result.push({ name: t.name, sha: t.sha, status: 'planned' }); continue; }
    git(repoRoot, 'tag', '-a', t.name, t.sha, '-m', t.message);
    result.push({ name: t.name, sha: t.sha, status: 'created' });
  }
  emit('tags', { tags: result }, result.map((r) => `${r.status.padEnd(8)} ${r.name.padEnd(12)} ${r.sha.slice(0, 7)}`).join('\n') || 'no step commits yet', args);
});
