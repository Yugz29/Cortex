import { simpleGit } from 'simple-git';
import { join } from 'node:path';

export interface FileCoupling {
    fileA:        string;
    fileB:        string;
    coChangeCount: number;
}

interface CouplingMetrics {
    commits:           number;
    filesWithCoupling: number;
    pairs:             number;
    maxFilesPerCommit: number;
    ignoredCommits:    number;
}

interface CouplingCacheEntry {
    gitHead:      string;
    minCoChanges: number;
    couplingMap:  Map<string, FileCoupling[]>;
    metrics:      CouplingMetrics;
}

let _churnCache: Map<string, number> | null = null;
let _cachedProjectPath: string | null = null;
const _couplingCache = new Map<string, CouplingCacheEntry>();

function elapsedMs(start: number): number {
    return Date.now() - start;
}

export async function buildChurnCache(projectPath: string): Promise<void> {
    const startedAt = Date.now();
    try {
        const git = simpleGit(projectPath);
        const gitRoot = (await git.revparse(['--show-toplevel'])).trim();
        const log = await git.raw(['log', '--since=30 days ago', '--name-only', '--pretty=format:']);
        const logBytes = Buffer.byteLength(log, 'utf-8');
        _churnCache = new Map();
        for (const line of log.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const abs = join(gitRoot, trimmed);
            _churnCache.set(abs, (_churnCache.get(abs) ?? 0) + 1);
        }
        _cachedProjectPath = projectPath;
        console.log(`[Cortex] Churn cache built — ${_churnCache.size} files tracked, log=${logBytes}B in ${elapsedMs(startedAt)}ms`);
    } catch {
        _churnCache = new Map();
        _cachedProjectPath = projectPath;
    }
}

export function clearChurnCache(): void {
    _churnCache = null;
    _cachedProjectPath = null;
}

export async function getChurnScore(filePath: string, projectPath?: string): Promise<number> {
    if (!_churnCache) {
        if (!projectPath) throw new Error('getChurnScore: projectPath required on first call');
        await buildChurnCache(projectPath);
    }
    return _churnCache!.get(filePath) ?? 0;
}

export async function buildCouplingMap(
    projectPath: string,
    minCoChanges = 3,
): Promise<Map<string, FileCoupling[]>> {
    const startedAt = Date.now();
    const result = new Map<string, FileCoupling[]>();
    try {
        const git     = simpleGit(projectPath);
        const gitHead = (await git.revparse(['HEAD'])).trim();
        const cached = _couplingCache.get(projectPath);
        if (cached && cached.gitHead === gitHead && cached.minCoChanges === minCoChanges) {
            const m = cached.metrics;
            console.log(`[Cortex] Coupling map reused — ${m.filesWithCoupling} files, commits=${m.commits}, pairs=${m.pairs}, maxFilesPerCommit=${m.maxFilesPerCommit}, ignoredCommits=${m.ignoredCommits}, head=${gitHead.slice(0, 7)} in ${elapsedMs(startedAt)}ms`);
            return cached.couplingMap;
        }

        const gitRoot = (await git.revparse(['--show-toplevel'])).trim();
        const log = await git.raw(['log', '--since=90 days ago', '--name-only', '--pretty=format:%H']);
        const commitGroups = new Map<string, string[]>();
        let currentHash: string | null = null;
        for (const line of log.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/^[0-9a-f]{40}$/.test(trimmed)) {
                currentHash = trimmed;
                commitGroups.set(currentHash, []);
            } else if (currentHash) {
                const abs = join(gitRoot, trimmed);
                commitGroups.get(currentHash)!.push(abs);
            }
        }
        const pairCounts = new Map<string, number>();
        let totalPairsGenerated = 0;
        let maxFilesPerCommit = 0;
        let ignoredCommits = 0;
        for (const [, filesInCommit] of commitGroups) {
            maxFilesPerCommit = Math.max(maxFilesPerCommit, filesInCommit.length);
            if (filesInCommit.length < 2) {
                ignoredCommits++;
                continue;
            }
            for (let i = 0; i < filesInCommit.length; i++) {
                for (let j = i + 1; j < filesInCommit.length; j++) {
                    const a   = filesInCommit[i]!;
                    const b   = filesInCommit[j]!;
                    const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
                    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
                    totalPairsGenerated++;
                }
            }
        }
        for (const [key, count] of pairCounts) {
            if (count < minCoChanges) continue;
            const [fileA, fileB] = key.split('\0') as [string, string];
            const coupling: FileCoupling = { fileA, fileB, coChangeCount: count };
            if (!result.has(fileA)) result.set(fileA, []);
            if (!result.has(fileB)) result.set(fileB, []);
            result.get(fileA)!.push(coupling);
            result.get(fileB)!.push(coupling);
        }
        const metrics = {
            commits:           commitGroups.size,
            filesWithCoupling: result.size,
            pairs:             totalPairsGenerated,
            maxFilesPerCommit,
            ignoredCommits,
        };
        _couplingCache.set(projectPath, {
            gitHead,
            minCoChanges,
            couplingMap: result,
            metrics,
        });
        console.log(`[Cortex] Coupling map built — ${result.size} files, commits=${commitGroups.size}, pairs=${totalPairsGenerated}, maxFilesPerCommit=${maxFilesPerCommit}, ignoredCommits=${ignoredCommits}, head=${gitHead.slice(0, 7)} in ${elapsedMs(startedAt)}ms`);
    } catch { }
    return result;
}
