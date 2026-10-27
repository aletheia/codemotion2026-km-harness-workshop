// npm run viewer [-- --port <n>] [-- --write] [-- --file <events.jsonl>] [-- --export <file.html>] [-- --env <file>] — a browser
// view of the log, the claims and the RAG chunks. --export writes one self-contained HTML snapshot of the log
// (opens with a double click, offline, no server) and exits. With ANTHROPIC_API_KEY set (environment, or a .env
// file: --env, the current directory, or the checkout that holds the log), the Explain panel asks Claude Haiku
// to tell the story of a log row; without it nothing leaves the machine. .env is excluded from git. Not part of the walkthrough: it re-reads the log on every request, so it follows
// the live run. Read-only: --write (set a claim's state from the Claims tab) arrives with ws-seg3, since it checks
// the one-belief-per-key invariant of the comparator's beliefs fold.
// Zero dependencies: node:http.
import { createServer, type IncomingMessage } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config } from '../config';
import { displayValue } from '../catalog/normalizer';
import type { ClaimState, NormalizedValue } from '../domain/claim';
import { readLog } from '../events/log';
import { isClaimEvent } from '../events/fold';
import type { ClaimEvent } from '../events/catalogue';
import { isTransitionError, transition } from '../domain/transition';
import { proposedTree } from '../events/lookup';
import { isDecision, type LogEvent } from '../events/schema';
import { chunkParagraphs } from '../rag-baseline/chunk';
import { argValue, hasFlag, run } from './cli';
import { displayActor, displayEventId, displayLabel, evidenceSummary, formatLog, rememberLabel } from './tail-format';

const sourceText = (version: string): string | undefined => {
  const file = join(config.rag.sourceDir, `${config.source.lineageId}-${version}.txt`);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

/** What an event points at in the source text: the version and the spans to light up, each with a label. */
interface Focus { readonly version: string; readonly spans: readonly { start: number; end: number; label: string }[] }

function focusOf(e: LogEvent, events: readonly LogEvent[], firstProposal: ReadonlyMap<string, Extract<LogEvent, { type: 'ClaimProposed' }>>): Focus | null {
  const claimId = e.layer === 'claims' ? (e.payload as { claimId?: string }).claimId : undefined;
  if (claimId) {
    const p = firstProposal.get(claimId)?.payload;
    const span = p?.spans[0];
    return p && span ? { version: span.version, spans: p.spans.filter((s) => s.version === span.version).map((s) => ({ start: s.start, end: s.end, label: p.label ?? p.subjectKey })) } : null;
  }
  const tree = e.type === 'StructureProposed' ? e : e.type === 'StructureVerified' ? proposedTree(events, e.payload.treeId) : undefined;
  if (tree) return { version: tree.payload.version, spans: tree.payload.nodes.map((n) => ({ start: n.start, end: n.end, label: `${n.path} (${n.type})` })) };
  if (e.type === 'DocumentVersionIngested') return { version: e.payload.version, spans: [] };
  return null;
}

function logView(events: readonly LogEvent[]) {
  const seqById = new Map(events.map((e) => [e.eventId, e.seq] as const));
  const firstProposal = new Map<string, Extract<LogEvent, { type: 'ClaimProposed' }>>();
  for (const e of events) if (e.type === 'ClaimProposed' && !firstProposal.has(e.payload.claimId)) firstProposal.set(e.payload.claimId, e);
  const labels = new Map<string, string>();
  for (const e of events) rememberLabel(labels, e);
  const lines = formatLog(events);
  return events.map((e, i) => ({
    seq: e.seq,
    id: displayEventId(e.seq),
    type: e.type,
    layer: e.layer,
    actor: displayActor(e.actor),
    actorKind: e.actor.kind,
    decision: isDecision(e),
    label: displayLabel(e, (id) => labels.get(id)),
    cause: e.causationId ? (seqById.has(e.causationId) ? displayEventId(seqById.get(e.causationId)!) : e.causationId.slice(0, 8)) : null,
    causeSeq: e.causationId ? seqById.get(e.causationId) ?? null : null,
    focus: focusOf(e, events, firstProposal),
    evidence: evidenceSummary(e) ?? null,
    tail: lines[i],
    raw: e,
  }));
}

/**
 * Claim states for display: transition() over every Claims event, never throwing, so the page still renders a
 * log the current domain code would refuse. A ClaimProposed on an existing claim keeps its state: the claim id
 * is the hash of what is claimed, so claims@v2 on replay re-proposes claims@v1's claims (the rule phase D adds
 * to transition()). Any other refused event is skipped and reported.
 */
function displayStates(events: readonly LogEvent[]): { states: Map<string, ClaimState>; warnings: string[] } {
  const states = new Map<string, ClaimState>();
  const warnings: string[] = [];
  for (const e of events) {
    if (!isClaimEvent(e)) continue;
    const ev = e as unknown as ClaimEvent;
    const id = ev.payload.claimId;
    const before = states.get(id) ?? null;
    if (ev.type === 'ClaimProposed' && before !== null) continue;
    const next = transition(before, ev);
    if (isTransitionError(next)) warnings.push(`${displayEventId(e.seq)}: ${next.reason}`);
    else states.set(id, next);
  }
  return { states, warnings };
}

function claimsView(events: readonly LogEvent[], states: ReadonlyMap<string, ClaimState>) {
  const history = new Map<string, string[]>();
  const successorOf = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'ClaimSuperseded') successorOf.set(e.payload.claimId, e.payload.successor);
    if (e.layer !== 'claims') continue;
    const claimId = (e.payload as { claimId?: string }).claimId;
    if (claimId) history.set(claimId, [...(history.get(claimId) ?? []), `${displayEventId(e.seq)} ${e.type}` + (e.type === 'ClaimProposed' ? ` (${displayActor(e.actor)})` : '')]);
  }
  // One row per claim, defined by its first proposal; later proposals of the same claim show in its history.
  const seen = new Set<string>();
  return events.flatMap((e) => {
    if (e.type !== 'ClaimProposed' || seen.has(e.payload.claimId)) return [];
    seen.add(e.payload.claimId);
    const p = e.payload;
    return [{
      claimId: p.claimId,
      label: p.label ?? `clm-${p.claimId.slice(0, 8)}`,
      lineageId: p.lineageId,
      subjectKey: p.subjectKey,
      value: displayValue(p.normalizedValue as NormalizedValue),
      state: states.get(p.claimId) ?? 'proposed',
      proposedBy: displayActor(e.actor),
      proposedAt: displayEventId(e.seq),
      sectionPath: p.sectionPath ?? null,
      spans: p.spans.map((s) => ({ ...s, text: sourceText(s.version)?.slice(s.start, s.end) ?? null })),
      history: history.get(p.claimId) ?? [],
      supersededBy: successorOf.get(p.claimId) ?? null,
    }];
  });
}

/** Paragraph chunks of the RAG baseline, with absolute offsets so the page can show which claims fall inside each. */
function chunksView(ragIndex: string) {
  const indexed = existsSync(ragIndex)
    ? new Set((JSON.parse(readFileSync(ragIndex, 'utf8')) as { chunks: { id: string }[] }).chunks.map((c) => c.id))
    : null;
  return config.rag.sourceFiles.flatMap((file) => {
    const text = readFileSync(join(config.rag.sourceDir, file), 'utf8');
    let cursor = 0;
    return chunkParagraphs(file, text).map((c) => {
      const start = text.indexOf(c.text, cursor);
      cursor = start + c.text.length;
      return { ...c, version: file.match(/-(v\d+)\.txt$/)?.[1] ?? '?', start, end: cursor, inIndex: indexed ? indexed.has(c.id) : null };
    });
  });
}

/** The RAG index sits next to the log (out/rag/index.json beside out/events.jsonl), so --file follows another checkout. */
const ragIndexBeside = (logPath: string): string => join(dirname(logPath), 'rag', 'index.json');

/** The source texts by version label, for the document panel. */
const documents = (): Record<string, string> =>
  Object.fromEntries(config.rag.sourceFiles.map((f) => [f.match(/-(v\d+)\.txt$/)![1]!, readFileSync(join(config.rag.sourceDir, f), 'utf8')]));

interface GraphNode {
  readonly id: string;
  readonly kind: 'document' | 'tree' | 'claim';
  readonly label: string;
  readonly detail: string;
  readonly state: string;
  readonly version?: string;
  readonly row?: string;              // claims: the subject key they share a row with
  lastSeq?: number;                   // the latest log row about this node (the Explain panel follows it)
}
interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'structure' | 'extracts' | 'reconfirmed-by' | 'superseded-by' | 'conflict';
}

/**
 * The dependencies between the artifacts of the first three layers, as of the events given: every edge is read
 * from an event (ingest → tree → claims; supersession with its reason; open conflicts). Layers 4-6 join with ws-seg3.
 */
function graphView(events: readonly LogEvent[], states: ReadonlyMap<string, ClaimState>) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const has = new Set<string>();
  const add = (n: GraphNode) => { if (!has.has(n.id)) { has.add(n.id); nodes.push(n); } };
  const verifiedTrees = new Map<string, string>();
  for (const e of events) if (e.type === 'StructureVerified') verifiedTrees.set(e.payload.treeId, displayActor(e.actor));

  for (const e of events) {
    if (e.type === 'DocumentVersionIngested') {
      const p = e.payload;
      add({ id: `doc:${p.version}`, kind: 'document', label: `${p.lineageId}@${p.version}`, detail: `in force ${p.effectiveFrom}${p.effectiveTo ? ` – ${p.effectiveTo}` : ' –'}`, state: 'ingested', version: p.version });
    } else if (e.type === 'StructureProposed') {
      const p = e.payload;
      const by = verifiedTrees.get(p.treeId);
      add({ id: `tree:${p.treeId}`, kind: 'tree', label: p.treeId, detail: `${p.nodes.filter((n) => n.type === 'comma').length} commi${by ? ` · verified by ${by}` : ''}`, state: by ? 'verified' : 'proposed', version: p.version });
      edges.push({ from: `doc:${p.version}`, to: `tree:${p.treeId}`, kind: 'structure' });
    } else if (e.type === 'ClaimProposed' && !has.has(`claim:${e.payload.claimId}`)) {
      const p = e.payload;
      const version = p.spans[0]!.version;
      add({ id: `claim:${p.claimId}`, kind: 'claim', label: p.label ?? `clm-${p.claimId.slice(0, 8)}`, detail: `${displayValue(p.normalizedValue as NormalizedValue)} · ${displayActor(e.actor)}`, state: states.get(p.claimId) ?? 'proposed', version, row: p.subjectKey });
      if (has.has(`tree:tree-${version}`)) edges.push({ from: `tree:tree-${version}`, to: `claim:${p.claimId}`, kind: 'extracts' });
    } else if (e.type === 'ClaimSuperseded') {
      const kind = e.evidence.reason === 'reconfirmation-chain' ? 'reconfirmed-by' : 'superseded-by';
      edges.push({ from: `claim:${e.payload.claimId}`, to: `claim:${e.payload.successor}`, kind });
    } else if (e.type === 'ClaimContested' && states.get(e.payload.claimId) === 'contested') {
      edges.push({ from: `claim:${e.payload.conflictingClaimId}`, to: `claim:${e.payload.claimId}`, kind: 'conflict' });
    }
  }
  // The latest row about each node: its ingest, its tree events, or any Claims event on the claim.
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  for (const e of events) {
    const p = e.payload as { version?: string; treeId?: string; claimId?: string };
    const id = e.type === 'DocumentVersionIngested' ? `doc:${p.version}` : p.treeId ? `tree:${p.treeId}` : e.layer === 'claims' && p.claimId ? `claim:${p.claimId}` : undefined;
    const n = id ? byId.get(id) : undefined;
    if (n) n.lastSeq = e.seq;
  }
  return { nodes, edges: edges.filter((x) => has.has(x.from) && has.has(x.to)) };
}

/** Claims as the fold of the first `at` events: moving `at` back shows what was believed at that row of the log. */
function claimsAt(events: readonly LogEvent[], at: number) {
  const slice = events.slice(0, at);
  const { states, warnings } = displayStates(slice);
  return { claims: claimsView(slice, states), graph: graphView(slice, states), warnings };
}

/** Tabs this checkout has not built yet, each with the tag that adds it: the page names the tag instead of breaking. */
const FEATURES: Readonly<Record<string, string>> = {};

function state(path: string, writable: boolean, at?: number) {
  const events = readLog(path);
  const ragIndex = ragIndexBeside(path);
  const seq = at === undefined ? events.length : Math.max(0, Math.min(at, events.length));
  return {
    log: logView(events), ...claimsAt(events, seq), at: seq, total: events.length,
    chunks: chunksView(ragIndex), ragIndexed: existsSync(ragIndex), documents: documents(), writable,
    explain: { enabled: Boolean(API_KEY), model: EXPLAIN_MODEL, known: Object.fromEntries(explanations) },
    features: FEATURES,
  };
}

/**
 * One HTML file with the page and the data inside: the full state plus the claims at every row of the log, so
 * the slider works without a server. JSON is embedded with `<` escaped, so no text can close the script tag.
 */
function exportSnapshot(path: string, out: string, page: string): number {
  const events = readLog(path);
  const snapshot = { ...state(path, false), claimsBySeq: events.map((_, i) => claimsAt(events, i)).concat([claimsAt(events, events.length)]) };
  const data = `<script>window.SNAPSHOT = ${JSON.stringify(snapshot).replace(/</g, '\\u003c')};</script>\n`;
  writeFileSync(out, page.replace('<script>', () => data + '<script>'));     // a function: no $-patterns in data
  return events.length;
}

class Refused extends Error {}

// ---------------------------------------------------------------- explainer (opt-in, network)
// Raw fetch to the Messages API rather than @anthropic-ai/sdk: the repository adds no dependency after phase A.
// The system prompt is the domain primer (04 domain model + 00 running example), stable across calls and
// cached; the user turn carries the row, its causation chain and the log up to it. Explanations are memoised
// per (event, language) and embedded in --export, so a snapshot keeps the ones already asked for.
const EXPLAIN_MODEL = 'claude-haiku-5-5';
let API_KEY: string | undefined;
let API_BASE = 'https://api.anthropic.com';
let KEY_SOURCE = '';

/** KEY=VALUE lines, `export ` and surrounding quotes allowed, # comments; no expansion. */
function readDotEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/**
 * The key comes from the environment first, then from the first .env found: --env <file>, ./.env (where the
 * viewer runs), then the .env of the checkout that holds the log (two levels above out/events.jsonl). Only the
 * ANTHROPIC_* entries are read; process.env is not modified.
 */
function configureExplainer(argv: readonly string[], logPath: string): void {
  const candidates = [argValue(argv, 'env'), '.env', join(dirname(dirname(resolve(logPath))), '.env')].filter((f): f is string => !!f);
  const file = candidates.find((f) => existsSync(f));
  const dotenv = file ? readDotEnv(file) : {};
  API_KEY = process.env.ANTHROPIC_API_KEY || dotenv.ANTHROPIC_API_KEY || undefined;
  API_BASE = process.env.ANTHROPIC_BASE_URL || dotenv.ANTHROPIC_BASE_URL || API_BASE;
  KEY_SOURCE = process.env.ANTHROPIC_API_KEY ? 'environment' : API_KEY && file ? resolve(file) : '';
}
const explanations = new Map<string, string>();      // `${eventId}|${lang}` → text

// Explanations persist next to the log (out/ is git-ignored and droppable), keyed by eventId, which is
// deterministic: a reset log reuses them. The file is a cache of text, never read as domain state.
const explanationsBeside = (logPath: string): string => join(dirname(logPath), 'viewer-explanations.json');
function loadExplanations(logPath: string): void {
  try {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(explanationsBeside(logPath), 'utf8')) as Record<string, string>)) explanations.set(k, v);
  } catch { /* no cache yet */ }
}

const PRIMER = (() => {
  const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : '');
  return [
    'You explain one row of an append-only event log to the audience of a conference talk, "Documents Are Not Knowledge"',
    '(Codemotion Milan 2026). The log records how knowledge is extracted from art. 2477 of the Italian Civil Code, layer by',
    'layer, with every change of state as an event with an actor. The domain model and the running example follow; they are',
    'the only source of meaning for event types, layers, states, actors and values.',
    '',
    'How to explain a row:',
    '- Say what happened in plain words: who acted (agent = an LLM-backed extractor, human = the reviewer, harness = a',
    '  deterministic process, process / import), on what (document version, tree, claim with its subject and value), and',
    '  what changed (state before and after, when given).',
    '- Say why it happened, by following the causation chain given (the rows it derives from).',
    '- Say why it matters for the story of the talk in one sentence (e.g. a conflict that a human must resolve, a class-A',
    '  reconfirmation the human does not need to review, a fact versus a decision).',
    '- Use only the vocabulary of the domain model: Document, DocumentVersion, Lineage, Span, Claim, Entity, Policy,',
    '  WorkflowStep; states proposed, verified, contested, superseded. Never say "fact" for an assertion, never "knowledge',
    '  graph", "ontology" or "atom". An event family may be called fact or decision as in the catalogue.',
    '- Never invent numbers, dates or ids that are not in the row, the chain or the primer. If something is not given, say so.',
    '- At most 120 words, two short paragraphs, no headings, no bullet lists, no preamble.',
    '',
    '<domain_model>', read('workshop/en/04-domain-model-reference.md'), '</domain_model>',
    '<running_example>', read('workshop/en/00-running-example.md'), '</running_example>',
  ].join('\n');
})();

function explainPrompt(events: readonly LogEvent[], seq: number, lang: 'it' | 'en'): string {
  const lines = formatLog(events);
  const e = events[seq - 1]!;
  const bySeq = new Map(events.map((x) => [x.eventId, x.seq] as const));
  const chain: number[] = [];
  for (let c = e.causationId; c && bySeq.has(c) && !chain.includes(bySeq.get(c)!); c = events[bySeq.get(c)! - 1]!.causationId) chain.push(bySeq.get(c)!);
  const claimId = e.layer === 'claims' ? (e.payload as { claimId?: string }).claimId : undefined;
  let claim = '';
  if (claimId) {
    const before = displayStates(events.slice(0, seq - 1)).states.get(claimId) ?? '(did not exist)';
    const after = displayStates(events.slice(0, seq)).states.get(claimId) ?? '?';
    const p = events.find((x) => x.type === 'ClaimProposed' && x.payload.claimId === claimId);
    const span = p?.type === 'ClaimProposed' ? p.payload.spans[0] : undefined;
    const text = span ? sourceText(span.version)?.slice(span.start, span.end) : undefined;
    claim = `\n<claim>state before: ${before}; state after: ${after}` + (text ? `; span ${span!.version} [${span!.start},${span!.end}): "${text}"` : '') + '</claim>';
  }
  return [
    `<log_until_this_row>\n${lines.slice(0, seq).join('\n')}\n</log_until_this_row>`,
    `<causation_chain>\n${chain.map((n) => lines[n - 1]).join('\n') || '(none: a root event)'}\n</causation_chain>`,
    `<row>\n${lines[seq - 1]}\n${JSON.stringify(e)}\n</row>${claim}`,
    `Explain row ${displayEventId(seq)} in ${lang === 'it' ? 'Italian' : 'English'}.`,
  ].join('\n\n');
}

async function explain(path: string, seq: number, lang: 'it' | 'en'): Promise<{ text: string; cached: boolean }> {
  if (!API_KEY) throw new Refused('no ANTHROPIC_API_KEY: put it in .env (or the environment) and restart the viewer');
  const events = readLog(path);
  const e = events[seq - 1];
  if (!e) throw new Refused(`no row ${seq} in the log`);
  const key = `${e.eventId}|${lang}`;
  const hit = explanations.get(key);
  if (hit) return { text: hit, cached: true };

  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2026-10-21' },
    body: JSON.stringify({
      model: EXPLAIN_MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: PRIMER, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: explainPrompt(events, seq, lang) }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    error?: { message?: string };
  };
  if (!res.ok) throw new Refused(res.status === 401 ? 'the Anthropic API rejected the key (401)' : `Anthropic API ${res.status}: ${body.error?.message ?? 'error'}`);
  if (body.stop_reason === 'refusal') throw new Refused('the model declined to explain this row');
  const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  if (!text) throw new Refused(`empty explanation (stop_reason ${body.stop_reason ?? '?'})`);
  explanations.set(key, text);
  writeFileSync(explanationsBeside(path), JSON.stringify(Object.fromEntries(explanations), null, 1) + '\n');
  return { text, cached: false };
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

await run('viewer', () => {
  const argv = process.argv.slice(2);
  const port = Number(argValue(argv, 'port') ?? 4477);
  const path = argValue(argv, 'file') ?? config.paths.log;
  if (hasFlag(argv, 'write')) throw new Error('--write arrives with ws-seg3');
  const writable = false;
  // Read on every request, so an edit to the page shows on reload without restarting the server.
  const page = () => readFileSync(new URL('./viewer.html', import.meta.url), 'utf8');
  configureExplainer(argv, path);
  loadExplanations(path);
  const exportTo = argValue(argv, 'export');
  if (exportTo) {
    const n = exportSnapshot(path, exportTo, page());
    process.stdout.write(`snapshot of ${n} events written to ${exportTo}\n`);
    return;
  }
  createServer(async (req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/api/state') {
        const seq = url.searchParams.get('seq');
        json(200, state(path, writable, seq === null ? undefined : Number(seq)));
      } else if (url.pathname === '/api/explain' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { seq?: unknown; lang?: unknown };
        json(200, await explain(path, Number(body.seq), body.lang === 'en' ? 'en' : 'it'));
      } else {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(page());
      }
    } catch (err) {
      json(err instanceof Refused ? 409 : 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }).listen(port, '127.0.0.1', () => process.stdout.write(`viewer on http://localhost:${port} (read-only; explain ${API_KEY ? `on, ${EXPLAIN_MODEL}, key from ${KEY_SOURCE}` : 'off: no ANTHROPIC_API_KEY in the environment or a .env'})\n`));
});
