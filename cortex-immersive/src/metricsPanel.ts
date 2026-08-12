/**
 * Panneau de métriques 3D — plane + CanvasTexture, lisible en XR comme en desktop.
 * Affiche les métriques existantes du Scan sélectionné (aucun nouveau calcul).
 *
 * Comportement « pupitre » : posé une seule fois à la sélection (pose calculée
 * par panelPlacement.ts depuis la caméra), puis fixe dans le repère monde —
 * il ne suit ni la caméra, ni le nœud, ni le graphe.
 */

import * as THREE from 'three';
import type { Scan } from '@cortex/types';
import { classifyLayer, scoreColorHex, LAYER_LABELS } from '@cortex/utils';
import type { PanelPose } from './panelPlacement';

const W = 512, H = 360;
const PANEL_W = 0.55;
const PANEL_H = PANEL_W * (H / W);

export class MetricsPanel {
  readonly mesh: THREE.Mesh;
  /** Barre de préhension sous le panneau (cible de raycast du drag).
   *  Enfant de `mesh` : elle suit le panneau et partage sa visibilité.
   *  Le plane est plus grand que la barre dessinée → zone de visée confortable. */
  readonly handle: THREE.Mesh;
  /** Bouton d'ancrage (pin) à droite de la barre — toggle au select.
   *  Ancré : la sélection d'un nœud ne met à jour que le contenu, plus la pose. */
  readonly pinButton: THREE.Mesh;
  private canvas:  HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private pinCanvas:  HTMLCanvasElement;
  private pinTexture: THREE.CanvasTexture;
  private _pinned = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;

    this.handle = MetricsPanel.buildHandle();
    this.handle.position.set(0, -(PANEL_H / 2) - 0.042, 0);
    this.mesh.add(this.handle);

    this.pinCanvas = document.createElement('canvas');
    this.pinCanvas.width = 64; this.pinCanvas.height = 64;
    this.pinTexture = new THREE.CanvasTexture(this.pinCanvas);
    this.pinButton = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.06),
      new THREE.MeshBasicMaterial({ map: this.pinTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.pinButton.renderOrder = 10;
    this.pinButton.position.set(0.175, -(PANEL_H / 2) - 0.042, 0);
    this.mesh.add(this.pinButton);
    this.drawPin();
  }

  /** État courant de l'ancrage. */
  get pinned(): boolean {
    return this._pinned;
  }

  /** Bascule l'ancrage et met à jour le visuel du bouton. */
  togglePin(): void {
    this._pinned = !this._pinned;
    this.drawPin();
  }

  private drawPin(): void {
    const ctx = this.pinCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, 2 * Math.PI);
    ctx.fillStyle = this._pinned ? '#34c759' : 'rgba(72, 72, 78, 0.92)';
    ctx.fill();
    ctx.font = '30px -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('📌', 32, 34);
    this.pinTexture.needsUpdate = true;
  }

  /** Fine barre horizontale style fenêtre Quest, dessinée au centre d'un plane
   *  transparent plus large qui sert de zone de hit pour le rayon. */
  private static buildHandle(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#aeaeb2';
    ctx.globalAlpha = 0.95;
    const bw = 150, bh = 13, r = bh / 2;
    const x = (256 - bw) / 2, y = (64 - bh) / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + bw, y, x + bw, y + bh, r);
    ctx.arcTo(x + bw, y + bh, x, y + bh, r);
    ctx.arcTo(x, y + bh, x, y, r);
    ctx.arcTo(x, y, x + bw, y, r);
    ctx.closePath();
    ctx.fill();
    const material = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const handle = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.065), material);
    handle.renderOrder = 10;
    return handle;
  }

  /** Met à jour le contenu (métriques du Scan) et rend le panneau visible —
   *  sans toucher à sa pose. */
  setScan(scan: Scan): void {
    this.draw(scan);
    this.mesh.visible = true;
  }

  /** Place le panneau à la pose « pupitre » donnée (position + orientation). */
  placeAt(pose: PanelPose): void {
    this.mesh.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.mesh.quaternion.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w);
  }

  hide(): void {
    this.mesh.visible = false;
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
