import { describe, it, expect } from 'vitest';
import { panelPoseFor, PANEL_DISTANCE, PANEL_DROP, type PanelPose } from '../cortex-immersive/src/panelPlacement';
import type { Pose, Vec3, Quat } from '../cortex-immersive/src/graphManipulation';

const Q_ID: Quat = { x: 0, y: 0, z: 0, w: 1 };
// 90° autour de Y : -Z → -X
const Q_Y90: Quat = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
// 45° autour de X (pitch vers le bas quand appliqué à -Z)
const Q_X45_DOWN: Quat = { x: -Math.sin(Math.PI / 8), y: 0, z: 0, w: Math.cos(Math.PI / 8) };
// 90° autour de X : -Z → -Y (regard plein bas)
const Q_X90_DOWN: Quat = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const cam = (p: Vec3, q: Quat = Q_ID): Pose => ({ position: p, orientation: q });

function expectVec(actual: Vec3, expected: Vec3, digits = 6): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

/** Rotation d'un vecteur par le quaternion d'une pose (référence de test). */
function rotate(q: Quat, vec: Vec3): Vec3 {
  const u = { x: q.x, y: q.y, z: q.z };
  const t = {
    x: 2 * (u.y * vec.z - u.z * vec.y),
    y: 2 * (u.z * vec.x - u.x * vec.z),
    z: 2 * (u.x * vec.y - u.y * vec.x),
  };
  return {
    x: vec.x + q.w * t.x + (u.y * t.z - u.z * t.y),
    y: vec.y + q.w * t.y + (u.z * t.x - u.x * t.z),
    z: vec.z + q.w * t.z + (u.x * t.y - u.y * t.x),
  };
}

function normalize(a: Vec3): Vec3 {
  const n = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

/** La normale du panneau (+Z local) doit viser les yeux, et le panneau être droit. */
function expectFacesEyes(pose: PanelPose, eye: Vec3): void {
  const normal   = rotate(pose.quaternion, v(0, 0, 1));
  const toEye    = normalize({ x: eye.x - pose.position.x, y: eye.y - pose.position.y, z: eye.z - pose.position.z });
  expectVec(normal, toEye);
  // Pas de roll : l'axe X local du panneau reste horizontal
  expect(rotate(pose.quaternion, v(1, 0, 0)).y).toBeCloseTo(0, 6);
}

describe('panelPoseFor', () => {
  it('place le pupitre devant et sous la ligne de regard (caméra identité)', () => {
    const pose = panelPoseFor(cam(v(0, 1.6, 0)));
    expectVec(pose.position, v(0, 1.6 - PANEL_DROP, -PANEL_DISTANCE));
    expectFacesEyes(pose, v(0, 1.6, 0));
  });

  it('suit le yaw de la caméra', () => {
    const pose = panelPoseFor(cam(v(2, 1.6, -3), Q_Y90));
    // Regard vers -X → pupitre à distance sur -X
    expectVec(pose.position, v(2 - PANEL_DISTANCE, 1.6 - PANEL_DROP, -3));
    expectFacesEyes(pose, v(2, 1.6, -3));
  });

  it('ignore le pitch : tête penchée ou droite, même placement', () => {
    const eye     = v(0, 1.6, 0);
    const level   = panelPoseFor(cam(eye));
    const pitched = panelPoseFor(cam(eye, Q_X45_DOWN));
    expectVec(pitched.position, level.position);
  });

  it('respecte distance et drop passés en paramètres', () => {
    const pose = panelPoseFor(cam(v(0, 1.6, 0)), 0.4, 0.1);
    expectVec(pose.position, v(0, 1.5, -0.4));
    const dx = pose.position.x, dz = pose.position.z + 0.4;
    expect(Math.hypot(dx, dz)).toBeCloseTo(0, 6);
  });

  it('est orienté face aux yeux avec une inclinaison type pupitre', () => {
    const pose   = panelPoseFor(cam(v(0, 1.6, 0)));
    const normal = rotate(pose.quaternion, v(0, 0, 1));
    // Normale vers l'utilisateur (+Z ici) ET vers le haut (panneau incliné)
    expect(normal.z).toBeGreaterThan(0);
    expect(normal.y).toBeGreaterThan(0);
  });

  it('reste défini quand le regard est vertical (pas de NaN, quaternion unitaire)', () => {
    const pose = panelPoseFor(cam(v(0, 1.6, 0), Q_X90_DOWN));
    for (const val of [pose.position.x, pose.position.y, pose.position.z,
                       pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w]) {
      expect(Number.isFinite(val)).toBe(true);
    }
    expect(Math.hypot(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)).toBeCloseTo(1, 6);
    // Toujours à portée : distance horizontale = PANEL_DISTANCE
    expect(Math.hypot(pose.position.x, pose.position.z)).toBeCloseTo(PANEL_DISTANCE, 6);
    expect(pose.position.y).toBeCloseTo(1.6 - PANEL_DROP, 6);
  });

  it('renvoie toujours un quaternion unitaire (yaw arbitraire)', () => {
    for (const angle of [0.3, 1.1, 2.4, 4.0, 5.7]) {
      const q: Quat = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
      const pose = panelPoseFor(cam(v(1, 1.5, 2), q));
      expect(Math.hypot(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)).toBeCloseTo(1, 6);
      expectFacesEyes(pose, v(1, 1.5, 2));
    }
  });
});
