import { describe, it, expect } from 'vitest';
import { diagnoseFunction } from '../src/cortex/diagnostics/functionDiagnosis.js';

describe('diagnoseFunction', () => {
    it('detecte une fonction tres cognitive', () => {
        const d = diagnoseFunction({
            line_count: 32,
            cyclomatic_complexity: 8,
            cognitive_complexity: 38,
            parameter_count: 2,
            max_depth: 3,
        });

        expect(d.family).toBe('readability-load');
        expect(d.profile).toBe('hard-to-read');
        expect(d.label).toBe('Difficile à lire');
        expect(d.reasons[0]?.metric).toBe('cognitive_complexity');
    });

    it('detecte une fonction longue', () => {
        const d = diagnoseFunction({
            line_count: 105,
            cyclomatic_complexity: 4,
            cognitive_complexity: 8,
            parameter_count: 2,
            max_depth: 1,
        });

        expect(d.family).toBe('size-load');
        expect(d.profile).toBe('long-function');
        expect(d.label).toBe('Fonction longue');
        expect(d.reasons[0]?.metric).toBe('line_count');
    });

    it('detecte une fonction tres imbriquee', () => {
        const d = diagnoseFunction({
            line_count: 28,
            cyclomatic_complexity: 7,
            cognitive_complexity: 12,
            parameter_count: 1,
            max_depth: 6,
        });

        expect(d.family).toBe('readability-load');
        expect(d.profile).toBe('deeply-nested');
        expect(d.label).toBe('Imbrication élevée');
        expect(d.reasons[0]?.metric).toBe('max_depth');
    });

    it('detecte une fonction avec trop de parametres', () => {
        const d = diagnoseFunction({
            line_count: 18,
            cyclomatic_complexity: 3,
            cognitive_complexity: 5,
            parameter_count: 8,
            max_depth: 1,
        });

        expect(d.family).toBe('signature-load');
        expect(d.profile).toBe('too-many-params');
        expect(d.label).toBe('Signature large');
        expect(d.reasons[0]?.metric).toBe('parameter_count');
    });

    it('detecte une fonction simple', () => {
        const d = diagnoseFunction({
            line_count: 12,
            cyclomatic_complexity: 2,
            cognitive_complexity: 3,
            parameter_count: 1,
            max_depth: 1,
        });

        expect(d.family).toBe('low-pressure');
        expect(d.profile).toBe('low-pressure');
        expect(d.label).toBe('Faible pression');
        expect(d.priority).toBe(0);
        expect(d.reasons).toHaveLength(0);
    });

    it('detecte des signaux mixtes', () => {
        const d = diagnoseFunction({
            line_count: 100,
            cyclomatic_complexity: 13,
            cognitive_complexity: 28,
            parameter_count: 7,
            max_depth: 4,
        });

        expect(d.profile).toBe('mixed-pressure');
        expect(d.label).toBe('Signaux mixtes');
        expect(d.reasons.length).toBeGreaterThanOrEqual(2);
        expect(d.reasons.length).toBeLessThanOrEqual(3);
    });
});
