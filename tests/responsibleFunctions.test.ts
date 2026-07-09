import { describe, expect, it } from 'vitest';
import { selectResponsibleFunctions } from '../src/app/renderer/responsibleFunctions.js';
import type { FunctionDetail, Scan } from '../src/app/renderer/types.js';

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

const scan = {
    filePath: '/project/src/file.ts',
} as Pick<Scan, 'filePath'>;

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
        const result = selectResponsibleFunctions(scan, functions);

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
        const result = selectResponsibleFunctions(scan, functions, signal);

        expect(result.dominantSignalFunction?.name).toBe(expectedName);
        expect(result.items[0]?.fn.name).toBe(expectedName);
        expect(result.items[0]?.isDominantSignal).toBe(true);
    });

    it.each(['churn', 'churnScore', 'fan_in', 'fanIn', 'fan_out', 'fanOut', 'hotspotScore', 'trend'])(
        'does not assign a function to whole-file signal %s',
        signal => {
            const result = selectResponsibleFunctions(scan, functions, signal);

            expect(result.dominantSignalFunction).toBeNull();
            expect(result.dominantSignalIsWholeFile).toBe(true);
        },
    );

    it('deduplicates displayed functions and caps the list', () => {
        const sameWinner = fn('bigOne', {
            start_line:            42,
            line_count:            120,
            cyclomatic_complexity: 30,
            cognitive_complexity:  60,
            parameter_count:       10,
            max_depth:             8,
        });
        const result = selectResponsibleFunctions(scan, [sameWinner, ...functions], 'cognitive_complexity');

        expect(result.items.map(item => item.fn.name)).toEqual(['bigOne', 'readHard', 'branchy', 'large']);
        expect(result.items).toHaveLength(4);
    });

    it('calculates endLine from start line and line count', () => {
        const result = selectResponsibleFunctions(scan, [fn('large', { start_line: 120, line_count: 65 })], 'function_size');

        expect(result.items[0]).toMatchObject({
            startLine: 120,
            endLine:   184,
        });
    });

    it('ignores anonymous functions for display selection', () => {
        const result = selectResponsibleFunctions(scan, [
            fn('anonymous', { cyclomatic_complexity: 99 }),
            fn('named', { cyclomatic_complexity: 4 }),
        ], 'complexity');

        expect(result.mostCyclomatic?.name).toBe('named');
        expect(result.items.map(item => item.fn.name)).toEqual(['named']);
    });
});
