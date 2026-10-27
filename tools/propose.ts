// npm run propose -- --file claims.json
// Agent-facing write path. Provenance is checked inside the write path: a quote that is not verbatim
// in the cited span rejects the WHOLE batch (exit 2, nothing written).
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadFold } from '../src/app/context';
import { Rejection } from '../src/app/errors';
import { proposeClaims, unitFor } from '../src/app/propose';
import { agentActor } from '../src/app/actors';
import { emit, need, parseArgs, run } from './lib/cli';

const fileZ = z.object({
  unitId: z.string().regex(/^[^:]+:[^:]+$/, 'unitId must look like cp-2024:art12'),
  extractor: z.object({ version: z.string().regex(/^[a-z]+@v\d+$/), modelId: z.string(), promptVersion: z.string() }),
  claims: z.array(z.object({
    subjectKey: z.string(), valueText: z.string(), quote: z.string(),
    span: z.object({ start: z.number().int(), end: z.number().int() }),
  })).min(1),
});

const args = parseArgs(process.argv.slice(2), ['text']);
void run(() => {
  const path = need(args, 'file');
  let parsed;
  try {
    parsed = fileZ.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (e) {
    throw new Rejection(`cannot read ${path}: ${(e as Error).message}`);
  }
  if (!parsed.success) throw new Rejection(`bad input file: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const { unitId, extractor, claims } = parsed.data;
  const [documentId, section] = unitId.split(':') as [string, string];
  const unit = unitFor(loadFold(), documentId, section, { recordRejection: true });
  const res = proposeClaims(unit, agentActor(extractor.version, extractor.modelId, extractor.promptVersion), claims);
  emit('propose', { ...res }, res.proposed.map((p) => `${p.seq}  ${p.subjectKey} = ${p.valueText}  (${p.claimId.slice(0, 8)})${p.deduplicated ? ' [already in log]' : ''}`).join('\n'), args);
});
