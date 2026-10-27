// npm run doctor - checks Node version, installed dependencies and required files.
// Exits 0 and prints {"ok":true,...} when everything is in place, else exit 1 with one line.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { repoPath, repoRoot } from '../src/adapters/paths';
import { diffs } from './lib/agentFiles';
import { emit, fail, parseArgs } from './lib/cli';

const args = parseArgs(process.argv.slice(2), ['text']);
const pkg = JSON.parse(readFileSync(repoPath('package.json'), 'utf8')) as { engines: { node: string }; devDependencies: Record<string, string> };
const problems: string[] = [];

// Node: engines range is ">=A.B.C <D"; check against the same bounds.
const m = /^>=(\d+)\.(\d+)\.(\d+)\s+<(\d+)$/.exec(pkg.engines.node);
const [maj, min, pat] = process.versions.node.split('.').map(Number) as [number, number, number];
if (m) {
  const lo = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  const below = maj < lo[0] || (maj === lo[0] && (min < lo[1] || (min === lo[1] && pat < lo[2])));
  if (below || maj >= Number(m[4])) problems.push(`node ${process.version} is outside engines "${pkg.engines.node}" (see .nvmrc)`);
} else problems.push(`cannot parse engines.node "${pkg.engines.node}"`);

const req = createRequire(import.meta.url);
for (const dep of Object.keys(pkg.devDependencies)) {
  try { req.resolve(`${dep}/package.json`); } catch { try { req.resolve(dep); } catch { problems.push(`dependency ${dep} is not installed (run: npm ci)`); } }
}

const required = [
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'DECISIONS.md', 'LICENSE', '.nvmrc', 'package-lock.json',
  '.claude/settings.json', 'agent/skills', 'agent/agents', '.claude/skills', '.claude/agents',
  'fixtures/documents/manifest.json', 'fixtures/llm/structure@v1.json', 'fixtures/llm/claims@v1.json', 'fixtures/review-script.json',
  'events/.gitkeep',
];
for (const r of required) if (!existsSync(repoPath(r))) problems.push(`missing ${r}`);

if (existsSync(repoPath('agent', 'targets.json'))) {
  const d = diffs(repoRoot);
  if (d.length) problems.push(`generated agent files out of date (${d.length}); run: npm run sync`);
}

if (problems.length) fail(`doctor: ${problems.join('; ')}`, 1);
emit('doctor', { node: process.version, engines: pkg.engines.node, checkedFiles: required.length, checkedDependencies: Object.keys(pkg.devDependencies).length },
  `doctor ok: node ${process.version}, ${Object.keys(pkg.devDependencies).length} dependencies, ${required.length} required files`, args);
