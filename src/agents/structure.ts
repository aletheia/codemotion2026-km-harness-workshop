// Structure extractor: the whole text of a document version in, a section tree out (absolute offsets).
import { z } from 'zod';
import { replay, type Fixture } from './replayer';

export const STRUCTURE = { extractor: 'structure', version: 'v1', actorId: 'structure-extractor' } as const;

/** The whole document is one unit; its path is 'document'. */
export const DOCUMENT_PATH = 'document';

const responseSchema = z.object({
  nodes: z.array(z.object({
    path: z.string().min(1),
    type: z.enum(['comma', 'note', 'index']),
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
  })).min(1),
});

export type StructureResponse = z.infer<typeof responseSchema>;

export function extractStructure(input: { documentId: string; version: string; text: string }, version: string = STRUCTURE.version): Fixture<StructureResponse> {
  return replay(STRUCTURE.extractor, version, { ...input, path: DOCUMENT_PATH }, responseSchema);
}
