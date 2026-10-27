// Segment 1 control experiment: the chunker of a standard RAG pipeline. One chunk per paragraph (split on
// blank lines, header block included), numbered from 0 per file; no notion of comma, version or validity:
// exactly the information the rest of the repository keeps.

export interface Chunk {
  id: string;
  source_file: string;
  text: string;
}

/** Splits a file on blank lines; empty paragraphs are dropped. Ids read `cc-art2477-v8 #3`. */
export function chunkParagraphs(sourceFile: string, text: string): Chunk[] {
  const stem = sourceFile.replace(/\.txt$/, '');
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p, n) => ({ id: `${stem} #${n}`, source_file: sourceFile, text: p }));
}
