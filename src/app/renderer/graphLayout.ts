/**
 * Algorithmes de layout pour le GraphView.
 * Fonctions pures — aucune dépendance React.
 * Testables indépendamment du rendu.
 */

import type { Scan, Edge } from './types';
import { classifyLayer, LAYER_ORDER } from './utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Vec = { x: number; y: number };
export type NodeLayout = Vec & { id: string; r: number; score: number; fanIn: number; fanOut: number };

// ── Helpers internes ──────────────────────────────────────────────────────────

function nodeR(s: Scan): number {
  return Math.max(6, Math.min(16, 6 + s.fanIn * 0.9));
}

// ── Exports publics ───────────────────────────────────────────────────────────

// Centres fixes des clusters par layer
const CLUSTER_CENTERS: Record<string, Vec> = {
  ui:     { x:   0, y: -320 },
  api:    { x:  360, y:  -80 },
  core:   { x:   0, y:    0 },
  db:     { x: -360, y:  180 },
  config: { x:  360, y:  280 },
};

/**
 * Layout par layer : nœuds en clusters par couche architecturale.
 * Spirale de Fermat à l'intérieur de chaque cluster.
 */
export function buildLayerLayout(scans: Scan[]): Map<string, NodeLayout> {
  const byLayer = new Map<string, Scan[]>();
  for (const l of LAYER_ORDER) byLayer.set(l, []);
  for (const s of scans) byLayer.get(classifyLayer(s.filePath))!.push(s);

  const result  = new Map<string, NodeLayout>();
  const GOLDEN  = Math.PI * (3 - Math.sqrt(5));
  const SPACING = 24;

  for (const [l, nodes] of byLayer) {
    if (!nodes.length) continue;
    const center = CLUSTER_CENTERS[l] ?? { x: 0, y: 0 };
    nodes.forEach((s, i) => {
      const r = nodeR(s);
      if (i === 0) {
        result.set(s.filePath, { id: s.filePath, x: center.x, y: center.y, r, score: s.globalScore, fanIn: s.fanIn, fanOut: s.fanOut });
        return;
      }
      const angle  = i * GOLDEN;
      const radius = SPACING * Math.sqrt(i);
      result.set(s.filePath, {
        id: s.filePath,
        x:  center.x + radius * Math.cos(angle),
        y:  center.y + radius * Math.sin(angle),
        r, score: s.globalScore, fanIn: s.fanIn, fanOut: s.fanOut,
      });
    });
  }
  return result;
}

/** Clé canonique pour une paire de nœuds (stable quelque soit l'ordre). */
export function canonKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/** Précalcule les paires bidi : edges dans les deux sens entre deux mêmes nœuds. */
export function buildEdgePairs(edges: Edge[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const k = canonKey(e.from, e.to);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(i);
  });
  return m;
}
