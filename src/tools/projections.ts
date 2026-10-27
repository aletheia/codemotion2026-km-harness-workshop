// npm run projections:drop | projections:build | projections:diff — the projections of out/projections/.
//   drop    removes every projection file; nothing is lost, the log is the only state
//   build   folds the whole log, writes the files, prints CurrentBeliefs with the hash of its file and the
//           size of the two queues; drop + build gives the same hash
//   diff    candidate extractor (proposals folded as if verified) vs promoted, per document version
import { config } from '../config';
import { tableValue } from '../catalog/normalizer';
import { claimLabels } from '../events/lookup';
import { readLog } from '../events/log';
import { extractorDiff } from '../projections/extractorDiff';
import { buildAll, dropAll, projectionHash, writeAll } from '../projections/store';
import { currentBeliefs } from '../projections/currentBeliefs';
import { conflictQueue } from '../projections/conflictQueue';
import { reviewQueue } from '../projections/reviewQueue';
import { formatBeliefRows } from './beliefs-format';
import { argValue, run } from './cli';
import { displayEventId } from './tail-format';

const [command] = process.argv.slice(2);
const argv = process.argv.slice(3);

function drop(): string[] {
  return [`projections-drop   removed: ${dropAll().join(', ')}`];
}

function build(): string[] {
  const started = performance.now();
  const events = readLog(config.paths.log);
  const built = buildAll(events);
  writeAll(built);
  // Under the fixed clock the duration is a constant, so two runs print the same bytes (AGENTS.md §1.4).
  const ms = process.env.DNK_CLOCK === 'real' ? Math.round(performance.now() - started) : config.clock.projectionsBuildMs;

  const seqOf = new Map(events.map((e) => [e.eventId, e.seq] as const));
  const ev = (eventId: string) => displayEventId(seqOf.get(eventId)!);
  const labels = claimLabels(events);
  const out = [`projections-build  folded ${events.length} events in ${ms} ms`];
  for (const [lineage, beliefs] of Object.entries(currentBeliefs(events))) {
    out.push(`CurrentBeliefs (${lineage})`.padEnd(65) + `hash ${projectionHash(built.files.CurrentBeliefs)}`);
    out.push(...formatBeliefRows(beliefs.map((b) => ({
      subjectKey: b.subjectKey, value: b.value, label: b.label ?? b.claimId.slice(0, 8),
      actor: `${b.verifiedBy}(${b.verifierId})`, ev: ev(b.verifiedEventId),
      // The root, and when the chain passes through another claim, which one and where it was verified.
      rest: `root: ${b.root.kind}` + (b.root.claimId === b.claimId ? '' : ` (${labels.get(b.root.claimId) ?? b.root.claimId.slice(0, 8)}, ${ev(b.root.eventId)})`),
    }))));
  }
  const review = reviewQueue(events);
  const items = review.map((r) => r.label + (r.unexpected ? ' [UNEXPECTED]' : '')).join(', ');
  out.push(`ConflictQueue  ${conflictQueue(events).length} open`.padEnd(27) + `ReviewQueue  ${review.length} proposed` + (items ? ` (${items})` : ''));
  return out;
}

function diff(): string[] {
  const events = readLog(config.paths.log);
  const lineage = argValue(argv, 'lineage') ?? config.source.lineageId;
  const candidate = argValue(argv, 'candidate') ?? 'claims@v2';
  const { promoted, rows } = extractorDiff(events, lineage, candidate);
  const tag = (v: string) => v.split('@')[1] ?? v;
  return [
    `projections-diff  promoted=${promoted}  candidate=${candidate}  lineage=${lineage}  per document version  ` +
      `(candidate = ${tag(candidate)} proposals folded as if verified; not a belief)`,
    'version'.padEnd(9) + 'subject'.padEnd(23) + `promoted (${tag(promoted)}, verified)`.padEnd(29) + `candidate (${tag(candidate)}, proposed)`.padEnd(29) + 'status',
    ...rows.map((r) => {
      const p = r.promoted ? tableValue(r.promoted.value) + (r.promoted.superseded ? ' (superseded)' : '') : r.promotedProposed ? '— (proposed)' : '—';
      const c = r.candidate ? tableValue(r.candidate.value) : '—';
      const status = r.status + (r.notInUnit ? ` (not in unit ${r.notInUnit})` : '');
      return r.version.padEnd(9) + r.subjectKey.padEnd(23) + p.padEnd(29) + c.padEnd(29) + status;
    }),
  ];
}

await run(`projections-${command ?? '?'}`, () => {
  const commands: Record<string, () => string[]> = { drop, build, diff };
  const f = commands[command ?? ''];
  if (!f) throw new Error(`usage: projections.ts drop | build | diff [--candidate claims@v2]`);
  process.stdout.write(f().join('\n') + '\n');
});
