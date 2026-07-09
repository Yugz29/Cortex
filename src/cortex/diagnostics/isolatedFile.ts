export type IsolatedFileCategory =
    | 'package_marker'
    | 'test_file'
    | 'source_isolated'
    | 'config_or_script'
    | 'unknown_isolated';

export type IsolatedFileReason = 'no_static_graph_edges';

export interface IsolatedFileInfo {
    category: IsolatedFileCategory;
    reason: IsolatedFileReason;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.swift']);
const CONFIG_NAMES = new Set(['package.json', 'pyproject.toml', 'makefile']);
const CONFIG_FILE_RE = /^(?:vite|webpack|rollup|eslint|prettier|vitest|jest|babel|tailwind|electron\.vite)\.config\.[cm]?[jt]s$/;
const TS_CONFIG_RE = /^tsconfig(?:\..*)?\.json$/;

function pathParts(filePath: string): string[] {
    return filePath.split(/[\\/]+/).filter(Boolean);
}

function extensionOf(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.tsx')) return '.tsx';
    if (lower.endsWith('.jsx')) return '.jsx';
    if (lower.endsWith('.mjs')) return '.mjs';
    if (lower.endsWith('.cjs')) return '.cjs';
    const index = lower.lastIndexOf('.');
    return index === -1 ? '' : lower.slice(index);
}

function isTestFile(parts: string[], fileName: string): boolean {
    const lowerParts = parts.map(part => part.toLowerCase());
    const lowerFile = fileName.toLowerCase();
    return lowerParts.some(part => part === '__tests__' || part === 'tests' || part.endsWith('tests')) ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(lowerFile) ||
        /^test_.*\.py$/.test(lowerFile) ||
        /_test\.py$/.test(lowerFile) ||
        /tests?\.swift$/.test(lowerFile);
}

function isConfigOrScript(parts: string[], fileName: string): boolean {
    const lowerParts = parts.map(part => part.toLowerCase());
    const lowerFile = fileName.toLowerCase();
    return lowerParts.includes('scripts') ||
        CONFIG_NAMES.has(lowerFile) ||
        TS_CONFIG_RE.test(lowerFile) ||
        CONFIG_FILE_RE.test(lowerFile);
}

export function classifyIsolatedFile(filePath: string): IsolatedFileCategory {
    const parts = pathParts(filePath);
    const fileName = parts.at(-1) ?? '';
    const lowerFile = fileName.toLowerCase();

    if (lowerFile === '__init__.py') return 'package_marker';
    if (isTestFile(parts, fileName)) return 'test_file';
    if (isConfigOrScript(parts, fileName)) return 'config_or_script';
    if (SOURCE_EXTENSIONS.has(extensionOf(fileName))) return 'source_isolated';
    return 'unknown_isolated';
}

export function describeIsolatedFile(filePath: string): IsolatedFileInfo {
    return {
        category: classifyIsolatedFile(filePath),
        reason:   'no_static_graph_edges',
    };
}
