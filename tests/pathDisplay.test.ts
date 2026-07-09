import { describe, expect, it } from 'vitest';
import { displayPathForProject } from '../src/app/renderer/pathDisplay.js';

describe('path display', () => {
    it('affiche un chemin relatif quand le fichier est dans le projet', () => {
        expect(displayPathForProject(
            '/Users/yugz/Projets/Cortex/src/cortex/analyzer/swiftParser.ts',
            '/Users/yugz/Projets/Cortex',
        )).toBe('src/cortex/analyzer/swiftParser.ts');
    });

    it('conserve le chemin original quand le fichier est hors projet', () => {
        const filePath = '/Users/yugz/Other/file.ts';

        expect(displayPathForProject(filePath, '/Users/yugz/Projets/Cortex')).toBe(filePath);
    });

    it('conserve le chemin original si le projet est inconnu', () => {
        const filePath = '/Users/yugz/Projets/Cortex/src/file.ts';

        expect(displayPathForProject(filePath, '')).toBe(filePath);
    });

    it('normalise les separateurs Windows pour le calcul relatif', () => {
        expect(displayPathForProject(
            'C:\\Users\\yugz\\Cortex\\src\\file.ts',
            'C:\\Users\\yugz\\Cortex',
        )).toBe('src/file.ts');
    });
});
