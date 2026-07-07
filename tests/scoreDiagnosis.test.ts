import { describe, it, expect } from 'vitest';
import { diagnoseScore } from '../src/cortex/diagnostics/scoreDiagnosis.js';

describe('diagnoseScore', () => {
    it('detecte un fichier complexe mais stable', () => {
        const d = diagnoseScore({
            cognitiveComplexityScore: 72,
            functionSizeScore: 65,
            depthScore: 48,
            churnScore: 0,
            hotspotScore: 0,
            fanIn: 1,
            fanOut: 1,
            trend: '↔',
        });

        expect(d.family).toBe('structural-load');
        expect(d.profile).toBe('complex-but-stable');
        expect(d.label).toBe('Complexe mais stable');
        expect(d.summary).toBe('Ce fichier ressort surtout par sa charge structurelle. Son activité récente semble limitée.');
        expect(d.dominantSignal?.metric).toBe('cognitiveComplexityScore');
        expect(d.reasons).toHaveLength(3);
    });

    it('detecte un hotspot prioritaire quand structure et changement sont forts', () => {
        const d = diagnoseScore({
            complexityScore: 68,
            cognitiveComplexityScore: 62,
            churnScore: 75,
            hotspotScore: 120,
            trend: '↑',
        });

        expect(d.family).toBe('change-pressure');
        expect(d.profile).toBe('hotspot-priority');
        expect(d.label).toBe('Hotspot à relire');
        expect(d.reasons.some(r => r.metric === 'hotspotScore')).toBe(true);
    });

    it('detecte un fichier volatile mais simple', () => {
        const d = diagnoseScore({
            complexityScore: 0,
            cognitiveComplexityScore: 12,
            functionSizeScore: 8,
            churnScore: 82,
            hotspotScore: 0,
        });

        expect(d.family).toBe('change-pressure');
        expect(d.profile).toBe('volatile-but-simple');
        expect(d.label).toBe('Volatile mais simple');
        expect(d.dominantSignal?.metric).toBe('churnScore');
        expect(d.dominantSignal?.label).toBe('Activité récente élevée');
    });

    it('detecte un fichier a fort impact de dependance', () => {
        const d = diagnoseScore({
            complexityScore: 12,
            churnScore: 4,
            fanIn: 12,
            fanOut: 2,
        });

        expect(d.family).toBe('dependency-impact');
        expect(d.profile).toBe('high-impact');
        expect(d.label).toBe('Impact dépendances');
        expect(d.dominantSignal?.metric).toBe('fanIn');
    });

    it('retourne low-pressure quand aucun signal ne depasse le seuil', () => {
        const d = diagnoseScore({
            complexityScore: 8,
            cognitiveComplexityScore: 10,
            functionSizeScore: 5,
            depthScore: 0,
            paramScore: 0,
            churnScore: 0,
            hotspotScore: 0,
            fanIn: 0,
            fanOut: 1,
        });

        expect(d.family).toBe('low-pressure');
        expect(d.profile).toBe('low-pressure');
        expect(d.label).toBe('Faible pression');
        expect(d.dominantSignal).toBeNull();
        expect(d.reasons).toHaveLength(0);
    });

    it('accepte une forme compatible RiskScoreResult.details', () => {
        const d = diagnoseScore({
            hotspotScore: 0,
            details: {
                complexityScore: 70,
                cognitiveComplexityScore: 20,
                functionSizeScore: 0,
                depthScore: 0,
                paramScore: 0,
                churnScore: 0,
                fanIn: 0,
                fanOut: 0,
            },
        });

        expect(d.family).toBe('structural-load');
        expect(d.dominantSignal?.metric).toBe('complexityScore');
    });
});
