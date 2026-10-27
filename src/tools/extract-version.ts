// npm run extract:v9 — a new version end to end up to the proposals: structure extractor (fixture replay)
// → harness structure class A against the verified tree of the lineage → ACL structure→claims on the
// chosen commi → claims extractor (the promoted version). The comparator is a separate step (npm run compare).
import { config } from '../config';
import { reconfirmStructure } from '../processes/compare';
import { readLog } from '../events/log';
import { verifiedTree } from '../events/lookup';
import { argValue, run } from './cli';
import { extractClaimsStep } from './extract-claims';
import { describeTree, extractStructureStep } from './extract-structure';
import { displayEventId } from './tail-format';

await run('extract', () => {
  const argv = process.argv.slice(2);
  const version = argValue(argv, 'version') ?? 'v9';
  const sections = (argValue(argv, 'section') ?? 'c2').split(',');
  const path = config.paths.log;
  const out: string[] = [];
  // Re-reads the log on each call: the event to show may have been appended by the step just run.
  const seqOf = (eventId: string) => displayEventId(readLog(path).find((e) => e.eventId === eventId)!.seq);

  const { ingested, nodes, treeId, extractorVersion } = extractStructureStep(version, path);
  out.push(`extract  layer=structure  extractor=${extractorVersion}  input=${ingested.aggregateId}  (fixture replay)`);

  // Structure class A must happen before the claims step: the ACL accepts only a verified tree.
  const s = reconfirmStructure(path, treeId);
  const span = `[${Math.min(...nodes.map((n) => n.start))},${Math.max(...nodes.map((n) => n.end))})`;
  const gate = s.gate.kind === 'not-applicable'
    ? `gate not applicable (structure golden set ${s.goldenItems} item${s.goldenItems === 1 ? '' : 's'})`
    : `gate ${s.gate.kind}`;
  // No reconfirmation: stop here; the tree goes to the reviewer and claims wait for its verification.
  if (!s.reconfirmed) {
    out.push(`tree: ${describeTree(nodes)}`, `harness: structure class B — no verified tree with the same paths and types; ${gate} → npm run review`);
    process.stdout.write(out.join('\n') + '\n');
    return;
  }
  out.push(
    `tree: ${nodes.length} nodes · ${span} · identical paths and types to ${s.reconfirmed.treeId}`,
    `harness: structure class A — ${treeId} reconfirms ${s.reconfirmed.treeId} (${seqOf(s.reconfirmed.verifiedEvent.eventId)}); ${gate} → StructureVerified(actor=harness)`,
  );

  // The promoted extractor version, on the chosen commi only (c2,c3,c5 for v9); proposals are not compared yet.
  const step = extractClaimsStep(version, sections, { path });
  const verified = verifiedTree(readLog(path), treeId)!;
  const bases = step.units.map((u) => `${u.path} base ${u.baseOffset}`).join(' · ');
  out.push(
    `acl structure→claims: ${step.units.length} units  (${bases})  causation ${seqOf(verified.eventId)}`,
    `extract  layer=claims  extractor=${step.extractorVersion}${step.promoted ? ' (promoted)' : ''}  units=${step.units.length}  (fixture replay)`,
    `proposals: ${step.results.length}  — comparator NOT run (npm run compare)`,
  );
  process.stdout.write(out.join('\n') + '\n');
});
