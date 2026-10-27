// Pure. Words and phrases that must not appear anywhere in this repo, its history or its tags.
// They are assembled from fragments so that this file does not itself contain the literals (and the
// scan stays green on its own source). Extra names can be passed with the HARNESS_BANNED_EXTRA
// environment variable (comma-separated) for a one-off check against client names.
const j = (...p: string[]): string => p.join('');
const sep = '[\\s_-]*';

export function bannedPatterns(extra: string[] = []): { label: string; re: RegExp }[] {
  const names: [string, string][] = [
    ['company-1', `\\b${j('Rad', 'ixia')}\\b`],
    ['company-2', `\\b${j('Del', 'ta')}${sep}${j('K', 'ai')}\\b`],
    ['company-3', `\\b${j('ME', 'SA')}\\b`],
    ['company-4', `\\b${j('LI', 'DIA')}\\b`],
    ['company-5', `\\b${j('Neo', 'sperience')}\\b`],
    ['phrase-1', j('order of ', 'magnitude cheaper')],
    ['phrase-2', j('in practice ', 'no owner')],
    ['flag-1', j('dangerously', '-skip-', 'permissions')],
  ];
  for (const e of extra.map((s) => s.trim()).filter(Boolean)) names.push(['extra', `\\b${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`]);
  return names.map(([label, src]) => ({ label, re: new RegExp(src, 'i') }));
}

export interface Hit { label: string; line: number; excerpt: string }

export function scanText(text: string, patterns = bannedPatterns()): Hit[] {
  const hits: Hit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (p.re.test(lines[i]!)) hits.push({ label: p.label, line: i + 1, excerpt: lines[i]!.trim().slice(0, 80) });
    }
  }
  return hits;
}
