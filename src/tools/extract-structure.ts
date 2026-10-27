// npm run extract:structure-v8 — the structure extractor on an ingested version; appends StructureProposed.
import { config } from '../config';
import { sourceToStructure } from '../acl/sourceToStructure';
import { extractStructure, STRUCTURE } from '../agents/structure';
import { deriveEventId } from '../events/eventId';
import { append, readLog } from '../events/log';
import { ingestedVersion, treeIdOf } from '../events/lookup';
import { argValue, run } from './cli';

interface Node { path: string; type: string; start: number; end: number }

/** "8 nodes · [0,1990) · no overlaps · types: index×1, comma×6, note×1" (types in order of first appearance). */
export function describeTree(nodes: readonly Node[]): string {
  const sorted = [...nodes].sort((a, b) => a.start - b.start);
  const overlaps = sorted.some((n, i) => i > 0 && n.start < sorted[i - 1]!.end);
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  const types = [...counts].map(([t, c]) => `${t}×${c}`).join(', ');
  const span = `[${sorted[0]!.start},${Math.max(...nodes.map((n) => n.end))})`;
  return `${nodes.length} nodes · ${span} · ${overlaps ? 'OVERLAPS' : 'no overlaps'} · types: ${types}`;
}

/** "header [0,328) · c1 [330,606) · abrogato(note) [608,718) · …" */
export const listNodes = (nodes: readonly Node[]): string =>
  nodes.map((n) => `${n.path}${n.type === 'note' ? '(note)' : ''} [${n.start},${n.end})`).join(' · ');

export function extractStructureStep(version: string, path: string = config.paths.log) {
  const documentId = config.source.lineageId;
  const ingested = ingestedVersion(readLog(path), documentId, version);
  if (!ingested) throw new Error(`${documentId}@${version} not ingested (npm run ingest:${version})`);

  const input = sourceToStructure(ingested);
  const fixture = extractStructure(input);
  const nodes = fixture.response.nodes;
  const treeId = treeIdOf(version);
  const extractorVersion = `${STRUCTURE.extractor}@${fixture.version}`;

  const result = append(path, {
    eventId: deriveEventId({
      producer: `agent:${STRUCTURE.actorId}`, inputArtifactId: ingested.eventId, extractorVersion,
      eventType: 'StructureProposed', aggregateId: treeId,
    }),
    type: 'StructureProposed',
    layer: 'structure',
    aggregateId: treeId,
    actor: { kind: 'agent', id: STRUCTURE.actorId, modelId: fixture.modelId, promptVersion: fixture.promptVersion, extractorVersion },
    causationId: ingested.eventId,
    correlationId: `run-${version}-structure-01`,
    payload: { treeId, documentId, version, nodes },
  });
  return { ingested, nodes, treeId, extractorVersion, result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run('extract-structure', () => {
    const version = argValue(process.argv.slice(2), 'version') ?? 'v8';
    const { ingested, nodes, extractorVersion } = extractStructureStep(version);
    process.stdout.write([
      `extract  layer=structure  extractor=${extractorVersion}  input=${ingested.aggregateId}  (fixture replay)`,
      `tree: ${describeTree(nodes)}`,
      `  ${listNodes(nodes)}`,
    ].join('\n') + '\n');
  });
}
