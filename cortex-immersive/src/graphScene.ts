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
import type { Scan, Edge } from '@cortex/types';
import { buildLayerLayout } from '@cortex/graphLayout';
import { classifyLayer, scoreColorHex, LAYER_ORDER, LAYER_LABELS, LAYER_COLORS } from '@cortex/utils';

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

export interface GraphSceneResult {
  group:      THREE.Group;
  /** Meshes sélectionnables — userData.scan porte le Scan complet. */
  nodeMeshes: THREE.Mesh[];
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

  // Edges — même filtrage que buildForceLayout : on ignore tout edge dont un
  // des deux nœuds n'existe pas dans les scans, et les self-loops.
  const linePositions: number[] = [];
  const lineColors:    number[] = [];
  const colorCache = new Map<string, THREE.Color>();
  const edgeColor = (path: string, score: number): THREE.Color => {
    let c = colorCache.get(path);
    if (!c) { c = new THREE.Color(scoreColorHex(score)); colorCache.set(path, c); }
    return c;
  };
  const scoreByPath = new Map(data.scans.map(s => [s.filePath, s.globalScore]));

  for (const e of data.edges) {
    if (e.from === e.to) continue;
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const ca = edgeColor(e.from, scoreByPath.get(e.from) ?? 0);
    const cb = edgeColor(e.to,   scoreByPath.get(e.to)   ?? 0);
    lineColors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
  }

  if (linePositions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(lineColors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 });
    group.add(new THREE.LineSegments(geo, mat));
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

  return { group, nodeMeshes };
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
