/**
 * Calculs de manipulation spatiale du graphe (grab une main / deux mains).
 * Fonctions pures — aucune dépendance Three.js/DOM/WebXR.
 * Testables indépendamment du rendu (même modèle que graphLayout.ts).
 *
 * Principe : au début d'un geste on capture une « baseline » (poses des
 * contrôleurs + transformation courante du groupe). À chaque frame, la
 * transformation est recalculée à partir de cette baseline et des poses
 * courantes. Aux poses de départ, le résultat est identique à la baseline
 * → aucune discontinuité au grab ni aux bascules une main ↔ deux mains
 * (le caller recapture simplement une baseline à chaque changement de mode).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }

/** Pose d'un contrôleur : position + orientation (quaternion unitaire). */
export interface Pose {
  position:    Vec3;
  orientation: Quat;
}

/** Transformation du groupe graphe : position, orientation, échelle uniforme. */
export interface GroupTransform {
  position:   Vec3;
  quaternion: Quat;
  scale:      number;
}

// Bornes d'échelle absolues du graphe (monde), pour éviter de le perdre
// en le rendant microscopique ou démesuré.
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;

// En-dessous de cette distance entre les deux mains (mètres), le ratio
// d'échelle devient numériquement instable → geste deux-mains dégénéré.
const MIN_HAND_DISTANCE = 1e-4;

// ── Algèbre vectorielle/quaternion minimale ──────────────────────────────────

const vAdd  = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vSub  = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vScale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vLen  = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const vDot  = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const vCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const vMid = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

const Q_IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** Produit de quaternions : (a ∘ b) applique b puis a. */
function qMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Conjugué = inverse pour un quaternion unitaire. */
const qConj = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

function qNormalize(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  if (n < 1e-12) return { ...Q_IDENTITY };
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

/** Rotation d'un vecteur par un quaternion unitaire (formule optimisée). */
function qRotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = { x: q.x, y: q.y, z: q.z };
  const t = vScale(vCross(u, v), 2);
  return vAdd(vAdd(v, vScale(t, q.w)), vCross(u, t));
}

/**
 * Quaternion de plus court arc amenant le vecteur unitaire `from` sur `to`.
 * Cas dégénéré (vecteurs opposés) : rotation de 180° autour d'un axe orthogonal.
 */
export function shortestArc(from: Vec3, to: Vec3): Quat {
  const d = vDot(from, to);
  if (d < -0.999999) {
    // 180° — n'importe quel axe orthogonal à `from` convient
    let axis = vCross({ x: 1, y: 0, z: 0 }, from);
    if (vLen(axis) < 1e-6) axis = vCross({ x: 0, y: 1, z: 0 }, from);
    const n = vLen(axis);
    return { x: axis.x / n, y: axis.y / n, z: axis.z / n, w: 0 };
  }
  const c = vCross(from, to);
  return qNormalize({ x: c.x, y: c.y, z: c.z, w: 1 + d });
}

// ── Gestes ────────────────────────────────────────────────────────────────────

/**
 * Grab une main : le groupe suit rigidement le contrôleur (translation +
 * rotation), comme s'il y était attaché au moment du squeeze. Échelle inchangée.
 *
 * Baseline : pose du contrôleur + transformation du groupe au squeezestart.
 */
export function oneHandGrabTransform(
  startController: Pose,
  startGroup:      GroupTransform,
  controller:      Pose,
): GroupTransform {
  // Offset du groupe exprimé dans le repère du contrôleur au moment du grab
  const invStart   = qConj(startController.orientation);
  const offsetPos  = qRotate(invStart, vSub(startGroup.position, startController.position));
  const offsetQuat = qMul(invStart, startGroup.quaternion);

  return {
    position:   vAdd(controller.position, qRotate(controller.orientation, offsetPos)),
    quaternion: qNormalize(qMul(controller.orientation, offsetQuat)),
    scale:      startGroup.scale,
  };
}

/**
 * Grab deux mains : échelle (ratio distance courante / distance initiale) +
 * rotation (plus court arc du vecteur main A → main B) + suivi du milieu.
 * L'ancre est le milieu des deux mains : le point du graphe tenu entre les
 * mains reste entre les mains pendant le zoom (pas de dérive).
 *
 * Baseline : positions des deux contrôleurs + transformation du groupe au
 * moment où le deuxième squeeze commence.
 */
export function twoHandGrabTransform(
  startA:     Vec3,
  startB:     Vec3,
  startGroup: GroupTransform,
  a:          Vec3,
  b:          Vec3,
): GroupTransform {
  const v0 = vSub(startB, startA);
  const v  = vSub(b, a);
  const d0 = vLen(v0);
  const d  = vLen(v);

  // Mains confondues → ratio/direction indéfinis : on ne suit que le milieu.
  if (d0 < MIN_HAND_DISTANCE || d < MIN_HAND_DISTANCE) {
    const drift = vSub(vMid(a, b), vMid(startA, startB));
    return {
      position:   vAdd(startGroup.position, drift),
      quaternion: startGroup.quaternion,
      scale:      startGroup.scale,
    };
  }

  // Échelle bornée en absolu (l'utilisateur ne peut pas « perdre » le graphe)
  const rawScale = startGroup.scale * (d / d0);
  const scale    = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
  const ratio    = scale / startGroup.scale;

  const rot = shortestArc(vScale(v0, 1 / d0), vScale(v, 1 / d));
  const m0  = vMid(startA, startB);
  const m   = vMid(a, b);

  return {
    position:   vAdd(m, vScale(qRotate(rot, vSub(startGroup.position, m0)), ratio)),
    quaternion: qNormalize(qMul(rot, startGroup.quaternion)),
    scale,
  };
}
