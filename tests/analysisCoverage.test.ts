import { describe, expect, it } from 'vitest';
import {
    getAnalysisCoverageForExtension,
    summarizeProjectAnalysisCoverage,
} from '../src/cortex/coverage/analysisCoverage.js';

describe('analysis coverage', () => {
    it('classe .ts en analyse complete', () => {
        const coverage = getAnalysisCoverageForExtension('.ts');

        expect(coverage.level).toBe('complete');
        expect(coverage.metricCoverage).toBe('strong');
        expect(coverage.dependencyCoverage).toBe('strong');
    });

    it('classe .tsx en analyse complete avec une note JSX', () => {
        const coverage = getAnalysisCoverageForExtension('/project/src/App.tsx');

        expect(coverage.level).toBe('complete');
        expect(coverage.reasons.join(' ')).toContain('JSX');
    });

    it('classe .py en analyse partielle avec metriques fortes', () => {
        const coverage = getAnalysisCoverageForExtension('.py');

        expect(coverage.level).toBe('partial');
        expect(coverage.metricCoverage).toBe('strong');
        expect(coverage.dependencyCoverage).toBe('partial');
    });

    it('classe .swift en analyse partielle avec graphe approximatif', () => {
        const coverage = getAnalysisCoverageForExtension('.swift');

        expect(coverage.level).toBe('partial');
        expect(coverage.dependencyCoverage).toBe('approximate');
        expect(coverage.metricCoverage).toBe('approximate');
    });

    it('classe une extension inconnue en non analysee', () => {
        const coverage = getAnalysisCoverageForExtension('.css');

        expect(coverage.level).toBe('none');
        expect(coverage.functionCoverage).toBe('none');
        expect(coverage.dependencyCoverage).toBe('none');
    });

    it('calcule un resume coherent pour un projet mixte', () => {
        const summary = summarizeProjectAnalysisCoverage([
            { filePath: '/project/src/app.ts', language: 'typescript' },
            { filePath: '/project/src/App.tsx', language: 'typescript' },
            { filePath: '/project/server/main.py', language: 'python' },
            { filePath: '/project/ios/App.swift', language: 'swift' },
            { filePath: '/project/styles/app.css', language: 'unknown' },
        ]);

        expect(summary.level).toBe('partial');
        expect(summary.byLevel).toEqual({
            complete: 2,
            partial:  2,
            limited:  0,
            none:     1,
        });
        expect(summary.byLanguage).toMatchObject({
            typescript: 2,
            python:     1,
            swift:      1,
            unknown:    1,
        });
        expect(summary.languages).toContain('typescript');
        expect(summary.analyzedScopeNote).toContain('code analysé');
    });
});
