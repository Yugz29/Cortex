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

function functionsByFile() {
    return new Map([
        [`${projectPath}/src/app/main/scanner.ts`, [
            {
                name:                  'scanProject',
                start_line:            120,
                line_count:            90,
                cyclomatic_complexity: 24,
                cognitive_complexity:  45,
                parameter_count:       3,
                max_depth:             4,
            },
            {
                name:                  'buildEdges',
                start_line:            240,
                line_count:            48,
                cyclomatic_complexity: 12,
                cognitive_complexity:  18,
                parameter_count:       2,
                max_depth:             3,
            },
        ]],
    ]);
}

describe('maintenance report export', () => {
    it('utilise un vocabulaire prudent dans le Markdown sans changer les metriques', () => {
        const { markdown, json } = buildReport([scan()], projectPath, undefined, functionsByFile());

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
        expect(markdown).toContain('**Responsible functions:**');
        expect(markdown).toContain('`scanProject` — Cyclomatic complexity 24 · Cognitive complexity 45 · Largest function 90 · Nesting depth 4 · lines 120-209 _(dominant signal)_');
        expect(markdown).not.toContain('Parameters 3');
        expect(markdown).toContain('Files to inspect first');

        const parsed = JSON.parse(json);
        expect(parsed.summary.highPressure).toBe(1);
        expect(parsed.summary.elevated).toBe(0);
        expect(parsed.summary.lowPressure).toBe(0);
        expect(parsed.summary.avgMaintenancePressure).toBe(61.4);
        expect(parsed.summary.isolatedFiles).toEqual([]);
        expect(parsed.summary.topReviewCandidates[0].maintenancePressure).toBe(61.4);
        expect(parsed.summary.topReviewCandidates[0].pressureLevel).toBe('high_pressure');
        expect(parsed.summary.topReviewCandidates[0].profile).toBe('orchestration');
        expect(parsed.summary.topReviewCandidates[0].profileLabel).toBe('Orchestration');
        expect(parsed.summary.topReviewCandidates[0].profileDescription).toContain('Coordination files');
        expect(parsed.summary.topReviewCandidates[0].dominantSignal).toBe('complexity');
        expect(parsed.summary.topReviewCandidates[0].responsibleFunctions[0]).toMatchObject({
            name:                 'scanProject',
            reason:               'cyclomatic_complexity',
            reasonLabel:          'Cyclomatic complexity',
            startLine:            120,
            endLine:              209,
            lineCount:            90,
            cyclomaticComplexity: 24,
            cognitiveComplexity:  45,
            parameterCount:       3,
            maxDepth:             4,
            isDominantSignal:     true,
        });
        expect(parsed.summary.topReviewCandidates[0].responsibleFunctions[0].reasons).toEqual([
            {
                reason:           'cyclomatic_complexity',
                reasonLabel:      'Cyclomatic complexity',
                value:            24,
                isDominantSignal: true,
            },
            {
                reason:           'cognitive_complexity',
                reasonLabel:      'Cognitive complexity',
                value:            45,
                isDominantSignal: false,
            },
            {
                reason:           'line_count',
                reasonLabel:      'Largest function',
                value:            90,
                isDominantSignal: false,
            },
            {
                reason:           'max_depth',
                reasonLabel:      'Nesting depth',
                value:            4,
                isDominantSignal: false,
            },
        ]);
        expect(parsed.summary.topReviewCandidates[0].responsibleFunctions[0].reasons)
            .not.toContainEqual(expect.objectContaining({ reason: 'parameter_count', value: 3 }));

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
        expect(parsed.files[0].responsibleFunctions[0].name).toBe('scanProject');
        expect(parsed.files[0].responsibleFunctions[0].reason).toBe('cyclomatic_complexity');
        expect(parsed.files[0].risk).toBe(61.4);
        expect(parsed.files[0].lines).toBe(90);
        expect(parsed.files[0].status).toBe('critical');
        expect(parsed.files[0].topIssue).toBe('complexity');
    });

    it('exclut les artefacts generes des fichiers exportes et des dead files', () => {
        const generatedPath = `${projectPath}/.derivedData/Build/Intermediates.noindex/Pulse.build/Debug/App.build/DerivedSources/GeneratedAssetSymbols.swift`;
        const { markdown, json } = buildReport([
            scan({
                filePath: `${projectPath}/src/buildReport.ts`,
                fanIn: 0,
                fanOut: 1,
                globalScore: 55,
            }),
            scan({
                filePath: generatedPath,
                fanIn: 0,
                fanOut: 0,
                globalScore: 0,
            }),
        ], projectPath);

        const parsed = JSON.parse(json);

        expect(parsed.summary.totalFiles).toBe(1);
        expect(parsed.summary.isolatedFiles).toEqual([]);
        expect(parsed.summary.deadFiles).toEqual([]);
        expect(parsed.files.map((file: { file: string }) => file.file)).toEqual(['src/buildReport.ts']);
        expect(markdown).toContain('src/buildReport.ts');
        expect(json).not.toContain('GeneratedAssetSymbols.swift');
        expect(markdown).not.toContain('GeneratedAssetSymbols.swift');
    });

    it('classe les fichiers sans liens statiques sans les presenter comme inutilises', () => {
        const { markdown, json } = buildReport([
            scan({
                filePath: `${projectPath}/daemon/core/__init__.py`,
                fanIn: 0,
                fanOut: 0,
                globalScore: 0,
            }),
            scan({
                filePath: `${projectPath}/tests/test_e2e.py`,
                fanIn: 0,
                fanOut: 0,
                globalScore: 0,
            }),
            scan({
                filePath: `${projectPath}/daemon/memory/daydream.py`,
                fanIn: 0,
                fanOut: 0,
                globalScore: 0,
            }),
        ], projectPath);

        const parsed = JSON.parse(json);

        expect(parsed.summary.isolatedFiles).toEqual([
            { file: 'daemon/core/__init__.py', category: 'package_marker', reason: 'no_static_graph_edges' },
            { file: 'tests/test_e2e.py', category: 'test_file', reason: 'no_static_graph_edges' },
            { file: 'daemon/memory/daydream.py', category: 'source_isolated', reason: 'no_static_graph_edges' },
        ]);
        expect(parsed.summary.deadFiles).toEqual([
            'daemon/core/__init__.py',
            'tests/test_e2e.py',
            'daemon/memory/daydream.py',
        ]);
        expect(markdown).toContain('## Files without static graph links (3)');
        expect(markdown).toContain('This is a review signal, not proof that the files are unused.');
        expect(markdown).toContain('daemon/core/__init__.py');
        expect(markdown.toLowerCase()).not.toContain('dead files');
    });
});
