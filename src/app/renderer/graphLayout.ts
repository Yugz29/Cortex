/**
 * Algorithmes de layout pour le GraphView.
 * Fonctions pures — aucune dépendance React.
 * Testables indépendamment du rendu.
 */

import type { Scan, Edge } from './types';
import { classifyLayer, LAYER_ORDER } from './utils';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Vec = { x: number; y: number };
export type NodeLayout = Vec & { id: string; r: number; score: number; fanIn: number; fanOut: number };

// ── Helpers internes ──────────────────────────────────────────────────────────

function nodeR(s: Scan): number {
  return Math.max(6, Math.min(16, 6 + s.fanIn * 0.9));
}

// ── Exports publics ───────────────────────────────────────────────────────────

/**
 * Calcule les centres de clusters dynamiquement selon les layers présents.
 * - 1 layer  : centré à l'origine
 * - CORE présent : CORE au centre, les autres en cercle autour
 * - Sans CORE : tous en cercle
 * Le rayon du cercle s'adapte au nombre de layers et à la taille des clusters.
 */
function clusterCenters(activeLayers: string[], byLayer: Map<string, Scan[]>): Map<string, Vec> {
  const centers = new Map<string, Vec>();
  if (activeLayers.length === 0) return centers;
  if (activeLayers.length === 1) {
    centers.set(activeLayers[0], { x: 0, y: 0 });
    return centers;
  }

  // Rayon de base proportionnel au nombre de nœuds dans le plus grand cluster
  const maxClusterSize = Math.max(...activeLayers.map(l => byLayer.get(l)?.length ?? 0));
  const clusterSpread  = Math.max(60, Math.sqrt(maxClusterSize) * 22);
  const ringRadius     = Math.max(220, activeLayers.length * 90);

  const hasCore   = activeLayers.includes('core');
  const outerLayers = hasCore ? activeLayers.filter(l => l !== 'core') : activeLayers;

  if (hasCore) centers.set('core', { x: 0, y: 0 });

  outerLayers.forEach((l, i) => {
    // Départ à -90° (haut) pour que UI soit en haut naturellement
    const angle = (i / outerLayers.length) * 2 * Math.PI - Math.PI / 2;
    const r     = ringRadius + (byLayer.get(l)?.length ?? 0) * 0.5;
    centers.set(l, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
  });

  void clusterSpread; // utilisé implicitement via ringRadius
  return centers;
}

/**
 * Layout par layer : nœuds en clusters par couche architecturale.
 * Spirale de Fermat à l'intérieur de chaque cluster.
 * Les centres de clusters sont calculés dynamiquement selon les layers présents.
 */
export function buildLayerLayout(scans: Scan[]): Map<string, NodeLayout> {
  const byLayer = new Map<string, Scan[]>();
  for (const l of LAYER_ORDER) byLayer.set(l, []);
  for (const s of scans) byLayer.get(classifyLayer(s.filePath))!.push(s);

  const activeLayers = LAYER_ORDER.filter(l => (byLayer.get(l)?.length ?? 0) > 0);
  const centers      = clusterCenters(activeLayers, byLayer);

  const result  = new Map<string, NodeLayout>();
  const GOLDEN  = Math.PI * (3 - Math.sqrt(5));
  const SPACING = 24;

  for (const [l, nodes] of byLayer) {
    if (!nodes.length) continue;
    const center = centers.get(l) ?? { x: 0, y: 0 };
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

/**
 * Layout force-directed : d3-force simulé de façon synchrone jusqu'à convergence.
 * Utilisé pour la vue "ALL LINKS" — met en avant les clusters naturels du graphe.
 */
export function buildForceLayout(scans: Scan[], edges: Edge[]): Map<string, NodeLayout> {
  if (!scans.length) return new Map();

  const nodes = scans.map(s => ({
    id: s.filePath, r: nodeR(s), score: s.globalScore,
    fanIn: s.fanIn, fanOut: s.fanOut,
    x: (Math.random() - 0.5) * 400,
    y: (Math.random() - 0.5) * 400,
  }));

  const idSet = new Set(nodes.map(n => n.id));
  const links = edges
    .filter(e => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to)
    .map(e => ({ source: e.from, target: e.to }));

  const sim = forceSimulation(nodes as any)
    .force('link', (forceLink as any)(links).id((d: any) => d.id).distance(55).strength(0.5))
    .force('charge', forceManyBody().strength(-90))
    .force('center', forceCenter(0, 0).strength(0.1))
    .force('collide', forceCollide((d: any) => d.r + 18).strength(0.9))
    .stop();

  // Simulation synchrone — tick jusqu'à alpha < seuil
  sim.tick(Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())));

  const result = new Map<string, NodeLayout>();
  for (const n of nodes as any[]) {
    result.set(n.id, { id: n.id, x: n.x ?? 0, y: n.y ?? 0, r: n.r, score: n.score, fanIn: n.fanIn, fanOut: n.fanOut });
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
