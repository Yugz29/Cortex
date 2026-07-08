import { describe, expect, it } from 'vitest';
import { translate, type TranslationKey } from '../src/app/renderer/i18n.js';
import { formatPressureDegrading, formatPressureImproving, generateSummary } from '../src/app/renderer/overviewSummary.js';
import type { Scan } from '../src/app/renderer/types.js';

const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(key, 'fr', vars);

function scan(overrides: Partial<Scan> = {}): Scan {
    return {
        filePath: 'src/file.ts',
        globalScore: 25,
        hotspotScore: 0,
        complexityScore: 0,
        cognitiveComplexityScore: 0,
        functionSizeScore: 0,
        churnScore: 0,
        depthScore: 0,
        paramScore: 0,
        fanIn: 0,
        fanOut: 0,
        language: 'typescript',
        trend: '↔',
        scannedAt: '2026-01-01T00:00:00.000Z',
        rawComplexity: 0,
        rawCognitiveComplexity: 0,
        rawFunctionSize: 0,
        rawDepth: 0,
        rawParams: 0,
        rawChurn: 0,
        ...overrides,
    };
}

describe('overviewSummary', () => {
    it('formate les fichiers sous pression en amélioration en français', () => {
        expect(formatPressureImproving(1, t)).toBe('1 fichier sous pression est en amélioration.');
        expect(formatPressureImproving(2, t)).toBe('2 fichiers sous pression sont en amélioration.');
    });

    it('formate les fichiers sous pression qui se dégradent en français', () => {
        expect(formatPressureDegrading(1, t)).toBe('1 fichier sous pression se dégrade.');
        expect(formatPressureDegrading(2, t)).toBe('2 fichiers sous pression se dégradent.');
    });

    it('génère un résumé Overview sans concaténation bancale', () => {
        const stressed = [scan({ trend: '↓' })];

        expect(generateSummary(stressed, [], stressed, 25, t)).toBe(
            '1 fichier sous pression est en amélioration. La pression de maintenance globale est modérée.',
        );
    });

    it('ne qualifie pas de sous pression les fichiers en faible pression', () => {
        const healthy = [scan({ globalScore: 10, trend: '↓' })];

        expect(generateSummary(healthy, [], [], 10, t)).toBe(
            'Les 1 modules sont dans une plage de faible pression. 1 fichier est en amélioration.',
        );
    });
});
