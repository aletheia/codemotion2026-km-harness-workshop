// Screen format of rag:query and rag:delete-v8 (fallback/seg1/).
import type { Hit, RagIndex } from './index';

/** A chunk holding lettera c) is shown from "c) " onward; any other is cut at 150 characters. */
export function trimmed(text: string): string {
  const c = text.indexOf('\nc) ');
  if (c >= 0) return '… ' + text.slice(c + 1);
  return text.length > 150 ? text.slice(0, 150) + ' …' : text;
}

export function formatQuery(index: RagIndex, q: string, topK: number, hits: readonly Hit[]): string[] {
  return [
    `rag-query  index=${index.name}  chunks=${index.chunks.length}  top_k=${topK}  q="${q}"`,
    'score  chunk                      text (trimmed)',
    ...hits.map((h) => `${h.score.toFixed(3)}  ${h.chunk.id.padEnd(26)} ${trimmed(h.chunk.text)}`),
    // Shown once, on the complete index (segment 1 opening query).
    ...(index.deleted.length ? [] : ['fields available per chunk: id, source_file, text, vector']),
  ];
}

export function formatDelete(index: RagIndex, version: string, removed: number): string {
  return `rag-delete  version=${version}  removed=${removed} chunks  index=${index.name} (${index.chunks.length} chunks left)`;
}
