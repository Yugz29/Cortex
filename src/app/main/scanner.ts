import fs from 'node:fs';
import path from 'node:path';
import { analyzeFile } from '../../cortex/analyzer/parser.js';
import { scoreFromRaw, computeProjectBaselines } from '../../cortex/risk-score/riskScore.js';
import type { RawMetrics, RiskScoreResult } from '../../cortex/risk-score/riskScore.js';
import { saveScans, saveFunctions, saveCouplings, saveImportEdges } from '../../database/db.js';
import { buildChurnCache, clearChurnCache, getChurnScore, buildCouplingMap } from '../../cortex/analyzer/churn.js';
import type { FileMetrics } from '../../cortex/analyzer/parser.js';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.swift']);
const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', '.vite', 'vendor', '__pycache__'];
export const SCANNER_FINGERPRINT_VERSION = 'scanner-v1';
const IGNORE_FILE_PATTERNS = ['.min.js', '.min.ts', '.d.ts', '.map', '.spec.', '.test.', '__tests__'];
// Dossiers toujours exclus peu importe les settings — artefacts de build, caches
const ALWAYS_IGNORE = new Set(['node_modules', '.git', 'out', 'dist', 'build', 'assets', '.vite', '__pycache__', 'venv', '.venv', 'env', 'site-packages', 'migrations']);

function shouldIgnoreFile(filename: string): boolean {
    return IGNORE_FILE_PATTERNS.some(p => filename.includes(p));
}

export function getFiles(dir: string, ignore: string[], fileList: string[] = [], visited = new Set<string>()): string[] {
    let realDir: string;
    try { realDir = fs.realpathSync(dir); } catch { return fileList; }
    if (visited.has(realDir)) return fileList;
    visited.add(realDir);

    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return fileList; }

    for (const entry of entries) {
        if (ALWAYS_IGNORE.has(entry) || ignore.includes(entry)) continue;
        const fullPath = path.join(dir, entry);
        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (stat.isDirectory()) { getFiles(fullPath, ignore, fileList, visited); continue; }
        const ext = path.extname(entry).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext) && !shouldIgnoreFile(entry)) fileList.push(fullPath);
    }
    return fileList;
}

const IMPORT_PATTERNS: Record<string, RegExp[]> = {
    js: [
        /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /export\s+(?:type\s+)?(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    py: [
        /^import\s+([\w.]+)/gm,
    ],
};

export interface FileEdge { from: string; to: string; }

export interface ImportPathAlias {
    pattern: string;
    targets: string[];
    baseUrl: string;
}

export interface ImportResolveContext {
    projectPath:  string;
    pathAliases?: ImportPathAlias[];
}

export type ImportKind = 'relative' | 'simple-alias' | 'external';
export type UnresolvedImportReason =
    | 'target-not-scanned-or-excluded'
    | 'outside-project'
    | 'alias-context-missing';

export interface UnresolvedImportExample {
    filePath: string;
    importPath: string;
    reason: UnresolvedImportReason;
}

export interface ImportGraphDiagnostics {
    totalImports:          number;
    relativeImports:       number;
    simpleAliasImports:    number;
    pythonAbsoluteImports: number;
    externalIgnored:       number;
    unresolvedImports:     number;
    edgesCreated:          number;
    unresolvedExamples:    UnresolvedImportExample[];
}

export interface ImportGraphResult {
    edges:       FileEdge[];
    diagnostics: ImportGraphDiagnostics;
}

export function extractImports(filePath: string, source: string): string[] {
    const ext  = path.extname(filePath).toLowerCase();
    if (ext === '.py') return extractPythonImports(source);

    const pats = ext === '.py' ? IMPORT_PATTERNS.py : IMPORT_PATTERNS.js;
    const imports: string[] = [];
    for (const pat of pats) {
        pat.lastIndex = 0;
        let match;
        while ((match = pat.exec(source)) !== null) {
            const raw = match[1];
            imports.push(raw);
        }
    }
    return imports;
}

function extractPythonImports(source: string): string[] {
    const imports: string[] = [];
    const fromPattern = /^from\s+(\.+)?([\w.]*)\s+import\s+([^\n#]+)/gm;
    let fromMatch;
    while ((fromMatch = fromPattern.exec(source)) !== null) {
        const dots = fromMatch[1] ?? '';
        const modulePath = fromMatch[2] ?? '';
        const imported = fromMatch[3] ?? '';

        if (dots && modulePath) {
            imports.push(dots + modulePath);
            continue;
        }

        if (dots && !modulePath) {
            for (const name of imported.split(',')) {
                const clean = name.trim().split(/\s+as\s+/)[0]?.trim();
                if (clean && /^[A-Za-z_]\w*$/.test(clean)) imports.push(dots + clean);
            }
            continue;
        }

        if (modulePath) imports.push(modulePath);
    }

    for (const pat of IMPORT_PATTERNS.py) {
        pat.lastIndex = 0;
        let match;
        while ((match = pat.exec(source)) !== null) {
            imports.push(match[1]);
        }
    }

    return imports;
}

function isInsideProject(filePath: string, projectPath: string): boolean {
    const rel = path.relative(projectPath, filePath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function classifyImport(importPath: string): ImportKind {
    if (importPath.startsWith('.')) return 'relative';
    if (importPath.startsWith('@/') || importPath.startsWith('~/') || importPath.startsWith('src/')) return 'simple-alias';
    return 'external';
}

function stripJsonComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/,\s*([}\]])/g, '$1');
}

function readCompilerAliases(configPath: string, projectPath: string): ImportPathAlias[] {
    let parsed: any;
    try {
        parsed = JSON.parse(stripJsonComments(fs.readFileSync(configPath, 'utf-8')));
    } catch {
        return [];
    }

    const compilerOptions = parsed?.compilerOptions;
    const paths = compilerOptions?.paths;
    if (!paths || typeof paths !== 'object') return [];

    const configDir = path.dirname(configPath);
    const rawBaseUrl = typeof compilerOptions?.baseUrl === 'string' ? compilerOptions.baseUrl : '.';
    const baseUrl = path.resolve(configDir, rawBaseUrl);
    if (!isInsideProject(baseUrl, projectPath)) return [];

    const aliases: ImportPathAlias[] = [];
    for (const [pattern, rawTargets] of Object.entries(paths)) {
        if (typeof pattern !== 'string' || !Array.isArray(rawTargets)) continue;
        const targets = rawTargets.filter((target): target is string => typeof target === 'string');
        if (targets.length === 0) continue;
        aliases.push({ pattern, targets, baseUrl });
    }
    return aliases;
}

export function createImportResolveContext(projectPath: string): ImportResolveContext {
    const pathAliases: ImportPathAlias[] = [];
    for (const configName of ['tsconfig.json', 'jsconfig.json']) {
        pathAliases.push(...readCompilerAliases(path.join(projectPath, configName), projectPath));
    }
    return { projectPath, pathAliases };
}

function matchPathAlias(importPath: string, alias: ImportPathAlias): string | null {
    const starIndex = alias.pattern.indexOf('*');
    if (starIndex === -1) return importPath === alias.pattern ? '' : null;

    const prefix = alias.pattern.slice(0, starIndex);
    const suffix = alias.pattern.slice(starIndex + 1);
    if (!importPath.startsWith(prefix) || !importPath.endsWith(suffix)) return null;
    return importPath.slice(prefix.length, importPath.length - suffix.length);
}

function applyAliasTarget(target: string, matched: string): string {
    return target.includes('*') ? target.replace('*', matched) : target;
}

function resolveImportBase(fromFile: string, importPath: string, context?: ImportResolveContext): string | null {
    const stripped = importPath.replace(/\.js$/, '');
    if (path.extname(fromFile).toLowerCase() === '.py' && importPath.startsWith('.')) {
        return resolvePythonRelativeImportBase(fromFile, importPath);
    }
    if (importPath.startsWith('.')) return path.resolve(path.dirname(fromFile), stripped);

    if (!context) return null;
    if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
        return path.resolve(context.projectPath, 'src', stripped.slice(2));
    }
    if (importPath.startsWith('src/')) {
        return path.resolve(context.projectPath, stripped);
    }

    return null;
}

function resolvePathAliasImport(
    importPath: string,
    allFiles: Set<string>,
    context?: ImportResolveContext,
): string | null {
    if (!context?.pathAliases?.length) return null;

    for (const alias of context.pathAliases) {
        const matched = matchPathAlias(importPath, alias);
        if (matched === null) continue;

        for (const target of alias.targets) {
            const base = path.resolve(alias.baseUrl, applyAliasTarget(target, matched));
            const resolved = resolveCandidate(base, allFiles, context);
            if (resolved) return resolved;
        }
    }

    return null;
}

function resolvePythonRelativeImportBase(fromFile: string, importPath: string): string | null {
    const match = /^(\.+)(.*)$/.exec(importPath);
    if (!match) return null;

    const dots = match[1]!;
    const modulePath = match[2]!;
    let baseDir = path.dirname(fromFile);
    for (let i = 1; i < dots.length; i++) {
        baseDir = path.dirname(baseDir);
    }

    if (!modulePath) return baseDir;
    return path.join(baseDir, ...modulePath.split('.').filter(Boolean));
}

function isPythonFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.py';
}

function pythonModuleCandidates(base: string): string[] {
    return [base + '.py', path.join(base, '__init__.py')];
}

function jsModuleCandidates(base: string): string[] {
    return [
        base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '.mjs', base + '.cjs',
        path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
        path.join(base, 'index.js'), path.join(base, 'index.jsx'),
        path.join(base, 'index.mjs'), path.join(base, 'index.cjs'),
    ];
}

function pythonAbsoluteRoots(fromFile: string, projectPath: string): string[] {
    const roots: string[] = [];
    const seen = new Set<string>();
    const add = (dir: string) => {
        const resolved = path.resolve(dir);
        if (!isInsideProject(resolved, projectPath) || seen.has(resolved)) return;
        seen.add(resolved);
        roots.push(resolved);
    };

    let current = path.dirname(fromFile);
    add(current);
    while (current !== projectPath) {
        current = path.dirname(current);
        add(current);
        if (current === path.dirname(current)) break;
    }
    add(path.join(projectPath, 'src'));

    return roots;
}

function resolvePythonAbsoluteImport(
    fromFile: string,
    importPath: string,
    allFiles: Set<string>,
    context?: ImportResolveContext,
): string | null {
    if (!context || !isPythonFile(fromFile) || importPath.startsWith('.')) return null;
    const moduleParts = importPath.split('.').filter(Boolean);
    if (moduleParts.length === 0) return null;

    for (const root of pythonAbsoluteRoots(fromFile, context.projectPath)) {
        const base = path.join(root, ...moduleParts);
        for (const candidate of pythonModuleCandidates(base)) {
            if (!isInsideProject(candidate, context.projectPath)) continue;
            if (allFiles.has(candidate)) return candidate;
        }
    }

    return null;
}

function unresolvedReason(fromFile: string, importPath: string, context?: ImportResolveContext): UnresolvedImportReason {
    if (classifyImport(importPath) === 'simple-alias' && !context) return 'alias-context-missing';
    const base = resolveImportBase(fromFile, importPath, context);
    if (base && context && !isInsideProject(base, context.projectPath)) return 'outside-project';
    return 'target-not-scanned-or-excluded';
}

function resolveCandidate(base: string, allFiles: Set<string>, context?: ImportResolveContext, isPythonImport = false): string | null {
    if (context && !isInsideProject(base, context.projectPath)) return null;

    const candidates = [
        ...(isPythonImport ? pythonModuleCandidates(base) : []),
        ...jsModuleCandidates(base),
    ];
    for (const c of candidates) {
        if (context && !isInsideProject(c, context.projectPath)) continue;
        if (allFiles.has(c)) return c;
    }
    return null;
}

export function resolveImport(
    fromFile: string,
    importPath: string,
    allFiles: Set<string>,
    context?: ImportResolveContext,
): string | null {
    const pythonAbsolute = resolvePythonAbsoluteImport(fromFile, importPath, allFiles, context);
    if (pythonAbsolute) return pythonAbsolute;

    const pathAlias = resolvePathAliasImport(importPath, allFiles, context);
    if (pathAlias) return pathAlias;

    const base = resolveImportBase(fromFile, importPath, context);
    if (!base) return null;

    return resolveCandidate(base, allFiles, context, isPythonFile(fromFile));
}

export function buildImportGraph(
    files: string[],
    fileSources: Map<string, string>,
    context?: ImportResolveContext,
): ImportGraphResult {
    const fileSet = new Set(files);
    const edges: FileEdge[] = [];
    const seen  = new Set<string>();
    const diagnostics: ImportGraphDiagnostics = {
        totalImports:          0,
        relativeImports:       0,
        simpleAliasImports:    0,
        pythonAbsoluteImports: 0,
        externalIgnored:       0,
        unresolvedImports:     0,
        edgesCreated:          0,
        unresolvedExamples:    [],
    };

    for (const file of files) {
        const source = fileSources.get(file);
        if (!source) continue;
        const imports = extractImports(file, source);
        for (const imp of imports) {
            diagnostics.totalImports++;
            const kind = classifyImport(imp);
            const resolved = resolveImport(file, imp, fileSet, context);
            if (kind === 'external') {
                if (!resolved) {
                    diagnostics.externalIgnored++;
                    continue;
                }
                if (isPythonFile(file)) diagnostics.pythonAbsoluteImports++;
            } else if (kind === 'relative') {
                diagnostics.relativeImports++;
            } else {
                diagnostics.simpleAliasImports++;
            }

            if (!resolved) {
                diagnostics.unresolvedImports++;
                if (diagnostics.unresolvedExamples.length < 10) {
                    diagnostics.unresolvedExamples.push({
                        filePath: file,
                        importPath: imp,
                        reason: unresolvedReason(file, imp, context),
                    });
                }
                continue;
            }
            const key = `${file}→${resolved}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ from: file, to: resolved });
        }
    }
    diagnostics.edgesCreated = edges.length;
    return { edges, diagnostics };
}

export function buildEdges(
    files: string[],
    fileSources: Map<string, string>,
    context?: ImportResolveContext,
): FileEdge[] {
    return buildImportGraph(files, fileSources, context).edges;
}

export interface ScanResult { files: RiskScoreResult[]; edges: FileEdge[]; }

interface FileAnalysis { metrics: FileMetrics; raw: RawMetrics; }

export interface ProjectFingerprint {
    fingerprint: string;
    fileCount:   number;
}

export interface StoredFingerprintLike {
    fingerprint:     string;
    scannerVersion:  string;
}

export function isProjectFingerprintCurrent(current: ProjectFingerprint, previous: StoredFingerprintLike | null): boolean {
    return previous?.fingerprint === current.fingerprint &&
        previous.scannerVersion === SCANNER_FINGERPRINT_VERSION;
}

export function buildProjectFingerprint(projectPath: string, ignoreList?: string[], ignoredFiles?: string[]): ProjectFingerprint {
    const ignore = ignoreList ?? DEFAULT_IGNORE;
    const ignoredSet = new Set(ignoredFiles ?? []);
    const files: { path: string; size: number; mtimeMs: number }[] = [];
    for (const file of getFiles(projectPath, ignore)) {
        if (ignoredSet.has(file)) continue;
        try {
            const stat = fs.statSync(file);
            files.push({
                path:    path.relative(projectPath, file).split(path.sep).join('/'),
                size:    stat.size,
                mtimeMs: stat.mtimeMs,
            });
        } catch {
            // File changed during pre-scan; the next watcher-triggered scan will refresh the fingerprint.
        }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
        fingerprint: JSON.stringify({
            scannerVersion: SCANNER_FINGERPRINT_VERSION,
            files,
        }),
        fileCount: files.length,
    };
}

export async function scanProject(projectPath: string, ignoreList?: string[], ignoredFiles?: string[]): Promise<ScanResult> {
    const ignore      = ignoreList ?? DEFAULT_IGNORE;
    const ignoredSet  = new Set(ignoredFiles ?? []);
    const allFiles    = getFiles(projectPath, ignore);
    const files       = allFiles.filter(f => !ignoredSet.has(f));

    clearChurnCache();
    await buildChurnCache(projectPath);
    console.log(`[Cortex] Found ${files.length} files to scan`);

    const analyses: FileAnalysis[] = [];
    const fileSources = new Map<string, string>();

    for (const file of files) {
        try {
            const source = fs.readFileSync(file, 'utf-8');
            fileSources.set(file, source);
            const metrics = await analyzeFile(file);
            saveFunctions(file, metrics.functions, projectPath);
            const fns   = metrics.functions.filter(fn => fn.name !== 'anonymous');
            const churn = await getChurnScore(file, projectPath);
            const raw: RawMetrics = {
                complexity:          fns.length > 0 ? Math.max(...fns.map(f => f.cyclomaticComplexity))                          : 0,
                complexityMean:      fns.length > 0 ? fns.reduce((s, f) => s + f.cyclomaticComplexity, 0) / fns.length           : 0,
                cognitiveComplexity: fns.length > 0 ? Math.max(...fns.map(f => f.cognitiveComplexity ?? 0))                      : 0,
                functionSize:        fns.length > 0 ? Math.max(...fns.map(f => f.lineCount))                                     : 0,
                functionSizeMean:    fns.length > 0 ? fns.reduce((s, f) => s + f.lineCount, 0) / fns.length                      : 0,
                depth:               fns.length > 0 ? Math.max(...fns.map(f => f.maxDepth))                                      : 0,
                params:              fns.length > 0 ? Math.max(...fns.map(f => f.parameterCount))                                : 0,
                churn,
                fanIn:               0,
            };
            analyses.push({ metrics, raw });
        } catch (error) {
            console.error(`[Cortex] Error analyzing ${path.basename(file)}:`, error);
        }
    }

    const importGraph = buildImportGraph(files, fileSources, createImportResolveContext(projectPath));
    const edges = importGraph.edges;
    saveImportEdges(projectPath, edges);
    const d = importGraph.diagnostics;
    console.log(`[Cortex] Import graph — imports=${d.totalImports}, relative=${d.relativeImports}, aliases=${d.simpleAliasImports}, pythonAbsolute=${d.pythonAbsoluteImports}, external=${d.externalIgnored}, unresolved=${d.unresolvedImports}, edges=${d.edgesCreated}`);
    if (d.unresolvedExamples.length > 0) {
        console.warn('[Cortex] Unresolved import examples —', d.unresolvedExamples.map(ex =>
            `${path.relative(projectPath, ex.filePath)} imports "${ex.importPath}" (${ex.reason})`
        ).join(' | '));
    }
    const fanOutMap = new Map<string, number>();
    const fanInMap  = new Map<string, number>();
    for (const file of files) { fanOutMap.set(file, 0); fanInMap.set(file, 0); }
    for (const edge of edges) {
        fanOutMap.set(edge.from, (fanOutMap.get(edge.from) ?? 0) + 1);
        fanInMap.set(edge.to,   (fanInMap.get(edge.to)   ?? 0) + 1);
    }
    for (const analysis of analyses) {
        analysis.raw.fanIn = fanInMap.get(analysis.metrics.filePath) ?? 0;
    }

    const baselines = computeProjectBaselines(analyses.map(a => a.raw));
    console.log('[Cortex] Baselines —', Object.entries(baselines).map(([k, v]) => `${k}: p25=${v.p25.toFixed(1)} p90=${v.p90.toFixed(1)}`).join(' | '));

    const results: RiskScoreResult[] = analyses.map(({ metrics, raw }) =>
        scoreFromRaw(raw, metrics.filePath, metrics.language, baselines)
    );

    for (const result of results) {
        result.details.fanIn  = fanInMap.get(result.filePath)  ?? 0;
        result.details.fanOut = fanOutMap.get(result.filePath) ?? 0;
    }
    saveScans(results, projectPath);

    try {
        const couplings = await buildCouplingMap(projectPath);
        await saveCouplings(couplings, projectPath);
        console.log(`[Cortex] Coupling map built — ${couplings.size} files with co-changes`);
    } catch (err) {
        console.warn('[Cortex] Coupling map failed (non-fatal):', err);
    }

    console.log(`[Cortex] Scan complete — ${results.length} files, ${edges.length} connections`);

    return { files: results.sort((a, b) => b.globalScore - a.globalScore), edges };
}
