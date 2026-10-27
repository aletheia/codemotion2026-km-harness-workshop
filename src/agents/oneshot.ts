// Segment 1 baseline extractor: one prompt, one opaque JSON blob for a whole comma, no spans, no subject keys.
import { z } from 'zod';
import { replay, type ExtractionUnit, type Fixture } from './replayer';

export const ONESHOT = { extractor: 'oneshot', version: 'v1' } as const;

/** The response is the model's text, kept verbatim: it is shown on screen as the model returned it. */
export function extractOneShot(unit: ExtractionUnit): Fixture<string> {
  return replay(ONESHOT.extractor, ONESHOT.version, unit, z.string());
}
