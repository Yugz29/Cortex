import { describe, expect, it } from 'vitest';
import { shouldIgnorePath } from '../src/app/main/scanPathFilter.js';

describe('scan path filter', () => {
    it.each([
        '/project/node_modules/pkg/index.js',
        '/project/dist/app.js',
        '/project/build/main.js',
        '/project/.next/server/page.js',
        '/project/.venv/lib/python/site-packages/x.py',
        '/project/__pycache__/module.pyc',
        '/project/.pytest_cache/v/cache/nodeids',
        '/project/.derivedData/Build/Intermediates.noindex/App.build/DerivedSources/GeneratedAssetSymbols.swift',
        '/project/DerivedData/App/Build/file.swift',
        '/project/DerivedSources/Foo.swift',
        '/project/GeneratedSources/Foo.ts',
        '/project/coverage/lcov-report/index.js',
        '/project/src/api/client.generated.ts',
        '/project/src/api/schema.gen.ts',
        '/project/target/debug/app',
    ])('ignore les chemins generes, caches, builds ou dependances: %s', filePath => {
        expect(shouldIgnorePath(filePath)).toBe(true);
    });

    it.each([
        '/project/src/buildReport.ts',
        '/project/src/coverage/analysisCoverage.ts',
        '/project/src/generator.ts',
        '/project/src/generatedClient.ts',
        '/project/src/vendorAdapter.ts',
        '/project/src/cacheManager.ts',
    ])('conserve les fichiers source dont le nom contient un mot reserve: %s', filePath => {
        expect(shouldIgnorePath(filePath)).toBe(false);
    });
});
