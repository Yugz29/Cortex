/**
 * Calcul de la pose « pupitre » du panneau de métriques.
 * Fonctions pures — aucune dépendance Three.js/DOM/WebXR.
 * Testables indépendamment du rendu (même modèle que graphManipulation.ts).
 *
 * À la sélection d'un nœud, le panneau est placé une seule fois : devant la
 * caméra, légèrement en contrebas de la ligne de regard, face à l'utilisateur.
 * Il reste ensuite fixe dans le repère monde — il ne suit ni la caméra, ni le
 * nœud, ni le graphe.
 */

import type { Vec3, Quat, Pose } from './graphManipulation';

export interface PanelPose {
  position:   Vec3;
  quaternion: Quat;
}

/** Distance horizontale devant la caméra (mètres) — portée de main. */
export const PANEL_DISTANCE = 0.55;
/** Décalage vertical sous la ligne de regard (mètres). */
export const PANEL_DROP = 0.18;

// ── Algèbre locale minimale (module volontairement autonome) ─────────────────

const vSub  = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vLen  = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const vCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

function vNormalize(a: Vec3): Vec3 {
  const n = vLen(a);
  return n < 1e-12 ? { x: 0, y: 0, z: 0 } : { x: a.x / n, y: a.y / n, z: a.z / n };
}

/** Rotation d'un vecteur par un quaternion unitaire. */
function qRotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = { x: q.x, y: q.y, z: q.z };
  const t: Vec3 = {
    x: 2 * (u.y * v.z - u.z * v.y),
    y: 2 * (u.z * v.x - u.x * v.z),
    z: 2 * (u.x * v.y - u.y * v.x),
  };
  return {
    x: v.x + q.w * t.x + (u.y * t.z - u.z * t.y),
    y: v.y + q.w * t.y + (u.z * t.x - u.x * t.z),
    z: v.z + q.w * t.z + (u.x * t.y - u.y * t.x),
  };
}

/**
 * Quaternion depuis une base orthonormée (colonnes x, y, z) — méthode de
 * Shepperd. La rotation envoie (1,0,0)→x, (0,1,0)→y, (0,0,1)→z.
 */
function quatFromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  const m00 = x.x, m01 = y.x, m02 = z.x;
  const m10 = x.y, m11 = y.y, m12 = z.y;
  const m20 = x.z, m21 = y.z, m22 = z.z;
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return { w: 0.25 / s, x: (m21 - m12) * s, y: (m02 - m20) * s, z: (m10 - m01) * s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

// ── Pose du pupitre ───────────────────────────────────────────────────────────

/**
 * Pose du panneau à partir de la pose caméra au moment de la sélection.
 *
 * Position : `distance` mètres devant la caméra le long de la projection
 * HORIZONTALE du regard (le pitch de la tête n'influe pas sur le placement),
 * `drop` mètres sous la hauteur des yeux.
 *
 * Orientation : le panneau (normale locale +Z) fait face aux yeux de
 * l'utilisateur, droit (sans roll) — étant sous la ligne de regard, il se
 * retrouve naturellement incliné vers le haut, comme un pupitre.
 */
export function panelPoseFor(camera: Pose, distance = PANEL_DISTANCE, drop = PANEL_DROP): PanelPose {
  // Direction horizontale du regard
  const forward = qRotate(camera.orientation, { x: 0, y: 0, z: -1 });
  let h: Vec3 = { x: forward.x, y: 0, z: forward.z };
  if (vLen(h) < 1e-6) {
    // Regard vertical (haut/bas) : direction horizontale indéfinie → on prend
    // le "haut" de la tête projeté au sol, qui pointe là où le corps fait face.
    const up = qRotate(camera.orientation, { x: 0, y: 1, z: 0 });
    h = { x: up.x, y: 0, z: up.z };
    if (vLen(h) < 1e-6) h = { x: 0, y: 0, z: -1 };
  }
  h = vNormalize(h);

  const position: Vec3 = {
    x: camera.position.x + h.x * distance,
    y: camera.position.y - drop,
    z: camera.position.z + h.z * distance,
  };

  // Normale du panneau : vers les yeux (lookAt inversé, up monde, sans roll)
  const z = vNormalize(vSub(camera.position, position));
  let xAxis = vCross({ x: 0, y: 1, z: 0 }, z);
  if (vLen(xAxis) < 1e-6) xAxis = { x: 1, y: 0, z: 0 };   // face à la verticale pure
  const xN = vNormalize(xAxis);
  const yN = vCross(z, xN);

  return { position, quaternion: quatFromBasis(xN, yN, z) };
}
