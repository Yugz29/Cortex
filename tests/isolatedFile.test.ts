import { describe, expect, it } from 'vitest';
import { classifyIsolatedFile } from '../src/cortex/diagnostics/isolatedFile.js';

describe('isolated file classification', () => {
    it.each([
        ['daemon/core/__init__.py', 'package_marker'],
        ['tests/core/__init__.py', 'package_marker'],
        ['tests/test_e2e.py', 'test_file'],
        ['src/foo.test.ts', 'test_file'],
        ['AppTests/PulseViewModelInteractionsTests.swift', 'test_file'],
        ['scripts/build.ts', 'config_or_script'],
        ['vite.config.ts', 'config_or_script'],
        ['daemon/memory/daydream.py', 'source_isolated'],
        ['App/App/NotchGlowView.swift', 'source_isolated'],
    ])('%s -> %s', (filePath, category) => {
        expect(classifyIsolatedFile(filePath)).toBe(category);
    });
});
