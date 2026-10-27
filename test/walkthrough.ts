// The walkthrough log up to the end of a segment, built on a temp log with the same steps the npm scripts run.
import { compareBatch, reconfirmStructure } from '../src/processes/compare';
import { reviewAuto } from '../src/processes/review';
import { extractClaimsStep } from '../src/tools/extract-claims';
import { extractStructureStep } from '../src/tools/extract-structure';
import { ingestStep } from '../src/tools/ingest';
import { logInit } from '../src/tools/log-init';
import { tmpLog } from './helpers';

/** seq 1–35: segment 2 (v8 c2, two review stages) and segment 3 (v9, compare, conflict resolution). */
export function segment3Log(path: string = tmpLog()): string {
  logInit(path);
  ingestStep('v8', path);
  extractStructureStep('v8', path);
  reviewAuto(path);
  extractClaimsStep('v8', ['c2'], { path });
  reviewAuto(path);
  ingestStep('v9', path);
  extractStructureStep('v9', path);
  reconfirmStructure(path, 'tree-v9');
  extractClaimsStep('v9', ['c2', 'c3', 'c5'], { path });
  compareBatch(path);
  reviewAuto(path);
  return path;
}
