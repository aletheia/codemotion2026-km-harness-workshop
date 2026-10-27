// npm run beliefs (now) | beliefs:at-2019-04-30 (--at: valid time) | beliefs -- --seq <n> (transaction time).
import { config } from '../config';
import { claimLabels } from '../events/lookup';
import { readLog } from '../events/log';
import { build, type Belief } from '../harness/beliefs/currentBeliefs';
import { beliefsAtDate, beliefsAtSeq } from '../projections/beliefsAt';
import { catalogueRank } from '../projections/currentBeliefs';
import { formatBeliefRows } from './beliefs-format';
import { argValue, run } from './cli';
import { displayEventId } from './tail-format';

await run('beliefs', () => {
  const argv = process.argv.slice(2);
  const lineage = argValue(argv, 'lineage') ?? config.source.lineageId;
  const at = argValue(argv, 'at');
  const seq = argValue(argv, 'seq');
  const events = readLog(config.paths.log);
  const seqOf = new Map(events.map((e) => [e.eventId, e.seq] as const));
  const labels = claimLabels(events);
  const label = (id: string) => labels.get(id) ?? id.slice(0, 8);

  if (at) {
    // Valid time: the claims of the version in force on the date, with their period and what became of them.
    const rows = beliefsAtDate(events, lineage, at).map(({ record: r, validity: v }) => {
      const fate = !r.superseded ? ''
        : `  (${r.superseded.reason === 'reconfirmation-chain' ? 'reconfirmed' : 'superseded'} by ${label(r.superseded.successor)} at ${displayEventId(r.superseded.seq)})`;
      return {
        subjectKey: r.subjectKey, value: r.value, label: r.label, actor: r.verified!.actor, ev: displayEventId(r.verified!.seq),
        rest: `in force ${v.from} → ${v.to ?? ''}`.trimEnd() + fate,
      };
    });
    process.stdout.write([`beliefs  lineage=${lineage}  as-of=${at}  (valid time: document version in force on the date)`, ...formatBeliefRows(rows)].join('\n') + '\n');
    return;
  }

  // Now, or transaction time: CurrentBeliefs over the whole log or over the prefix up to --seq.
  const upTo = seq === undefined ? undefined : Number(seq);
  const beliefs: Belief[] = [...(upTo === undefined ? build(events) : beliefsAtSeq(events, upTo)).values()]
    .filter((b) => b.lineageId === lineage)
    .sort((a, b) => catalogueRank(a.subjectKey) - catalogueRank(b.subjectKey));
  const header = upTo === undefined
    ? `beliefs  lineage=${lineage}  as-of=now`
    : `beliefs  lineage=${lineage}  as-of=seq ${upTo}  (transaction time: log folded up to ${displayEventId(upTo)})`;
  const rows = beliefs.map((b) => ({
    subjectKey: b.subjectKey, value: b.value, label: b.label ?? b.claimId.slice(0, 8),
    actor: `${b.verifiedBy}(${b.verifierId})`, ev: displayEventId(seqOf.get(b.verifiedEventId)!),
    // The root only when it is not the verifier itself (a harness reconfirmation rooted in a human).
    rest: b.verifiedBy === b.root.kind ? '' : `root: ${b.root.kind}`,
  }));
  process.stdout.write([header, ...formatBeliefRows(rows)].join('\n') + '\n');
});
