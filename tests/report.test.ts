import { describe, expect, it } from 'vitest';
import { buildReport } from '../src/app/main/report.js';

const projectPath = '/project/Cortex';

function scan(overrides: Record<string, unknown> = {}) {
    return {
        filePath: `${projectPath}/src/app/main/scanner.ts`,
        globalScore: 61.4,
        trend: '↔',
        rawComplexity: 24,
        rawCognitiveComplexity: 45,
        rawFunctionSize: 90,
        rawChurn: 12,
        rawDepth: 4,
        rawParams: 3,
        fanIn: 5,
        fanOut: 6,
        complexityScore: 72,
        cognitiveComplexityScore: 61,
        functionSizeScore: 64,
        churnScore: 58,
        depthScore: 35,
        paramScore: 0,
        hotspotScore: 52,
        ...overrides,
    };
}

describe('maintenance report export', () => {
    it('utilise un vocabulaire prudent dans le Markdown sans changer les metriques', () => {
        const { markdown, json } = buildReport([scan()], projectPath);

        expect(markdown).toContain('## Files to Inspect First (1)');
        expect(markdown).not.toContain('## Critical Files');
        expect(markdown).toContain('| Total files | 1 |');
        expect(markdown).not.toContain('Total modules');
        expect(markdown).toContain('score is not a diagnosis');
        expect(markdown).toContain('Largest Function | Lines in the largest detected function');
        expect(markdown).toContain('largest fn 90L');
        expect(markdown).toContain('Maintenance Signal 61.4');
        expect(markdown).not.toContain('Maintenance Pressure 61.4');
        expect(markdown).toContain('Profile: Orchestration');
        expect(markdown).toContain('Files to inspect first');

        const parsed = JSON.parse(json);
        expect(parsed.summary.highPressure).toBe(1);
        expect(parsed.summary.elevated).toBe(0);
        expect(parsed.summary.lowPressure).toBe(0);
        expect(parsed.summary.avgMaintenancePressure).toBe(61.4);
        expect(parsed.summary.topReviewCandidates[0].maintenancePressure).toBe(61.4);
        expect(parsed.summary.topReviewCandidates[0].pressureLevel).toBe('high_pressure');
        expect(parsed.summary.topReviewCandidates[0].profile).toBe('orchestration');
        expect(parsed.summary.topReviewCandidates[0].profileLabel).toBe('Orchestration');
        expect(parsed.summary.topReviewCandidates[0].profileDescription).toContain('Coordination files');
        expect(parsed.summary.topReviewCandidates[0].dominantSignal).toBe('complexity');

        expect(parsed.summary.critical).toBe(1);
        expect(parsed.summary.stressed).toBe(0);
        expect(parsed.summary.healthy).toBe(0);
        expect(parsed.summary.avgRisk).toBe(61.4);
        expect(parsed.summary.topPriorities[0].risk).toBe(61.4);

        expect(parsed.files[0].maintenancePressure).toBe(61.4);
        expect(parsed.files[0].pressureLevel).toBe('high_pressure');
        expect(parsed.files[0].profile).toBe('orchestration');
        expect(parsed.files[0].profileLabel).toBe('Orchestration');
        expect(parsed.files[0].profileDescription).toContain('Coordination files');
        expect(parsed.files[0].dominantSignal).toBe('complexity');
        expect(parsed.files[0].risk).toBe(61.4);
        expect(parsed.files[0].lines).toBe(90);
        expect(parsed.files[0].status).toBe('critical');
        expect(parsed.files[0].topIssue).toBe('complexity');
    });
});
