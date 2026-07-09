import { describe, expect, it } from 'vitest';
import { translate, type TranslationKey } from '../src/app/renderer/i18n.js';
import { securityCategoryLabel, securityFindingMessage } from '../src/app/renderer/securityText.js';
import type { SecurityFinding } from '../src/app/renderer/types.js';

const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(key, 'fr', vars);

function finding(rule: string, message: string): SecurityFinding {
    return {
        rule,
        message,
        filePath: '/tmp/app.ts',
        line: 1,
        severity: 'critical',
        category: 'secret',
        snippet: '',
    };
}

describe('security text localization', () => {
    it('traduit les messages de patterns connus', () => {
        expect(securityFindingMessage(finding('hardcoded-secret', 'raw'), t))
            .toBe('Secret potentiellement codé en dur — déplacez-le dans une variable d’environnement.');
        expect(securityFindingMessage(finding('private-key-block', 'raw'), t))
            .toBe('Bloc de clé privée détecté dans le code source.');
        expect(securityFindingMessage(finding('connection-string', 'raw'), t))
            .toBe('Chaîne de connexion contenant des identifiants intégrés.');
        expect(securityFindingMessage(finding('math-random-security', 'raw'), t))
            .toBe('Math.random() n’est pas cryptographiquement sûr — utilisez une API cryptographique adaptée pour les tokens ou identifiants.');
    });

    it('conserve le message scanner pour les regles sans mapping', () => {
        expect(securityFindingMessage(finding('unknown-rule', 'Scanner fallback'), t)).toBe('Scanner fallback');
    });

    it('traduit les categories visibles', () => {
        expect(securityCategoryLabel('secret', t)).toBe('Secrets');
        expect(securityCategoryLabel('misc', t)).toBe('Divers');
    });
});
