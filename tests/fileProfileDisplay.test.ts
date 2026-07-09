import { describe, expect, it } from 'vitest';
import { getScanFileProfile, shouldShowScanFileProfile } from '../src/app/renderer/fileProfileDisplay.js';
import type { Scan } from '../src/app/renderer/types.js';

function scan(overrides: Partial<Scan> = {}): Scan {
    return {
        filePath:                '/project/src/app.ts',
        globalScore:             0,
        hotspotScore:            0,
        complexityScore:         0,
        cognitiveComplexityScore: 0,
        functionSizeScore:       0,
        churnScore:              0,
        depthScore:              0,
        paramScore:              0,
        fanIn:                   0,
        fanOut:                  0,
        language:                'typescript',
        trend:                   '↔',
        scannedAt:               '2026-07-09T00:00:00.000Z',
        rawComplexity:           0,
        rawCognitiveComplexity:  0,
        rawFunctionSize:         0,
        rawDepth:                0,
        rawParams:               0,
        rawChurn:                0,
        ...overrides,
    };
}

describe('file profile display', () => {
    it('uses profile fields when they are present on the scan payload in English', () => {
        const profile = getScanFileProfile(scan({
            profile:            'parser',
            profileLabel:       'Parser',
            profileDescription: 'Parsing logic can be naturally branch-heavy.',
        }), 'en');

        expect(profile.profile).toBe('parser');
        expect(profile.label).toBe('Parser');
        expect(profile.description).toContain('Parsing logic');
        expect(shouldShowScanFileProfile(profile)).toBe(true);
    });

    it('localizes parser profiles in French without showing the English fallback', () => {
        const profile = getScanFileProfile(scan({
            profile:            'parser',
            profileLabel:       'Parser',
            profileDescription: 'Parsing logic can be naturally branch-heavy because it handles syntax and edge cases.',
        }), 'fr');

        expect(profile.profile).toBe('parser');
        expect(profile.label).toBe('Parseur');
        expect(profile.label).not.toBe('Parser');
        expect(profile.description).toContain('La logique de parsing');
        expect(profile.description).not.toContain('Parsing logic');
        expect(shouldShowScanFileProfile(profile)).toBe(true);
    });

    it('localizes change analysis profiles in French', () => {
        const profile = getScanFileProfile(scan({
            profile:            'change_analysis',
            profileLabel:       'Change analysis',
            profileDescription: 'Git/churn analysis often groups log parsing, commit grouping and change metrics.',
        }), 'fr');

        expect(profile.profile).toBe('change_analysis');
        expect(profile.label).toBe('Analyse des changements');
        expect(profile.label).not.toBe('Change analysis');
        expect(profile.description).toContain('L’analyse Git/churn');
        expect(profile.description).not.toContain('Git/churn analysis');
    });

    it('hides the profile block for unknown profiles', () => {
        const profile = getScanFileProfile(scan({
            filePath: '/project/src/plainFeature.ts',
        }), 'fr');

        expect(profile.profile).toBe('unknown');
        expect(shouldShowScanFileProfile(profile)).toBe(false);
    });

    it('falls back to path inference for older scan payloads in English', () => {
        const profile = getScanFileProfile(scan({
            filePath: '/project/src/cortex/analyzer/swiftParser.ts',
        }), 'en');

        expect(profile.profile).toBe('parser');
        expect(profile.label).toBe('Parser');
        expect(shouldShowScanFileProfile(profile)).toBe(true);
    });

    it('localizes path-inferred profiles for older scan payloads in French', () => {
        const profile = getScanFileProfile(scan({
            filePath: '/project/src/cortex/analyzer/churn.ts',
        }), 'fr');

        expect(profile.profile).toBe('change_analysis');
        expect(profile.label).toBe('Analyse des changements');
        expect(profile.description).toContain('L’analyse Git/churn');
        expect(shouldShowScanFileProfile(profile)).toBe(true);
    });

    it.each([
        ['routing', 'Routage'],
        ['controller', 'Contrôleur'],
        ['service', 'Service'],
        ['data_model', 'Modèle de données'],
        ['configuration', 'Configuration'],
        ['test', 'Test'],
        ['script', 'Script'],
        ['style', 'Style'],
        ['documentation', 'Documentation'],
        ['summary', 'Résumé'],
        ['graph_layout', 'Graphe/layout'],
        ['formatter', 'Formatage'],
        ['validation_contract', 'Validation/contrat'],
        ['state_management', 'Gestion d’état'],
        ['fixture_mock', 'Fixture/mock'],
        ['adapter_bridge', 'Adaptateur/bridge'],
        ['scoring_engine', 'Moteur de scoring'],
        ['event_processing', 'Traitement d’événements'],
    ])('localizes the %s profile label in French', (profileName, expectedLabel) => {
        const profile = getScanFileProfile(scan({
            profile: profileName,
        }), 'fr');

        expect(profile.label).toBe(expectedLabel);
        expect(profile.description.length).toBeGreaterThan(0);
        expect(shouldShowScanFileProfile(profile)).toBe(true);
    });

    it('keeps generic profile labels in English', () => {
        const profile = getScanFileProfile(scan({
            filePath: '/project/backend/config/urls.py',
        }), 'en');

        expect(profile.profile).toBe('routing');
        expect(profile.label).toBe('Routing');
        expect(profile.description).toContain('Routing files');
    });

    it.each([
        ['/project/src/features/orderSummary.ts', 'Summary'],
        ['/project/src/graphs/dependencyGraph.ts', 'Graph/layout'],
        ['/project/src/formatters/dateFormatter.ts', 'Formatter'],
        ['/project/src/contracts/paymentContract.ts', 'Validation/contract'],
        ['/project/src/reducers/sessionReducer.ts', 'State management'],
        ['/project/fixtures/user.json', 'Fixture/mock'],
        ['/project/src/adapters/httpClient.ts', 'Adapter/bridge'],
        ['/project/src/scoring/engine.py', 'Scoring engine'],
        ['/project/src/events/activityEvents.ts', 'Event processing'],
    ])('keeps the inferred profile label in English for %s', (filePath, expectedLabel) => {
        const profile = getScanFileProfile(scan({
            filePath,
        }), 'en');

        expect(profile.label).toBe(expectedLabel);
        expect(profile.description.length).toBeGreaterThan(0);
    });
});
