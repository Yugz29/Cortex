import { describe, expect, it } from 'vitest';
import { translate } from '../src/app/renderer/i18n.js';

describe('detail panel i18n', () => {
    it('traduit les libelles de details de metriques en francais', () => {
        expect(translate('detail.metricDetails', 'fr')).toBe('Détails des métriques');
        expect(translate('detail.showMetricDetails', 'fr')).toBe('Afficher les détails');
        expect(translate('detail.hideMetricDetails', 'fr')).toBe('Masquer les détails');
        expect(translate('detail.profileInfo', 'fr')).toBe('Informations sur le profil');
    });

    it('conserve les libelles de details de metriques en anglais', () => {
        expect(translate('detail.metricDetails', 'en')).toBe('Metric details');
        expect(translate('detail.showMetricDetails', 'en')).toBe('Show details');
        expect(translate('detail.hideMetricDetails', 'en')).toBe('Hide details');
        expect(translate('detail.profileInfo', 'en')).toBe('Profile information');
    });
});
