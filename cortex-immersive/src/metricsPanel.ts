/**
 * Panneau de métriques 3D — plane + CanvasTexture, lisible en XR comme en desktop.
 * Affiche les métriques existantes du Scan sélectionné (aucun nouveau calcul).
 */

import * as THREE from 'three';
import type { Scan } from '@cortex/types';
import { classifyLayer, scoreColorHex, LAYER_LABELS } from '@cortex/utils';

const W = 512, H = 360;

export class MetricsPanel {
  readonly mesh: THREE.Mesh;
  private canvas:  HTMLCanvasElement;
  private texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55 * (H / W)), material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
  }

  showFor(scan: Scan, nodeWorldPos: THREE.Vector3, nodeRadius: number): void {
    this.draw(scan);
    this.mesh.visible = true;
    this.moveTo(nodeWorldPos, nodeRadius);
  }

  /** Repositionne le panneau sans redessiner (suivi du nœud à chaque frame). */
  moveTo(nodeWorldPos: THREE.Vector3, nodeRadius: number): void {
    if (!this.mesh.visible) return;
    this.mesh.position.copy(nodeWorldPos);
    this.mesh.position.y += nodeRadius + 0.28;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  /** Billboard : face à la caméra à chaque frame. */
  update(camera: THREE.Camera): void {
    if (this.mesh.visible) this.mesh.quaternion.copy(camera.quaternion);
  }

  private draw(scan: Scan): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    // Fond
    ctx.fillStyle = 'rgba(18, 18, 22, 0.92)';
    roundRect(ctx, 0, 0, W, H, 18);
    ctx.fill();

    const accent = scoreColorHex(scan.globalScore);
    ctx.fillStyle = accent;
    roundRect(ctx, 0, 0, W, 8, 4);
    ctx.fill();

    // Nom du fichier
    const name = scan.filePath.split('/').pop() ?? scan.filePath;
    ctx.fillStyle = '#e5e5ea';
    ctx.font = 'bold 28px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(truncate(ctx, name, W - 48), 24, 48);

    // Chemin + layer
    ctx.fillStyle = '#8e8e93';
    ctx.font = '17px -apple-system, Segoe UI, Roboto, sans-serif';
    const dir = scan.filePath.split('/').slice(-3, -1).join('/');
    ctx.fillText(truncate(ctx, `${dir}  ·  ${LAYER_LABELS[classifyLayer(scan.filePath)]}  ·  ${scan.language}`, W - 48), 24, 78);

    // Score global
    ctx.fillStyle = accent;
    ctx.font = 'bold 48px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(`${scan.globalScore.toFixed(1)}`, 24, 138);
    ctx.fillStyle = '#8e8e93';
    ctx.font = '17px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(`risk score  ${scan.trend}`, 150, 132);

    // Métriques existantes (valeurs brutes des analyzers)
    const rows: [string, string][] = [
      ['Complexity',  String(scan.rawComplexity)],
      ['Cognitive',   String(scan.rawCognitiveComplexity)],
      ['Fn size',     String(scan.rawFunctionSize)],
      ['Depth',       String(scan.rawDepth)],
      ['Params',      String(scan.rawParams)],
      ['Churn',       String(scan.rawChurn)],
      ['Fan in/out',  `${scan.fanIn} / ${scan.fanOut}`],
      ['Hotspot',     scan.hotspotScore.toFixed(1)],
    ];
    const col = (i: number) => (i % 2 === 0 ? 24 : W / 2 + 8);
    rows.forEach(([label, value], i) => {
      const y = 186 + Math.floor(i / 2) * 42;
      ctx.fillStyle = '#8e8e93';
      ctx.font = '16px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(label, col(i), y);
      ctx.fillStyle = '#e5e5ea';
      ctx.font = 'bold 20px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(value, col(i), y + 22);
    });

    this.texture.needsUpdate = true;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}
