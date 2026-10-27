// npm run log:init — seq 1 LogInitialised, seq 2 the bootstrap ExtractorVersionPromoted(claims@v1) by human(luca).
import { config, occurredAt } from '../config';
import { deriveEventId } from '../events/eventId';
import { append, readLog, type AppendResult } from '../events/log';
import { run } from './cli';

export function logInit(path: string = config.paths.log): { created: boolean; results: AppendResult[] } {
  const created = readLog(path).length === 0;
  const correlationId = 'log-init';

  const initId = deriveEventId({
    producer: 'process:log-init', inputArtifactId: config.log.logId, extractorVersion: null,
    eventType: 'LogInitialised', aggregateId: 'log',
  });
  const init = append(path, {
    eventId: initId,
    type: 'LogInitialised',
    layer: 'source',
    aggregateId: 'log',
    actor: { kind: 'process', id: 'log-init' },
    correlationId,
    payload: { logId: config.log.logId, format: config.log.format, createdAt: occurredAt(1) },
  });

  const { extractor, version, reviewer, note } = config.bootstrap;
  const promoted = append(path, {
    eventId: deriveEventId({
      producer: `human:${reviewer}`, inputArtifactId: version, extractorVersion: null,
      eventType: 'ExtractorVersionPromoted', aggregateId: version,
    }),
    type: 'ExtractorVersionPromoted',
    layer: 'harness',
    aggregateId: version,
    actor: { kind: 'human', id: reviewer },
    correlationId,
    payload: { extractor, version, previous: null },
    evidence: { kind: 'bootstrap', note },
  });

  return { created, results: [init, promoted] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('log-init', () => {
    const { created, results } = logInit();
    const duplicates = results.filter((r) => r.duplicate).length;
    const path = config.paths.log;
    process.stdout.write(
      created
        ? `log-init  ${path} created  (append-only; duplicate eventId → ignored)\n`
        : `log-init  ${path} exists  (${duplicates} duplicate eventId ignored)\n`,
    );
  });
}
