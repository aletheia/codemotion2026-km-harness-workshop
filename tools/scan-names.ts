// npm run scan-names
// Scans (1) every tracked or untracked-not-ignored file, (2) the full patch history (git log -p --all),
// (3) tag annotations. Exit 2 and ONE line when anything matches. The patterns are in
// src/domain/bannedNames.ts (built from fragments, so this scan does not flag itself).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../src/adapters/paths';
import { Rejection } from '../src/app/errors';
import { bannedPatterns, scanText } from '../src/domain/bannedNames';
import { emit, parseArgs, run } from './lib/cli';
import { git, tryGit } from './lib/git';

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const patterns = bannedPatterns((process.env.HARNESS_BANNED_EXTRA ?? '').split(','));
  const hits: string[] = [];
  const files = git(repoRoot, 'ls-files', '-co', '--exclude-standard').split('\n').filter(Boolean);
  for (const f of files) {
    let text: string;
    try { text = readFileSync(join(repoRoot, f), 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    for (const h of scanText(text, patterns)) hits.push(`file ${f}:${h.line} [${h.label}]`);
  }
  const hasCommits = tryGit(repoRoot, 'rev-parse', '--verify', '--quiet', 'HEAD') !== undefined;
  let historyChars = 0;
  if (hasCommits) {
    const history = git(repoRoot, 'log', '-p', '--all', '--format=commit %H%n%an <%ae>%n%s%n%b');
    historyChars = history.length;
    for (const h of scanText(history, patterns)) hits.push(`history line ${h.line} [${h.label}]`);
    const tagMsgs = tryGit(repoRoot, 'for-each-ref', 'refs/tags', '--format=%(refname) %(contents)') ?? '';
    for (const h of scanText(tagMsgs, patterns)) hits.push(`tag annotation line ${h.line} [${h.label}]`);
  }
  if (hits.length) throw new Rejection(`banned name or phrase found (${hits.length}): ${hits.slice(0, 5).join('; ')}`);
  emit('scan-names', { clean: true, filesScanned: files.length, historyChars, scannedHistory: hasCommits }, `clean: ${files.length} files${hasCommits ? ` and ${historyChars} chars of patch history` : ' (no commits yet)'}`, args);
});
