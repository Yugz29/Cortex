import { describe, expect, it } from 'vitest';
import { inferFileProfile } from '../src/cortex/diagnostics/fileProfile.js';

describe('file profile inference', () => {
    it.each([
        ['src/app/main/index.ts', 'entrypoint'],
        ['src/cortex/analyzer/swiftParser.ts', 'parser'],
        ['src/cortex/diagnostics/scoreDiagnosis.ts', 'decision_table'],
        ['src/app/main/report.ts', 'report_builder'],
        ['src/app/renderer/components/SecurityView.tsx', 'renderer_component'],
        ['src/cortex/security/patternScanner.ts', 'security_scanner'],
        ['src/app/main/dependencyAudit.ts', 'dependency_audit'],
        ['src/cortex/analyzer/churn.ts', 'change_analysis'],
        ['src/database/db.ts', 'data_access'],
    ])('classe %s comme %s', (filePath, expected) => {
        const profile = inferFileProfile(filePath);

        expect(profile.profile).toBe(expected);
        expect(profile.label.length).toBeGreaterThan(0);
        expect(profile.description.length).toBeGreaterThan(0);
    });

    it.each([
        ['backend/projects/models.py', 'data_model'],
        ['backend/projects/views.py', 'controller'],
        ['backend/projects/serializers.py', 'data_model'],
        ['backend/config/urls.py', 'routing'],
        ['backend/manage.py', 'entrypoint'],
        ['frontend/src/pages/dashboard.js', 'renderer_component'],
        ['frontend/src/utils/api.js', 'utility'],
    ])('classe un chemin DevNote/Django %s comme %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });

    it.each([
        ['daemon/session_fsm.py', 'decision_table'],
        ['daemon/event_bus.py', 'orchestration'],
        ['daemon/storage.py', 'data_access'],
        ['app/PulseApp.swift', 'entrypoint'],
        ['app/ContentView.swift', 'renderer_component'],
        ['scripts/dev.py', 'script'],
    ])('classe un chemin Pulse/macOS %s comme %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });

    it.each([
        ['src/components/Button.tsx', 'renderer_component'],
        ['src/services/authService.ts', 'service'],
        ['src/routes/router.ts', 'routing'],
        ['src/utils/formatDate.ts', 'utility'],
        ['src/config/settings.ts', 'configuration'],
        ['tests/parser.test.ts', 'test'],
        ['README.md', 'documentation'],
        ['src/styles/app.scss', 'style'],
    ])('classe un chemin JS/TS générique %s comme %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });

    it('garde unknown quand aucun signal clair ne ressort', () => {
        expect(inferFileProfile('src/features/account/preferences.ts').profile).toBe('unknown');
    });
});
