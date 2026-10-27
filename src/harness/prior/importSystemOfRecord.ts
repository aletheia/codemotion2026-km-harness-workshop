// Prior from a system of record (00-running-example.md §10): the thresholds a firm currently applies,
// read from fixtures/documents/compliance-register.csv. Not used live; present for the cold-start
// discussion and the tests. The register is ingested as a document of kind system-of-record (actor import),
// each row becomes a Claim whose Span is the row's character interval in the register, verified by import.
//
// TODO(luca): 04 §5 lets only an agent or a human propose a Claim, and import only verify. The importer
// therefore proposes each row as the human operator who runs the import, then verifies it as import.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../../config';
import { contentHashOf } from '../../acl/sourceToStructure';
import { deriveClaimId, type NormalizedValue, type SubjectKey } from '../../domain/claim';
import { documentId as asDocumentId, lineageId as asLineageId } from '../../domain/ids';
import { deriveEventId } from '../../events/eventId';
import type { EventDraft } from '../../events/log';

export const REGISTER_FILE = 'compliance-register.csv';
const COLUMNS = ['lineage', 'subject_key', 'value', 'unit', 'applies_from', 'note'] as const;

export interface RegisterRow {
  readonly row: number;                      // 1-based, header excluded
  readonly lineageId: string;
  readonly subjectKey: SubjectKey;
  readonly value: NormalizedValue;
  readonly appliesFrom: string;
  readonly start: number;                    // the row's [start, end) in the register text
  readonly end: number;
}

/** The register's unit column decides the normalized type; anything else is refused, never guessed. */
function toValue(raw: string, unit: string): NormalizedValue {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`register: "${raw}" is not a number`);
  if (unit === 'EUR') return { type: 'money', amount: n, currency: 'EUR' };
  if (unit === 'count' || unit === 'years' || unit === 'days') return { type: 'integer', value: n, unit };
  throw new Error(`register: unsupported unit "${unit}"`);
}

/** Parses the register; rows keep their character interval so a Claim can point at them. */
export function parseRegister(text: string): RegisterRow[] {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== COLUMNS.join(',')) throw new Error(`register: expected header ${COLUMNS.join(',')}`);
  const rows: RegisterRow[] = [];
  // Track absolute offsets line by line (+1 for the newline) so each row can become a half-open Span.
  let offset = lines[0]!.length + 1;
  for (const line of lines.slice(1)) {
    const start = offset;
    offset += line.length + 1;
    if (line.trim() === '') continue;
    const [lineage, subjectKey, value, unit, appliesFrom] = line.split(',');
    if (!lineage || !subjectKey || !value || !unit || !appliesFrom) throw new Error(`register: malformed row "${line}"`);
    rows.push({ row: rows.length + 1, lineageId: lineage, subjectKey: subjectKey as SubjectKey, value: toValue(value, unit), appliesFrom, start, end: start + line.length });
  }
  return rows;
}

export interface ImportOptions {
  readonly operator: string;                 // the human who runs the import
  readonly documentId?: string;
  readonly version?: string;
}

/** Pure: register text → the drafts to append (one ingestion, then a proposal and a verification per row). */
export function importSystemOfRecord(text: string, opts: ImportOptions): EventDraft[] {
  const documentId = opts.documentId ?? 'compliance-register';
  const version = opts.version ?? 'r1';
  const rows = parseRegister(text);
  const importer = { kind: 'import', id: 'register', source: REGISTER_FILE } as const;
  const operator = { kind: 'human', id: opts.operator } as const;
  const correlationId = `import-${documentId}-${version}`;
  const aggregateId = `${documentId}@${version}`;
  const contentHash = contentHashOf(text);

  // The register is a document version like any other: ingested first, so every claim's Span and causation
  // point at it. Its effective date is the earliest applies_from in the file.
  const ingestId = deriveEventId({ producer: 'import:register', inputArtifactId: contentHash, extractorVersion: null, eventType: 'DocumentVersionIngested', aggregateId });
  const drafts: EventDraft[] = [{
    eventId: ingestId,
    type: 'DocumentVersionIngested',
    layer: 'source',
    aggregateId,
    actor: importer,
    correlationId,
    payload: {
      lineageId: documentId, documentId, version, contentHash,
      effectiveFrom: rows.map((r) => r.appliesFrom).sort()[0] ?? '1970-01-01',
      kind: 'system-of-record',
      length: text.length,
      sourceReference: REGISTER_FILE,
    },
  }];

  // Per row: proposed by the operator, then verified by import with the row as source record. The claim
  // keeps the row's lineage (cc-art2477), so CurrentBeliefs keys it with the article's claims.
  for (const r of rows) {
    const claimId = deriveClaimId(asDocumentId(documentId), version, r.subjectKey, r.value);
    const proposedId = deriveEventId({ producer: `human:${opts.operator}`, inputArtifactId: ingestId, extractorVersion: null, eventType: 'ClaimProposed', aggregateId: claimId });
    drafts.push(
      {
        eventId: proposedId,
        type: 'ClaimProposed',
        layer: 'claims',
        aggregateId: claimId,
        actor: operator,
        causationId: ingestId,
        correlationId,
        payload: {
          claimId, lineageId: asLineageId(r.lineageId), subjectKey: r.subjectKey, normalizedValue: r.value,
          spans: [{ documentId, version, start: r.start, end: r.end }], sectionPath: `row-${r.row}`,
        },
      },
      {
        eventId: deriveEventId({ producer: 'import:register', inputArtifactId: proposedId, extractorVersion: null, eventType: 'ClaimVerified', aggregateId: claimId }),
        type: 'ClaimVerified',
        layer: 'claims',
        aggregateId: claimId,
        actor: importer,
        causationId: proposedId,
        correlationId,
        payload: { claimId },
        evidence: { kind: 'import', sourceRecord: `${REGISTER_FILE} row ${r.row}` },
      },
    );
  }
  return drafts;
}

export const readRegister = (dir: string = config.paths.documents): string => readFileSync(join(dir, REGISTER_FILE), 'utf8');
