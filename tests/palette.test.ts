import { describe, it, expect } from 'vitest';
import { statusColorHex, STATUS_COLOR_REMAP } from '../cortex-immersive/src/palette';
import { scoreColorHex } from '../src/app/renderer/utils';

describe('statusColorHex', () => {
  it('sain (< 20) → #0ca30c', () => {
    expect(statusColorHex(0)).toBe('#0ca30c');
    expect(statusColorHex(19.9)).toBe('#0ca30c');
  });

  it('attention (>= 20, < 50) → #fab219', () => {
    expect(statusColorHex(20)).toBe('#fab219');
    expect(statusColorHex(49.9)).toBe('#fab219');
  });

  it('critique (>= 50) → #d03b3b', () => {
    expect(statusColorHex(50)).toBe('#d03b3b');
    expect(statusColorHex(100)).toBe('#d03b3b');
  });

  it('réutilise exactement les seuils de scoreColorHex (aucune logique parallèle)', () => {
    // Pour tout score, la catégorie vient de scoreColorHex : le remap doit
    // couvrir chacune de ses sorties possibles, et rien d'autre.
    for (const score of [0, 5, 19.99, 20, 35, 49.99, 50, 80, 100]) {
      const base = scoreColorHex(score);
      expect(STATUS_COLOR_REMAP[base]).toBeDefined();
      expect(statusColorHex(score)).toBe(STATUS_COLOR_REMAP[base]);
    }
  });
});
