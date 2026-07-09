import { describe, expect, it } from 'vitest';
import { formatActivityEvent } from '../src/app/renderer/activityEvents.js';
import { translate, type TranslationKey } from '../src/app/renderer/i18n.js';

const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(key, 'fr', vars);

describe('activity event formatting', () => {
    it('localise les evenements de scan principaux', () => {
        expect(formatActivityEvent({ type: 'scan-start', code: 'analysis_triggered' }, t)).toBe('analyse lancée');
        expect(formatActivityEvent({ type: 'scan-done', code: 'scan_unchanged', fileCount: 12 }, t)).toBe('12 fichiers · inchangé');
        expect(formatActivityEvent({ type: 'scan-error', code: 'scan_failed' }, t)).toBe('analyse échouée · consulte la console');
    });

    it('localise les seuils et variations de score', () => {
        expect(formatActivityEvent({
            type: 'threshold',
            code: 'critical_threshold_crossed',
            fileName: 'App.tsx',
        }, t)).toBe('App.tsx · seuil critique franchi');

        expect(formatActivityEvent({
            type: 'degraded',
            code: 'score_up',
            changes: [{ name: 'A.ts', delta: 9 }, { name: 'B.ts', delta: 12 }],
            extraCount: 2,
        }, t)).toBe('A.ts +9 · B.ts +12 · +2 de plus · score en hausse');
    });

    it('localise les evenements projet', () => {
        expect(formatActivityEvent({ type: 'project-switch', code: 'project_switched', projectName: 'Cortex' }, t)).toBe('projet actif · Cortex');
        expect(formatActivityEvent({ type: 'watcher-restarted', code: 'watching_project', projectName: 'Cortex' }, t)).toBe('surveillance · Cortex');
    });

    it('conserve le fallback message pour les evenements inconnus', () => {
        expect(formatActivityEvent({ type: 'custom', message: 'raw fallback' }, t)).toBe('raw fallback');
    });
});
