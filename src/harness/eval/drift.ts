// Drift between two extractor versions, per item, never by comparing percentages. Pure.
import { config } from '../../config';
import type { EvalResult, EvalRow } from './metrics';

export type Cell = 'stable' | 'regression' | 'improvement' | 'stable-wrong';
export interface DriftItem { documentId: string; subjectKey: string; cell: Cell; from: EvalRow; to: EvalRow; critical: boolean }
export interface Criterion { n: 1 | 2 | 3 | 4; name: string; met: boolean; detail: string }
export interface DriftResult {
  items: DriftItem[];
  noise: { subjectKey: string; documentId: string; valueText: string; newIn: 'to' | 'from' | 'both' }[];
  provenance: { subjectKey: string; documentId: string; iouFrom: number; iouTo: number; crossedTheta: boolean }[];
  criteria: Criterion[];
  failed: number[];
  meetsAll: boolean;
}

const fmt = (x: number): string => x.toFixed(2);

export function drift(from: EvalResult, to: EvalResult, theta: number = config.thetaIoU): DriftResult {
  const id = (r: EvalRow) => `${r.documentId}|${r.subjectKey}`;
  const toBy = new Map(to.rows.filter((r) => r.expected).map((r) => [id(r), r]));
  const items: DriftItem[] = [];
  for (const f of from.rows.filter((r) => r.expected)) {
    const t = toBy.get(id(f));
    if (!t) continue;
    const a = f.outcome === 'TP';
    const b = t.outcome === 'TP';
    items.push({ documentId: f.documentId, subjectKey: f.subjectKey, cell: a && b ? 'stable' : a ? 'regression' : b ? 'improvement' : 'stable-wrong', from: f, to: t, critical: f.critical });
  }
  const spurious = (r: EvalResult) => r.rows.filter((x) => x.outcome === 'SPURIOUS');
  const fromNoise = new Set(spurious(from).map((r) => `${id(r)}|${r.proposed!.valueText}`));
  const toNoise = spurious(to);
  const noise = toNoise.map((r) => ({ subjectKey: r.subjectKey, documentId: r.documentId, valueText: r.proposed!.valueText, newIn: (fromNoise.has(`${id(r)}|${r.proposed!.valueText}`) ? 'both' : 'to') as 'to' | 'both' }));
  const provenance = items
    .filter((i) => i.from.valueOk && i.to.valueOk && i.from.iou !== null && i.to.iou !== null)
    .filter((i) => i.from.iou !== i.to.iou)
    .map((i) => ({ subjectKey: i.subjectKey, documentId: i.documentId, iouFrom: i.from.iou!, iouTo: i.to.iou!, crossedTheta: (i.from.iou! >= theta) !== (i.to.iou! >= theta) }));
  const criticalRegressions = items.filter((i) => i.cell === 'regression' && i.critical);
  const wrongShare = to.valueCorrectPairs === 0 ? 0 : to.wrongProvenancePairs / to.valueCorrectPairs;
  const criteria: Criterion[] = [
    { n: 1, name: 'precision on the layer', met: to.precision >= config.promotion.layerPrecision, detail: `precision ${fmt(to.precision)} vs threshold ${fmt(config.promotion.layerPrecision)}` },
    { n: 2, name: 'recall does not drop', met: to.recall >= from.recall - config.promotion.recallEpsilon, detail: `recall ${fmt(to.recall)} vs ${fmt(from.recall)} - ${config.promotion.recallEpsilon}` },
    { n: 3, name: 'zero regressions on the critical subset', met: criticalRegressions.length === 0, detail: criticalRegressions.length ? `regressions: ${criticalRegressions.map((i) => i.subjectKey).join(', ')}` : 'none' },
    { n: 4, name: 'wrong provenance on value-correct pairs', met: wrongShare <= config.promotion.maxWrongProvenanceShare, detail: `${to.wrongProvenancePairs} of ${to.valueCorrectPairs} value-correct pairs (limit ${config.promotion.maxWrongProvenanceShare * 100} %)` },
  ];
  const failed = criteria.filter((c) => !c.met).map((c) => c.n);
  return { items, noise, provenance, criteria, failed, meetsAll: failed.length === 0 };
}
