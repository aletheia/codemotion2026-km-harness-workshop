// Filesystem locations. HARNESS_EVENTS_DIR / HARNESS_PROJECTIONS_DIR exist only so tests and the
// dry-run can work in a temp directory without touching the real demo state.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repoPath = (...p: string[]): string => join(repoRoot, ...p);
export const eventsDir = (): string => resolve(process.env.HARNESS_EVENTS_DIR ?? repoPath('events'));
export const eventsFile = (): string => join(eventsDir(), 'events.jsonl');
export const projectionsDir = (): string => resolve(process.env.HARNESS_PROJECTIONS_DIR ?? repoPath('projections'));
export const stateDir = (): string => resolve(process.env.HARNESS_STATE_DIR ?? repoPath('state'));
