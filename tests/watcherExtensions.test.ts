import { describe, expect, it } from 'vitest';
import { SUPPORTED_EXTENSIONS } from '../src/app/main/scanner.js';
import { WATCHED_EXTENSIONS } from '../src/cortex/watcher/watcher.js';

describe('watcher extensions', () => {
    it('surveille toutes les extensions scannees', () => {
        expect(new Set(WATCHED_EXTENSIONS)).toEqual(SUPPORTED_EXTENSIONS);
    });

    it('inclut les extensions recemment ajoutees au scanner', () => {
        expect(WATCHED_EXTENSIONS).toEqual(expect.arrayContaining(['.swift', '.cjs', '.mjs']));
    });
});
