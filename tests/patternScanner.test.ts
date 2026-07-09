import { describe, expect, it } from 'vitest';
import { scanFileForPatterns } from '../src/cortex/security/patternScanner.js';

function rulesFor(filePath: string, source: string): string[] {
    return scanFileForPatterns(filePath, source).map(finding => finding.rule);
}

describe('security pattern scanner', () => {
    it('ignore les mappings i18n qui contiennent secret dans une cle technique', () => {
        const findings = scanFileForPatterns('/project/src/app/renderer/securityText.ts', `
const CATEGORY_LABEL_KEYS = {
  secret: 'security.categorySecret',
};
`);

        expect(findings).toEqual([]);
    });

    it('detecte encore une variable de secret probable', () => {
        expect(rulesFor('/project/src/config.ts', `const apiSecret = "prod_live_secret_12345";`))
            .toContain('hardcoded-secret');
    });

    it('ignore Math.random dans une chaine de traduction', () => {
        const findings = scanFileForPatterns('/project/src/app/renderer/i18n.ts', `
const translations = {
  'security.patternMathRandom': { en: 'Math.random() is not cryptographically secure.', fr: 'Math.random() nest pas sur.' },
};
`);

        expect(findings).toEqual([]);
    });

    it('ignore Math.random pour initialiser un layout visuel', () => {
        const findings = scanFileForPatterns('/project/src/app/renderer/graphLayout.ts', `
const nodes = scans.map(node => ({
  x: (Math.random() - 0.5) * 400,
  y: (Math.random() - 0.5) * 400,
  layout: 'force',
}));
`);

        expect(findings).toEqual([]);
    });

    it('detecte encore Math.random dans un contexte sensible', () => {
        expect(rulesFor('/project/src/auth/session.ts', `const sessionToken = Math.random().toString(36);`))
            .toContain('math-random-security');
        expect(rulesFor('/project/src/invite.ts', `const inviteKey = Math.random().toString(36);`))
            .toContain('math-random-security');
    });

    it('detecte encore les blocs de cle privee', () => {
        expect(rulesFor('/project/src/key.ts', `const key = "-----BEGIN PRIVATE KEY-----";`))
            .toContain('private-key-block');
    });

    it('detecte encore les chaines de connexion avec identifiants', () => {
        expect(rulesFor('/project/src/db.ts', `const url = "postgres://user:pass@example.com/app";`))
            .toContain('connection-string');
    });
});
