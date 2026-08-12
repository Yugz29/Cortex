/**
 * Construction de la scène 3D à partir du graphe Cortex réel.
 *
 * Réutilise le code Cortex existant (via l'alias @cortex) :
 * - buildLayerLayout  → coordonnées X/Y et rayon des nœuds (mêmes que GraphView) ;
 * - classifyLayer     → couche architecturale, projetée sur l'axe Z ;
 * - scoreColorHex     → couleur des nœuds selon le score existant.
 *
 * Pas de nouveau moteur de layout 3D : X/Y viennent du layout Cortex, Z de la couche.
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Scan, Edge } from '@cortex/types';
import { buildLayerLayout } from '@cortex/graphLayout';
import { classifyLayer, scoreColorHex, LAYER_ORDER, LAYER_LABELS, LAYER_COLORS } from '@cortex/utils';
import { filterDisplayEdges } from './graphNeighborhood';

export interface GraphData {
  scans: Scan[];
  edges: Edge[];
}

// px (layout SVG) → mètres (monde XR)
const WORLD_SCALE   = 1 / 150;
// Écart entre deux couches architecturales sur Z (mètres)
const LAYER_SPACING = 0.7;

export async function fetchGraph(): Promise<GraphData> {
  const res = await fetch('/api/graph');
  if (!res.ok) throw new Error(`GET /api/graph → HTTP ${res.status}`);
  return res.json();
}

/** Z monde d'un fichier : index de sa couche, centré autour de 0. */
export function layerZ(filePath: string): number {
  const idx = LAYER_ORDER.indexOf(classifyLayer(filePath));
  return ((LAYER_ORDER.length - 1) / 2 - idx) * LAYER_SPACING;
}

/** Opacité de base des arêtes (état sans sélection). */
export const EDGE_BASE_OPACITY = 0.35;
/** Épaisseur des arêtes en pixels — LineMaterial (Line2), car le linewidth de
 *  LineBasicMaterial n'est pas honoré par la plupart des drivers WebGL. */
export const EDGE_LINEWIDTH_PX = 3;

export interface EdgeLayers {
  /** Toutes les arêtes — masqué pendant une sélection. */
  all:   LineSegments2;
  /** Surcouche du voisinage sélectionné — invisible par défaut ; sa géométrie
   *  est reconstruite à la sélection à partir de `positions`/`colors`. */
  focus: LineSegments2;
  /** Buffers plats par arête (6 floats chacune) — même ordre que displayEdges. */
  positions: Float32Array;
  colors:    Float32Array;
}

export interface GraphSceneResult {
  group:      THREE.Group;
  /** Meshes sélectionnables — userData.scan porte le Scan complet. */
  nodeMeshes: THREE.Mesh[];
  /** Arêtes affichées (filterDisplayEdges) — même ordre que les segments. */
  displayEdges: Edge[];
  /** Calques de lignes — null si aucune arête. */
  edgeLines: EdgeLayers | null;
}

export function buildGraphGroup(data: GraphData): GraphSceneResult {
  const group      = new THREE.Group();
  const nodeMeshes: THREE.Mesh[] = [];

  // Layout 2D Cortex existant (mode "layers" de GraphView)
  const layout = buildLayerLayout(data.scans);

  const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
  const positions = new Map<string, THREE.Vector3>();

  for (const scan of data.scans) {
    const nl = layout.get(scan.filePath);
    if (!nl) continue;

    const pos = new THREE.Vector3(nl.x * WORLD_SCALE, -nl.y * WORLD_SCALE, layerZ(scan.filePath));
    positions.set(scan.filePath, pos);

    const material = new THREE.MeshStandardMaterial({
      color:     new THREE.Color(scoreColorHex(scan.globalScore)),
      roughness: 0.45,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(sphereGeo, material);
    // Taille issue de la logique existante (nodeR via NodeLayout.r), boostée pour la lisibilité XR
    const radius = nl.r * WORLD_SCALE * 1.6;
    mesh.scale.setScalar(radius);
    mesh.position.copy(pos);
    mesh.userData['scan']       = scan;
    mesh.userData['baseRadius'] = radius;
    group.add(mesh);
    nodeMeshes.push(mesh);
  }

  // Edges — même filtrage que buildForceLayout (via filterDisplayEdges) : on
  // ignore tout edge dont un des deux nœuds n'existe pas, et les self-loops.
  const displayEdges = filterDisplayEdges(data.edges, new Set(positions.keys()));

  const linePositions: number[] = [];
  const lineColors:    number[] = [];
  const colorCache = new Map<string, THREE.Color>();
  const edgeColor = (path: string, score: number): THREE.Color => {
    let c = colorCache.get(path);
    if (!c) { c = new THREE.Color(scoreColorHex(score)); colorCache.set(path, c); }
    return c;
  };
  const scoreByPath = new Map(data.scans.map(s => [s.filePath, s.globalScore]));

  for (const e of displayEdges) {
    const a = positions.get(e.from)!;
    const b = positions.get(e.to)!;
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const ca = edgeColor(e.from, scoreByPath.get(e.from) ?? 0);
    const cb = edgeColor(e.to,   scoreByPath.get(e.to)   ?? 0);
    lineColors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
  }

  let edgeLines: GraphSceneResult['edgeLines'] = null;
  if (linePositions.length > 0) {
    const makeMaterial = (opacity: number): LineMaterial => {
      const mat = new LineMaterial({
        vertexColors: true,
        transparent:  true,
        opacity,
        linewidth:    EDGE_LINEWIDTH_PX,   // pixels (worldUnits: false)
      });
      mat.resolution.set(window.innerWidth, window.innerHeight);
      return mat;
    };

    const allGeo = new LineSegmentsGeometry();
    allGeo.setPositions(linePositions);
    allGeo.setColors(lineColors);
    const all = new LineSegments2(allGeo, makeMaterial(EDGE_BASE_OPACITY));

    // Surcouche focus : géométrie remplacée à la sélection (sous-ensemble des
    // buffers ci-dessous) — initialisée pleine mais invisible.
    const focusGeo = new LineSegmentsGeometry();
    focusGeo.setPositions(linePositions);
    focusGeo.setColors(lineColors);
    const focus = new LineSegments2(focusGeo, makeMaterial(0.95));
    focus.visible = false;

    group.add(all);
    group.add(focus);
    edgeLines = {
      all, focus,
      positions: Float32Array.from(linePositions),
      colors:    Float32Array.from(lineColors),
    };
  }

  // Étiquettes de couches — un sprite texte par couche active, placé sur son plan Z
  const activeLayers = new Set(data.scans.map(s => classifyLayer(s.filePath)));
  for (const layer of LAYER_ORDER) {
    if (!activeLayers.has(layer)) continue;
    const sprite = makeTextSprite(LAYER_LABELS[layer], LAYER_COLORS[layer]);
    const idx = LAYER_ORDER.indexOf(layer);
    sprite.position.set(0, 2.2, ((LAYER_ORDER.length - 1) / 2 - idx) * LAYER_SPACING);
    group.add(sprite);
  }

  return { group, nodeMeshes, displayEdges, edgeLines };
}

/**
 * Étiquette de nom de fichier au-dessus d'un nœud — même technique
 * CanvasTexture/Sprite que les étiquettes de couche (billboard natif).
 * Fond sombre translucide pour rester lisible sur le graphe.
 */
export function makeNodeLabelSprite(text: string): THREE.Sprite {
  const W = 320, H = 48;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.font = 'bold 26px -apple-system, Segoe UI, Roboto, sans-serif';
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > W - 24) t = t.slice(0, -1);
  if (t !== text) t += '…';

  const textW = ctx.measureText(t).width;
  ctx.fillStyle = 'rgba(16, 16, 20, 0.72)';
  ctx.beginPath();
  ctx.roundRect((W - textW) / 2 - 10, 4, textW + 20, H - 8, 10);
  ctx.fill();

  ctx.fillStyle = '#e5e5ea';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, W / 2, H / 2 + 1);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true,
    depthWrite: false,
    depthTest:  false,   // surcouche d'annotation : jamais occultée par les sphères
  }));
  sprite.scale.set(0.30, 0.045, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function makeTextSprite(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 40px -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = colorHex;
  ctx.globalAlpha = 0.9;
  ctx.fillText(text, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite  = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(0.5, 0.125, 1);
  return sprite;
}
