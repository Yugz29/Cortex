import { describe, it, expect } from 'vitest';
import {
  oneHandGrabTransform, twoHandGrabTransform, shortestArc,
  MIN_SCALE, MAX_SCALE,
  type Pose, type GroupTransform, type Vec3, type Quat,
} from '../cortex-immersive/src/graphManipulation';

const Q_ID: Quat = { x: 0, y: 0, z: 0, w: 1 };
// Rotation de 90° autour de Y : +X → -Z
const Q_Y90: Quat = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const pose = (p: Vec3, q: Quat = Q_ID): Pose => ({ position: p, orientation: q });
const group = (p: Vec3, q: Quat = Q_ID, scale = 1): GroupTransform => ({ position: p, quaternion: q, scale });

function expectVec(actual: Vec3, expected: Vec3, digits = 6): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

function quatNorm(q: Quat): number {
  return Math.hypot(q.x, q.y, q.z, q.w);
}

/** Applique la transformation d'un groupe à un point local → point monde. */
function applyToPoint(t: GroupTransform, local: Vec3): Vec3 {
  const q = t.quaternion;
  const u = { x: q.x, y: q.y, z: q.z };
  const s = { x: local.x * t.scale, y: local.y * t.scale, z: local.z * t.scale };
  const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const tv = cross(u, s);
  const rotated = {
    x: s.x + 2 * (q.w * tv.x + (u.y * tv.z - u.z * tv.y)),
    y: s.y + 2 * (q.w * tv.y + (u.z * tv.x - u.x * tv.z)),
    z: s.z + 2 * (q.w * tv.z + (u.x * tv.y - u.y * tv.x)),
  };
  return { x: rotated.x + t.position.x, y: rotated.y + t.position.y, z: rotated.z + t.position.z };
}

describe('oneHandGrabTransform', () => {
  it('est continue au moment du grab (poses de départ → transformation inchangée)', () => {
    const start = pose(v(0.2, 1.3, -0.4), Q_Y90);
    const g     = group(v(0, 1.4, -1.6), Q_Y90, 2.5);
    const out   = oneHandGrabTransform(start, g, start);
    expectVec(out.position, g.position);
    expectVec({ x: out.quaternion.x, y: out.quaternion.y, z: out.quaternion.z }, { x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z });
    expect(out.scale).toBe(2.5);
  });

  it('suit une translation pure du contrôleur', () => {
    const g   = group(v(0, 1.4, -1.6));
    const out = oneHandGrabTransform(pose(v(0, 1, 0)), g, pose(v(0.5, 1.2, -0.3)));
    expectVec(out.position, v(0.5, 1.6, -1.9));
    expect(out.quaternion).toEqual(Q_ID);
    expect(out.scale).toBe(1);
  });

  it('fait orbiter le groupe autour du contrôleur quand celui-ci tourne', () => {
    // Contrôleur à l'origine, groupe 2 m devant (-Z). Rotation de 90° autour de Y :
    // -Z → -X, le groupe doit passer à (-2, 0, 0) et porter la rotation.
    const g   = group(v(0, 0, -2));
    const out = oneHandGrabTransform(pose(v(0, 0, 0), Q_ID), g, pose(v(0, 0, 0), Q_Y90));
    expectVec(out.position, v(-2, 0, 0));
    expect(out.quaternion.y).toBeCloseTo(Q_Y90.y, 6);
    expect(out.quaternion.w).toBeCloseTo(Q_Y90.w, 6);
  });

  it('ne modifie jamais l’échelle', () => {
    const out = oneHandGrabTransform(pose(v(0, 0, 0)), group(v(0, 0, 0), Q_ID, 0.7), pose(v(3, 2, 1), Q_Y90));
    expect(out.scale).toBe(0.7);
  });
});

describe('twoHandGrabTransform', () => {
  it('est continue au moment du grab (mains immobiles → transformation inchangée)', () => {
    const a = v(-0.3, 1.2, -0.5), b = v(0.3, 1.2, -0.5);
    const g = group(v(0, 1.4, -1.6), Q_Y90, 1.8);
    const out = twoHandGrabTransform(a, b, g, a, b);
    expectVec(out.position, g.position);
    expect(out.scale).toBeCloseTo(1.8, 6);
    expect(out.quaternion.y).toBeCloseTo(Q_Y90.y, 6);
  });

  it('met à l’échelle selon le ratio des distances entre mains', () => {
    const g = group(v(0, 1, 0));
    // Mains écartées ×2 symétriquement autour du même milieu
    const out = twoHandGrabTransform(v(-0.2, 1, 0), v(0.2, 1, 0), g, v(-0.4, 1, 0), v(0.4, 1, 0));
    expect(out.scale).toBeCloseTo(2, 6);
  });

  it('ancre le zoom au milieu des mains : le point tenu ne dérive pas', () => {
    const a0 = v(-0.2, 1, -1), b0 = v(0.2, 1, -1);
    const g  = group(v(0.5, 1.4, -1.6), Q_ID, 1);
    // Point du graphe (local) qui se trouve exactement au milieu des mains
    const heldLocal = v(-0.5, -0.4, 0.6);
    expectVec(applyToPoint(g, heldLocal), v(0, 1, -1));

    const out = twoHandGrabTransform(a0, b0, g, v(-0.6, 1, -1), v(0.6, 1, -1));
    // Milieu inchangé → le même point local doit rester au milieu des mains
    expectVec(applyToPoint(out, heldLocal), v(0, 1, -1));
    expect(out.scale).toBeCloseTo(3, 6);
  });

  it('suit la translation du milieu des deux mains', () => {
    const g   = group(v(0, 1.4, -1.6));
    const out = twoHandGrabTransform(v(-0.2, 1, 0), v(0.2, 1, 0), g, v(-0.2, 1.3, -0.4), v(0.2, 1.3, -0.4));
    expectVec(out.position, v(0, 1.7, -2.0));
    expect(out.scale).toBeCloseTo(1, 6);
  });

  it('tourne le groupe quand le vecteur main A → main B tourne', () => {
    const g = group(v(0, 1, 0));
    // Vecteur A→B initialement sur +X, tourné vers -Z (rotation de 90° autour de Y)
    const out = twoHandGrabTransform(v(-0.3, 1, 0), v(0.3, 1, 0), g, v(0, 1, 0.3), v(0, 1, -0.3));
    expect(out.quaternion.y).toBeCloseTo(Q_Y90.y, 6);
    expect(out.quaternion.w).toBeCloseTo(Q_Y90.w, 6);
    expect(out.scale).toBeCloseTo(1, 6);
  });

  it('borne l’échelle à [MIN_SCALE, MAX_SCALE]', () => {
    const g = group(v(0, 0, 0));
    const huge = twoHandGrabTransform(v(-0.001, 0, 0), v(0.001, 0, 0), g, v(-10, 0, 0), v(10, 0, 0));
    expect(huge.scale).toBe(MAX_SCALE);
    const tiny = twoHandGrabTransform(v(-10, 0, 0), v(10, 0, 0), g, v(-0.001, 0, 0), v(0.001, 0, 0));
    expect(tiny.scale).toBe(MIN_SCALE);
  });

  it('reste défini quand les mains sont confondues (pas de NaN)', () => {
    const g   = group(v(0, 1, -1), Q_Y90, 2);
    const out = twoHandGrabTransform(v(0, 1, 0), v(0, 1, 0), g, v(0.1, 1.1, 0), v(0.1, 1.1, 0));
    // Dégénéré : suit uniquement le milieu, rotation/échelle inchangées
    expectVec(out.position, v(0.1, 1.1, -1));
    expect(out.scale).toBe(2);
    expect(Number.isNaN(out.quaternion.w)).toBe(false);
  });

  it('reste défini pour un demi-tour complet (vecteurs opposés)', () => {
    const g   = group(v(0, 1, 0));
    const out = twoHandGrabTransform(v(-0.3, 1, 0), v(0.3, 1, 0), g, v(0.3, 1, 0), v(-0.3, 1, 0));
    expect(quatNorm(out.quaternion)).toBeCloseTo(1, 6);
    expect(Number.isNaN(out.position.x)).toBe(false);
  });
});

describe('shortestArc', () => {
  it('renvoie l’identité pour deux vecteurs identiques', () => {
    const q = shortestArc(v(0, 0, -1), v(0, 0, -1));
    expect(q.w).toBeCloseTo(1, 6);
  });

  it('renvoie un quaternion unitaire pour des vecteurs opposés', () => {
    const q = shortestArc(v(1, 0, 0), v(-1, 0, 0));
    expect(quatNorm(q)).toBeCloseTo(1, 6);
    expect(q.w).toBeCloseTo(0, 6);
  });
});
