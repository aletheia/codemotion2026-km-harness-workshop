// Placeholder for the npm scripts of later phases (CLAUDE.md §14).
const [name = '?', phase = '?'] = process.argv.slice(2);
process.stderr.write(`${name}: not implemented yet (phase ${phase})\n`);
process.exitCode = 1;
