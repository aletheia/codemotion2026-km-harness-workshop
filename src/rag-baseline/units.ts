// The comma the one-shot baseline reads, cut from the text with the offsets of manifest.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import type { ExtractionUnit } from '../agents/replayer';

interface ManifestNode {
  path: string;
  start: number;
  end: number;
}

export function manifestUnit(file: string, documentId: string, version: string, path: string, dir: string = config.rag.sourceDir): ExtractionUnit {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Record<string, { tree: ManifestNode[] }>;
  const node = manifest[file]?.tree.find((n) => n.path === path);
  if (!node) throw new Error(`no node ${path} for ${file} in manifest.json`);
  return { documentId, version, path, text: readFileSync(join(dir, file), 'utf8').slice(node.start, node.end) };
}
