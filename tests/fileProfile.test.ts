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
        ['AppTests/PulseViewModelInteractionsTests.swift', 'test'],
        ['scripts/dev.py', 'script'],
    ])('classe un chemin Pulse/macOS %s comme %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });

    it.each([
        ['src/components/Button.tsx', 'renderer_component'],
        ['src/services/authService.ts', 'service'],
        ['src/routes/router.ts', 'routing'],
        ['src/utils/formatDate.ts', 'formatter'],
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

    it.each([
        ['src/features/orders/orderSummary.ts', 'summary'],
        ['backend/reports/overview.py', 'summary'],
        ['lib/digest.js', 'summary'],
        ['src/graphs/dependencyGraph.ts', 'graph_layout'],
        ['src/layout/forceLayout.ts', 'graph_layout'],
        ['lib/couplingMap.py', 'graph_layout'],
        ['src/formatters/dateFormatter.ts', 'formatter'],
        ['src/i18n/messageBuilder.js', 'formatter'],
        ['app/displayLabels.swift', 'formatter'],
        ['src/validators/userValidator.ts', 'validation_contract'],
        ['api/contracts/paymentContract.ts', 'validation_contract'],
        ['backend/schema.py', 'validation_contract'],
        ['src/store.ts', 'state_management'],
        ['src/reducers/sessionReducer.ts', 'state_management'],
        ['app/stateManager.py', 'state_management'],
        ['fixtures/user.json', 'fixture_mock'],
        ['src/__mocks__/fetchClient.ts', 'fixture_mock'],
        ['samples/demoPayload.py', 'fixture_mock'],
        ['src/integrations/paymentProvider.ts', 'adapter_bridge'],
        ['src/api/httpClient.ts', 'adapter_bridge'],
        ['src/bridge/DaemonBridge.swift', 'adapter_bridge'],
        ['daemon/llm/ollama_provider.py', 'adapter_bridge'],
        ['mcp/stdio_server.py', 'adapter_bridge'],
        ['src/scoring/engine.py', 'scoring_engine'],
        ['src/risk-score/referenceBaselines.ts', 'scoring_engine'],
        ['src/core/signal_scorer.py', 'scoring_engine'],
        ['ranking/ranker.ts', 'scoring_engine'],
        ['src/events/activityEvents.ts', 'event_processing'],
        ['src/core/event_envelope.py', 'event_processing'],
        ['runtime/runtime_ingestion.py', 'event_processing'],
        ['src/events/eventMeaning.ts', 'event_processing'],
    ])('classe un chemin générique %s comme %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });

    it.each([
        ['src/app/renderer/components/GraphView.tsx', 'renderer_component'],
        ['src/analyzer/formatParser.ts', 'parser'],
        ['src/config/userSchema.ts', 'configuration'],
        ['tests/fixtures/parserFixture.ts', 'test'],
        ['src/parser/eventParser.ts', 'parser'],
        ['src/components/EventView.tsx', 'renderer_component'],
        ['src/features/sessionManager.ts', 'unknown'],
    ])('respecte les priorités de collision pour %s', (filePath, expected) => {
        expect(inferFileProfile(filePath).profile).toBe(expected);
    });
});
