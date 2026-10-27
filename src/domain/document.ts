import type { DocumentId, LineageId } from './ids';

export type DocumentKind = 'consolidated-text' | 'amending-act' | 'system-of-record';

export interface DocumentVersion {           // value object
  readonly documentId: DocumentId;
  readonly lineageId: LineageId;             // 'cc-art2477'
  readonly version: string;                  // e.g. 'v8', 'v9' (Normattiva art.versione)
  readonly contentHash: string;
  readonly effectiveFrom: string;            // ISO date — valid time ('2019-03-16', '2019-06-18')
  readonly effectiveTo?: string;             // known once the successor is ingested
  readonly kind: DocumentKind;
}
