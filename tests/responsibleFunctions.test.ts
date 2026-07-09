import { describe, expect, it } from 'vitest';
import { selectResponsibleFunctions } from '../src/cortex/diagnostics/responsibleFunctions.js';
import type { FunctionDetail } from '../src/app/renderer/types.js';

function fn(name: string, overrides: Partial<FunctionDetail> = {}): FunctionDetail {
    return {
        name,
        start_line:            10,
        line_count:            12,
        cyclomatic_complexity: 2,
        cognitive_complexity:  3,
        parameter_count:       1,
        max_depth:             1,
        ...overrides,
    };
}

describe('responsible functions', () => {
    const functions = [
        fn('simple', { start_line: 1 }),
        fn('branchy', { start_line: 20, cyclomatic_complexity: 18 }),
        fn('readHard', { start_line: 50, cognitive_complexity: 42 }),
        fn('large', { start_line: 100, line_count: 85 }),
        fn('deep', { start_line: 210, max_depth: 7 }),
        fn('wide', { start_line: 260, parameter_count: 9 }),
    ];

    it('selects the highest function for each structural metric', () => {
        const result = selectResponsibleFunctions(functions);

        expect(result.mostCyclomatic?.name).toBe('branchy');
        expect(result.mostCognitive?.name).toBe('readHard');
        expect(result.largestFunction?.name).toBe('large');
        expect(result.deepestFunction?.name).toBe('deep');
        expect(result.mostParams?.name).toBe('wide');
    });

    it.each([
        ['complexity', 'branchy'],
        ['cyclomatic_complexity', 'branchy'],
        ['complexityScore', 'branchy'],
        ['cognitive_complexity', 'readHard'],
        ['cognitiveComplexityScore', 'readHard'],
        ['function_size', 'large'],
        ['functionSizeScore', 'large'],
        ['depth', 'deep'],
        ['depthScore', 'deep'],
        ['params', 'wide'],
        ['parameter_count', 'wide'],
        ['paramScore', 'wide'],
    ])('selects %s as dominant signal function', (signal, expectedName) => {
        const result = selectResponsibleFunctions(functions, signal);

        expect(result.dominantSignalFunction?.name).toBe(expectedName);
        expect(result.items[0]?.fn.name).toBe(expectedName);
        expect(result.items[0]?.isDominantSignal).toBe(true);
    });

    it.each(['churn', 'churnScore', 'fan_in', 'fanIn', 'fan_out', 'fanOut', 'hotspotScore', 'trend'])(
        'does not assign a function to whole-file signal %s',
        signal => {
            const result = selectResponsibleFunctions(functions, signal);

            expect(result.dominantSignalFunction).toBeNull();
            expect(result.dominantSignalIsWholeFile).toBe(true);
        },
    );

    it('merges multiple reasons on the same function instead of replacing it with weaker functions', () => {
        const sameWinner = fn('bigOne', {
            start_line:            42,
            line_count:            120,
            cyclomatic_complexity: 30,
            cognitive_complexity:  60,
            parameter_count:       10,
            max_depth:             8,
        });
        const result = selectResponsibleFunctions([sameWinner, ...functions], 'cognitive_complexity');

        expect(result.items.map(item => item.fn.name)).toEqual(['bigOne']);
        expect(result.items[0]?.reasons.map(reason => reason.metricKey)).toEqual([
            'cognitive_complexity',
            'cyclomatic_complexity',
            'line_count',
            'max_depth',
            'parameter_count',
        ]);
        expect(result.items[0]?.isDominantSignal).toBe(true);
    });

    it('does not replace a shared cognitive and largest-function signal with a weak secondary function', () => {
        const result = selectResponsibleFunctions([
            fn('buildCouplingMap', {
                start_line:            117,
                line_count:            90,
                cyclomatic_complexity: 21,
                cognitive_complexity:  61,
                parameter_count:       2,
                max_depth:             4,
            }),
            fn('getChurnScore', {
                start_line:            109,
                line_count:            7,
                cyclomatic_complexity: 2,
                cognitive_complexity:  1,
                parameter_count:       2,
                max_depth:             1,
            }),
        ], 'cognitive_complexity');

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.fn.name).toBe('buildCouplingMap');
        expect(result.items[0]?.reasons.map(reason => reason.metricKey)).toContain('line_count');
        expect(result.items[0]?.reasons.map(reason => reason.metricKey)).toContain('cognitive_complexity');
        expect(result.items.map(item => item.fn.name)).not.toContain('getChurnScore');
    });

    it('filters weak parameter and depth reasons', () => {
        const result = selectResponsibleFunctions([
            fn('smallParams', { parameter_count: 2 }),
            fn('shallow', { max_depth: 1 }),
        ]);

        expect(result.items).toEqual([]);
    });

    it('keeps parameter and depth reasons at the relevance threshold', () => {
        const result = selectResponsibleFunctions([
            fn('wideEnough', { parameter_count: 5 }),
            fn('deepEnough', { max_depth: 3 }),
        ]);

        const reasons = result.items.flatMap(item => item.reasons.map(reason => reason.metricKey));
        expect(reasons).toContain('parameter_count');
        expect(reasons).toContain('max_depth');
    });

    it('keeps a weak value when it is the dominant signal', () => {
        const result = selectResponsibleFunctions([
            fn('dominantButSmall', { cyclomatic_complexity: 4 }),
        ], 'complexity');

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.fn.name).toBe('dominantButSmall');
        expect(result.items[0]?.reasons).toMatchObject([
            {
                metricKey:        'cyclomatic_complexity',
                metricValue:      4,
                isDominantSignal: true,
            },
        ]);
    });

    it('filters functions without any relevant reason', () => {
        const result = selectResponsibleFunctions([
            fn('ordinary', {
                cyclomatic_complexity: 3,
                cognitive_complexity:  4,
                line_count:            20,
                parameter_count:       2,
                max_depth:             1,
            }),
        ]);

        expect(result.items).toEqual([]);
    });

    it('keeps the maximum of four distinct responsible functions', () => {
        const result = selectResponsibleFunctions(functions);

        expect(result.items).toHaveLength(4);
    });

    it('calculates endLine from start line and line count', () => {
        const result = selectResponsibleFunctions([fn('large', { start_line: 120, line_count: 65 })], 'function_size');

        expect(result.items[0]).toMatchObject({
            startLine: 120,
            endLine:   184,
        });
    });

    it('ignores anonymous functions for display selection', () => {
        const result = selectResponsibleFunctions([
            fn('anonymous', { cyclomatic_complexity: 99 }),
            fn('named', { cyclomatic_complexity: 4 }),
        ], 'complexity');

        expect(result.mostCyclomatic?.name).toBe('named');
        expect(result.items.map(item => item.fn.name)).toEqual(['named']);
    });
});
