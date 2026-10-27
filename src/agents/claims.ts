// Claims extractor: one comma in, proposals out. The model returns the subject key, the value as it reads
// in the text and a section-local span; normalization and anchoring belong to the Claims context.
import { z } from 'zod';
import { replay, type ExtractionUnit, type Fixture } from './replayer';

export const CLAIMS = { extractor: 'claims', actorId: 'claims-extractor' } as const;

const responseSchema = z.object({
  claims: z.array(z.object({
    subjectKey: z.string().min(1),
    value: z.string().min(1),
    span: z.object({ start: z.int().nonnegative(), end: z.int().nonnegative() }),
  })),
});

export type ClaimsResponse = z.infer<typeof responseSchema>;

/** extractorVersion: 'claims@v1', 'claims@v2'. */
export function extractClaims(unit: ExtractionUnit, extractorVersion: string): Fixture<ClaimsResponse> {
  const [extractor, version] = extractorVersion.split('@');
  if (extractor !== CLAIMS.extractor || !version) throw new Error(`not a claims extractor version: ${extractorVersion}`);
  return replay(CLAIMS.extractor, version, unit, responseSchema);
}
