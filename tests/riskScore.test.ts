import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
// getReferenceBaselines + getLanguageMultipliers : baselines/multiplicateurs neutres
vi.mock('../src/cortex/risk-score/referenceBaselines.js', () => ({
    getReferenceBaselines: () => ({
        complexity:          { p25: 3,  p90: 12 },
        complexityMean:      { p25: 2,  p90: 6  },
        cognitiveComplexity: { p25: 4,  p90: 30 },
        functionSize:        { p25: 15, p90: 60 },
        functionSizeMean:    { p25: 8,  p90: 30 },
        depth:               { p25: 1,  p90: 4  },
        params:              { p25: 2,  p90: 5  },
        churn:               { p25: 1,  p90: 10 },
        fanIn:               { p25: 1,  p90: 10 },
    }),
    getLanguageMultipliers: () => ({
        complexity: 1, cognitiveComplexity: 1, functionSize: 1,
        depth: 1, churn: 1, params: 1, fanIn: 1,
    }),
}));

// getChurnScore est async — on le mock pour qu'il retourne 0 par défaut
vi.mock('../src/cortex/analyzer/churn.js', () => ({
    getChurnScore: vi.fn().mockResolvedValue(0),
}));

import {
    clampedScore,
    scoreFromRaw,
    computeProjectBaselines,
} from '../src/cortex/risk-score/riskScore.js';
import type { RawMetrics } from '../src/cortex/risk-score/riskScore.js';

// ── Helper : RawMetrics minimal (toutes métriques à 0) ──
function makeRaw(overrides: Partial<RawMetrics> = {}): RawMetrics {
    return {
        complexity:          0,
        complexityMean:      0,
        cognitiveComplexity: 0,
        functionSize:        0,
        functionSizeMean:    0,
        depth:               0,
        params:              0,
        churn:               0,
        fanIn:               0,
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('clampedScore', () => {

    it('retourne 0 en-dessous du seuil safe', () => {
        expect(clampedScore(2, 3, 15)).toBe(0);
    });

    it('retourne 100 au-dessus du seuil danger', () => {
        expect(clampedScore(20, 3, 15)).toBe(100);
    });

    it('interpole linéairement entre safe et danger', () => {
        expect(clampedScore(9, 3, 15)).toBeCloseTo(50);
    });

    it('retourne 0 exactement au seuil safe', () => {
        expect(clampedScore(3, 3, 15)).toBe(0);
    });

    it('retourne 100 exactement au seuil danger', () => {
        expect(clampedScore(15, 3, 15)).toBe(100);
    });

    it('gere safe >= danger sans crash', () => {
        expect(clampedScore(15, 10, 5)).toBe(100);
        expect(clampedScore(5,  10, 5)).toBe(0);
        expect(clampedScore(3,  10, 5)).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scoreFromRaw — fichier sans fonctions (all metrics = 0)', () => {

    it('globalScore = 0 quand toutes les métriques sont à 0', () => {
        const result = scoreFromRaw(makeRaw(), '/src/utils.ts', 'typescript');
        expect(result.globalScore).toBe(0);
    });

    it('hotspotScore = 0 quand complexity = 0 ou churn = 0', () => {
        const result = scoreFromRaw(makeRaw(), '/src/utils.ts', 'typescript');
        expect(result.hotspotScore).toBe(0);
    });

    it('details.fanInScore = 0 quand fanIn = 0', () => {
        const result = scoreFromRaw(makeRaw(), '/src/utils.ts', 'typescript');
        expect(result.details.fanInScore).toBe(0);
    });

    it('aucun crash sur un fichier sans fonctions', () => {
        expect(() => scoreFromRaw(makeRaw(), '/src/empty.ts', 'typescript')).not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scoreFromRaw — fanIn dans le score global', () => {

    it('fanIn élevé augmente le globalScore', () => {
        const low  = scoreFromRaw(makeRaw({ fanIn: 0 }),  '/src/a.ts', 'typescript');
        const high = scoreFromRaw(makeRaw({ fanIn: 20 }), '/src/a.ts', 'typescript');
        expect(high.globalScore).toBeGreaterThan(low.globalScore);
    });

    it('fanInScore est dans [0, 100]', () => {
        const res = scoreFromRaw(makeRaw({ fanIn: 5 }), '/src/a.ts', 'typescript');
        expect(res.details.fanInScore).toBeGreaterThanOrEqual(0);
        expect(res.details.fanInScore).toBeLessThanOrEqual(100);
    });

    it('fanIn = 0 → fanInScore = 0', () => {
        const res = scoreFromRaw(makeRaw({ fanIn: 0 }), '/src/a.ts', 'typescript');
        expect(res.details.fanInScore).toBe(0);
    });

    it('fanIn = 15 → fanInScore = 100 (seuil danger)', () => {
        const res = scoreFromRaw(makeRaw({ fanIn: 15 }), '/src/a.ts', 'typescript');
        expect(res.details.fanInScore).toBe(100);
    });

    it('toutes métriques au danger → globalScore > 90', () => {
        const res = scoreFromRaw(makeRaw({
            complexity: 15, complexityMean: 8, cognitiveComplexity: 60,
            functionSize: 80, functionSizeMean: 40, depth: 6,
            params: 8, churn: 20, fanIn: 15,
        }), '/src/a.ts', 'typescript');
        expect(res.globalScore).toBeGreaterThan(90);
        expect(res.details.fanInScore).toBe(100);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scoreFromRaw — hotspotScore', () => {

    it('hotspotScore = complexity × churn clampé à [0, 150]', () => {
        const res = scoreFromRaw(makeRaw({ complexity: 10, churn: 5 }), '/src/a.ts', 'typescript');
        expect(res.hotspotScore).toBe(50);
    });

    it('hotspotScore est clampé à 150 max', () => {
        const res = scoreFromRaw(makeRaw({ complexity: 20, churn: 20 }), '/src/a.ts', 'typescript');
        expect(res.hotspotScore).toBe(150);
    });

    it('hotspotScore = 0 si churn = 0', () => {
        const res = scoreFromRaw(makeRaw({ complexity: 10, churn: 0 }), '/src/a.ts', 'typescript');
        expect(res.hotspotScore).toBe(0);
    });

    it('hotspotScore = 0 si complexity = 0', () => {
        const res = scoreFromRaw(makeRaw({ complexity: 0, churn: 10 }), '/src/a.ts', 'typescript');
        expect(res.hotspotScore).toBe(0);
    });

    it('hotspotScore symétrique : cx*churn = churn*cx', () => {
        const a = scoreFromRaw(makeRaw({ complexity: 10, churn: 6 }), '/a.ts', 'typescript');
        const b = scoreFromRaw(makeRaw({ complexity: 6,  churn: 10 }), '/b.ts', 'typescript');
        expect(a.hotspotScore).toBe(b.hotspotScore);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeProjectBaselines', () => {

    it('calcule les percentiles correctement sur un jeu simple', () => {
        const raws: RawMetrics[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v =>
            makeRaw({ complexity: v })
        );
        const baselines = computeProjectBaselines(raws);
        expect(baselines.complexity.p25).toBe(3);
        expect(baselines.complexity.p90).toBe(9);
    });

    it('gère un tableau vide sans crash', () => {
        expect(() => computeProjectBaselines([])).not.toThrow();
    });

    it('un seul fichier → p25 = p90 = la valeur du fichier', () => {
        const baselines = computeProjectBaselines([makeRaw({ churn: 7 })]);
        expect(baselines.churn.p25).toBe(7);
        expect(baselines.churn.p90).toBe(7);
    });

    it('inclut fanIn dans les baselines', () => {
        const raws = [makeRaw({ fanIn: 2 }), makeRaw({ fanIn: 5 }), makeRaw({ fanIn: 10 })];
        const baselines = computeProjectBaselines(raws);
        expect(baselines.fanIn).toBeDefined();
        expect(baselines.fanIn.p90).toBeGreaterThanOrEqual(baselines.fanIn.p25);
    });
});


