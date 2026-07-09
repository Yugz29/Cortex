const IGNORED_SEGMENTS = new Set([
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.vite',
    '.turbo',
    '.cache',
    '.venv',
    'venv',
    'site-packages',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    'htmlcov',
    'deriveddata',
    '.deriveddata',
    'derivedsources',
    '.build',
    'xcuserdata',
    '.gradle',
    'target',
    'out',
    'vendor',
    '.git',
    '.idea',
    '.vscode',
    '.ds_store',
]);

const GENERATED_SOURCE_SEGMENTS = new Set(['generatedsources', 'derivedsources']);
const SOURCE_COVERAGE_PARENTS = new Set(['src', 'source', 'sources']);
const GENERATED_FILE_PATTERN = /\.(?:generated|gen)\.(?:ts|js|py|swift)$/i;
const GENERATED_ASSET_SYMBOLS = 'generatedassetsymbols.swift';

function normalizeSegments(filePath: string): string[] {
    return filePath
        .split(/[\\/]+/)
        .filter(Boolean)
        .map(segment => segment.toLowerCase());
}

function isCoverageOutputSegment(segments: string[], index: number): boolean {
    const previousSegment = segments[index - 1];
    return !previousSegment || !SOURCE_COVERAGE_PARENTS.has(previousSegment);
}

export function shouldIgnorePath(filePath: string): boolean {
    const segments = normalizeSegments(filePath);
    const fileName = segments.at(-1) ?? '';

    if (fileName === GENERATED_ASSET_SYMBOLS || GENERATED_FILE_PATTERN.test(fileName)) return true;

    return segments.some((segment, index) => {
        if (segment === 'coverage') return isCoverageOutputSegment(segments, index);
        return IGNORED_SEGMENTS.has(segment) || GENERATED_SOURCE_SEGMENTS.has(segment);
    });
}
