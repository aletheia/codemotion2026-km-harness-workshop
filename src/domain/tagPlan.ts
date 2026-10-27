// Pure: which commit gets which tag. The history on main is linear, one commit per step, and every step
// commit has the subject "step: skeleton" or "step: segN ...".
//   skeleton      -> seg1-start
//   segN          -> segN-done, and seg(N+1)-start (the same commit)
//   HEAD of main  -> workshop-v1, but only once step seg6 exists (the final state)
export interface Commit { sha: string; subject: string }
export interface PlannedTag { name: string; sha: string; message: string }

const STEP = /^step: (skeleton|seg([1-6]))(\b|$)/;
export const FINAL_TAG = 'workshop-v1';

export function planTags(commitsOldestFirst: Commit[], headSha: string): PlannedTag[] {
  const out: PlannedTag[] = [];
  const seen = new Set<string>();
  for (const c of commitsOldestFirst) {
    const m = STEP.exec(c.subject);
    if (!m) continue;
    const key = m[1]!;
    if (seen.has(key)) throw new Error(`two commits claim step "${key}"`);
    seen.add(key);
    if (key === 'skeleton') {
      out.push({ name: 'seg1-start', sha: c.sha, message: 'Start of segment 1 = the verified skeleton (nothing of segment 1 exists yet).' });
      continue;
    }
    const n = Number(m[2]);
    out.push({ name: `seg${n}-done`, sha: c.sha, message: `Segment ${n} done: tools and tests of segments 1..${n} are in place.` });
    if (n < 6) out.push({ name: `seg${n + 1}-start`, sha: c.sha, message: `Start of segment ${n + 1} = the end of segment ${n}.` });
  }
  if (seen.has('seg6')) out.push({ name: FINAL_TAG, sha: headSha, message: 'Final state of the workshop repo (version 1).' });
  return out;
}
