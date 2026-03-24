import Database from 'better-sqlite3';
import type { RiskScoreResult } from '../cortex/risk-score/riskScore.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { app } from 'electron';
import type { FunctionMetrics } from '../cortex/analyzer/parser.js';
import type { FileCoupling } from '../cortex/analyzer/churn.js';
import { runMigrations } from './migrations.js';

let _db: InstanceType<typeof Database> | null = null;

export function getDb(): InstanceType<typeof Database> {
    if (_db) return _db;
    // Le fichier s'appelle pulse.db pour des raisons historiques — ne pas renommer sans migration.
    const dbPath = app?.getPath
        ? join(app.getPath('userData'), 'pulse.db')
        : join(process.cwd(), 'pulse.db');
    console.log(`[Cortex] Opening DB at: ${dbPath}`);
    _db = new Database(dbPath);
    return _db;
}

export function initDb(): void {
    const db = getDb();
    runMigrations(db as any);
    _backfillSnapshotsIfNeeded(db);
}

function _backfillSnapshotsIfNeeded(db: InstanceType<typeof Database>): void {
    const snapshotCount = (db.prepare(`SELECT COUNT(*) as n FROM project_snapshots`).get() as { n: number }).n;
    if (snapshotCount > 0) return;

    const allScans = db.prepare(`
        SELECT project_path, global_score, scanned_at
        FROM scans WHERE project_path != ''
        ORDER BY project_path, scanned_at ASC
    `).all() as { project_path: string; global_score: number; scanned_at: string }[];
    if (allScans.length === 0) return;

    const runs: { project_path: string; scores: number[]; scanned_at: string }[] = [];
    let cur: typeof runs[0] | null = null;
    for (const row of allScans) {
        const ts = new Date(row.scanned_at).getTime();
        if (!cur || cur.project_path !== row.project_path || ts - new Date(cur.scanned_at).getTime() > 60_000) {
            cur = { project_path: row.project_path, scores: [], scanned_at: row.scanned_at };
            runs.push(cur);
        }
        cur.scores.push(row.global_score);
    }

    const insert = db.prepare(`
        INSERT INTO project_snapshots (project_path, avg_score, health_pct, file_count, scanned_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const run of runs) {
            const avg     = run.scores.reduce((a, b) => a + b, 0) / run.scores.length;
            const rounded = Math.round(avg * 10) / 10;
            insert.run(run.project_path, rounded, Math.max(0, 100 - rounded), run.scores.length, run.scanned_at);
        }
    })();
    console.log(`[Cortex] Backfilled ${runs.length} project snapshots from ${allScans.length} scan rows.`);
}

export function saveScan(result: RiskScoreResult, projectPath: string): void {
    const db   = getDb();
    const stmt = db.prepare(`
        INSERT INTO scans (
            file_path, global_score, hotspot_score,
            complexity_score, cognitive_complexity_score, function_size_score,
            churn_score, depth_score, param_score,
            fan_in, fan_out, language, project_path,
            raw_complexity, raw_cognitive_complexity, raw_function_size,
            raw_depth, raw_params, raw_churn,
            scanned_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        result.filePath, result.globalScore, result.hotspotScore,
        result.details.complexityScore, result.details.cognitiveComplexityScore,
        result.details.functionSizeScore, result.details.churnScore,
        result.details.depthScore, result.details.paramScore,
        result.details.fanIn, result.details.fanOut,
        result.language ?? 'unknown', projectPath,
        result.raw.complexity, result.raw.cognitiveComplexity, result.raw.functionSize,
        result.raw.depth, result.raw.params, result.raw.churn,
        new Date().toISOString()
    );
}

export function saveFunctions(filePath: string, functions: FunctionMetrics[], projectPath: string): void {
    const db = getDb();
    db.prepare(`DELETE FROM functions WHERE file_path = ?`).run(filePath);
    const stmt = db.prepare(`
        INSERT INTO functions (file_path, name, start_line, line_count, cyclomatic_complexity, cognitive_complexity, parameter_count, max_depth, project_path, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const fn of functions) {
        stmt.run(filePath, fn.name, fn.startLine, fn.lineCount, fn.cyclomaticComplexity, fn.cognitiveComplexity ?? 0, fn.parameterCount, fn.maxDepth, projectPath, now);
    }
}

export interface LatestScan {
    filePath: string;
    globalScore: number;
    hotspotScore: number;
    complexityScore: number;
    cognitiveComplexityScore: number;
    functionSizeScore: number;
    churnScore: number;
    depthScore: number;
    paramScore: number;
    fanIn: number;
    fanOut: number;
    language: string;
    scannedAt: string;
    trend: '↑' | '↓' | '↔';
    rawComplexity: number;
    rawCognitiveComplexity: number;
    rawFunctionSize: number;
    rawDepth: number;
    rawParams: number;
    rawChurn: number;
}

export function getLatestScans(projectPath: string): LatestScan[] {
    const db       = getDb();
    const today    = new Date().toISOString().slice(0, 10);
    const todayISO = `${today}T00:00:00.000Z`;

    const rows = db.prepare(`
        SELECT
            s.file_path,
            s.global_score,
            COALESCE(s.hotspot_score, 0)                   AS hotspot_score,
            s.complexity_score,
            COALESCE(s.cognitive_complexity_score, 0)      AS cognitive_complexity_score,
            s.function_size_score,
            s.churn_score,
            s.depth_score,
            s.param_score,
            s.fan_in,
            s.fan_out,
            s.language,
            s.scanned_at,
            COALESCE(s.raw_complexity, 0)                  AS raw_complexity,
            COALESCE(s.raw_cognitive_complexity, 0)        AS raw_cognitive_complexity,
            COALESCE(s.raw_function_size, 0)               AS raw_function_size,
            COALESCE(s.raw_depth, 0)                       AS raw_depth,
            COALESCE(s.raw_params, 0)                      AS raw_params,
            COALESCE(s.raw_churn, 0)                       AS raw_churn,
            COALESCE(base_today.global_score, base_prev.global_score) AS ref_score
        FROM scans s
        -- Dernier scan par fichier
        INNER JOIN (
            SELECT MAX(id) AS max_id
            FROM scans
            WHERE project_path = ?
            GROUP BY file_path
        ) latest ON s.id = latest.max_id
        -- Baseline : premier scan du jour
        LEFT JOIN (
            SELECT file_path, global_score
            FROM scans
            WHERE project_path = ? AND scanned_at >= ?
            GROUP BY file_path
            HAVING MIN(id)
        ) base_today ON base_today.file_path = s.file_path
        -- Baseline fallback : dernier scan avant aujourd'hui
        LEFT JOIN (
            SELECT file_path, global_score
            FROM scans
            WHERE project_path = ? AND scanned_at < ?
            GROUP BY file_path
            HAVING MAX(id)
        ) base_prev ON base_prev.file_path = s.file_path AND base_today.file_path IS NULL
        ORDER BY s.global_score DESC
    `).all(projectPath, projectPath, todayISO, projectPath, todayISO) as any[];

    return rows.map(row => {
        let trend: '↑' | '↓' | '↔' = '↔';
        if (row.ref_score !== null && row.ref_score !== undefined) {
            const delta = row.global_score - row.ref_score;
            if (delta > 2)  trend = '↑';
            if (delta < -2) trend = '↓';
        }
        return {
            filePath:                 row.file_path,
            globalScore:              row.global_score,
            hotspotScore:             row.hotspot_score,
            complexityScore:          row.complexity_score,
            cognitiveComplexityScore: row.cognitive_complexity_score,
            functionSizeScore:        row.function_size_score,
            churnScore:               row.churn_score,
            depthScore:               row.depth_score,
            paramScore:               row.param_score,
            fanIn:                    row.fan_in,
            fanOut:                   row.fan_out,
            language:                 row.language,
            scannedAt:                row.scanned_at,
            trend,
            rawComplexity:            row.raw_complexity,
            rawCognitiveComplexity:   row.raw_cognitive_complexity,
            rawFunctionSize:          row.raw_function_size,
            rawDepth:                 row.raw_depth,
            rawParams:                row.raw_params,
            rawChurn:                 row.raw_churn,
        };
    });
}

export function getScoreHistory(filePath: string): { score: number; scanned_at: string }[] {
    const rows = getDb().prepare(`
        SELECT ROUND(AVG(global_score), 2) as score,
               MIN(scanned_at)            as scanned_at
        FROM scans
        WHERE file_path = ?
        GROUP BY strftime('%Y-%m-%dT%H', scanned_at)
        ORDER BY scanned_at DESC
        LIMIT 200
    `).all(filePath) as { score: number; scanned_at: string }[];

    rows.reverse();

    return rows.filter((r, i) => {
        if (i === 0 || i === rows.length - 1) return true;
        const prev = rows[i - 1]!;
        return Math.abs(r.score - prev.score) >= 0.1;
    });
}

export function getProjectScoreHistory(projectPath: string): { date: string; score: number }[] {
    const rows = getDb().prepare(`
        SELECT substr(scanned_at, 1, 10) as date, ROUND(AVG(global_score), 2) as score
        FROM scans WHERE project_path = ?
        GROUP BY substr(scanned_at, 1, 10)
        ORDER BY date ASC LIMIT 60
    `).all(projectPath) as { date: string; score: number }[];
    return rows.filter((r, i) => {
        if (i === 0 || i === rows.length - 1) return true;
        const prev = rows[i - 1]!;
        return Math.abs(r.score - prev.score) > 0.5;
    });
}

const ALWAYS_IGNORE_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build', 'assets', '.vite', '__pycache__', 'venv', '.venv', 'env', 'site-packages', 'migrations']);

/** Supprime de la DB les scans de fichiers dans des dossiers désormais toujours exclus. */
export function purgeIgnoredFromDb(): void {
    const db       = getDb();
    const allPaths = db.prepare('SELECT DISTINCT file_path FROM scans').all() as { file_path: string }[];
    const toDelete = allPaths.filter(({ file_path }) =>
        file_path.split('/').some(seg => ALWAYS_IGNORE_DIRS.has(seg))
    );
    if (toDelete.length === 0) return;
    const stmt = db.prepare('DELETE FROM scans WHERE file_path = ?');
    for (const { file_path } of toDelete) stmt.run(file_path);
    console.log(`[DB] Purged ${toDelete.length} build artifact(s).`);
}

export function cleanDeletedFiles(): number {
    const db = getDb();
    const files = db.prepare(`SELECT DISTINCT file_path FROM scans`).all() as { file_path: string }[];
    let deleted = 0;
    for (const { file_path } of files) {
        if (!existsSync(file_path)) {
            db.prepare(`DELETE FROM scans WHERE file_path = ?`).run(file_path);
            db.prepare(`DELETE FROM functions WHERE file_path = ?`).run(file_path);
            deleted++;
        }
    }
    return deleted;
}

export function getFunctions(filePath: string) {
    return getDb().prepare(`
        SELECT name, start_line, line_count, cyclomatic_complexity, cognitive_complexity, parameter_count, max_depth
        FROM functions WHERE file_path = ? ORDER BY cyclomatic_complexity DESC
    `).all(filePath) as { name: string; start_line: number; line_count: number; cyclomatic_complexity: number; cognitive_complexity: number; parameter_count: number; max_depth: number }[];
}

export function saveCouplings(couplings: Map<string, FileCoupling[]>, projectPath: string): void {
    const db  = getDb();
    const now = new Date().toISOString();
    db.prepare(`DELETE FROM couplings WHERE project_path = ?`).run(projectPath);
    const stmt = db.prepare(`INSERT INTO couplings (file_a, file_b, co_change_count, project_path, updated_at) VALUES (?, ?, ?, ?, ?)`);
    const inserted = new Set<string>();
    for (const [, pairs] of couplings) {
        for (const { fileA, fileB, coChangeCount } of pairs) {
            const key = fileA < fileB ? `${fileA}\0${fileB}` : `${fileB}\0${fileA}`;
            if (inserted.has(key)) continue;
            inserted.add(key);
            stmt.run(fileA, fileB, coChangeCount, projectPath, now);
        }
    }
}

/** Sauvegarde un snapshot uniquement si le score a changé OU si c'est un nouveau jour. */
export function saveProjectSnapshot(projectPath: string, avgScore: number, fileCount: number): void {
    const db      = getDb();
    const rounded = Math.round(avgScore * 10) / 10;
    const now     = new Date();
    const today   = now.toISOString().slice(0, 10);

    const last = db.prepare(`
        SELECT avg_score, substr(scanned_at, 1, 10) as day
        FROM project_snapshots WHERE project_path = ?
        ORDER BY scanned_at DESC LIMIT 1
    `).get(projectPath) as { avg_score: number; day: string } | undefined;

    const isNewDay     = !last || last.day !== today;
    const scoreChanged = !last || Math.abs(last.avg_score - rounded) >= 0.1;

    if (!isNewDay && !scoreChanged) return;

    db.prepare(`
        INSERT INTO project_snapshots (project_path, avg_score, health_pct, file_count, scanned_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        projectPath,
        rounded,
        Math.round(Math.max(0, 100 - rounded) * 10) / 10,
        fileCount,
        now.toISOString(),
    );
}

type HistoryPoint = { date: string; score: number; healthPct: number };

/** Historique par scan — 1 point par scan où le score a changé ou nouveau jour. */
export function getProjectHistory(projectPath: string): HistoryPoint[] {
    const rows = getDb().prepare(`
        SELECT avg_score, health_pct, scanned_at
        FROM project_snapshots
        WHERE project_path = ?
        ORDER BY scanned_at ASC LIMIT 500
    `).all(projectPath) as { avg_score: number; health_pct: number; scanned_at: string }[];

    return rows.map(r => ({ date: r.scanned_at, score: r.avg_score, healthPct: r.health_pct }));
}

/** Historique par jour — moyenne des snapshots par jour calendaire. */
export function getProjectHistoryByDay(projectPath: string): HistoryPoint[] {
    const rows = getDb().prepare(`
        SELECT substr(scanned_at, 1, 10) || 'T12:00:00.000Z' as date,
               ROUND(AVG(avg_score), 1)   as score,
               ROUND(AVG(health_pct), 1)  as healthPct
        FROM project_snapshots
        WHERE project_path = ?
        GROUP BY substr(scanned_at, 1, 10)
        ORDER BY date ASC LIMIT 200
    `).all(projectPath) as { date: string; score: number; healthPct: number }[];

    return rows;
}

export function getProjectSummary(projectPath: string): { avgScore: number | null; fileCount: number } {
    const db = getDb();
    const scoreRow = db.prepare(`
        SELECT ROUND(AVG(global_score), 1) as avg_score, COUNT(*) as file_count
        FROM scans s
        INNER JOIN (
            SELECT MAX(id) as max_id FROM scans WHERE project_path = ? GROUP BY file_path
        ) latest ON s.id = latest.max_id
    `).get(projectPath) as { avg_score: number | null; file_count: number } | undefined;
    return { avgScore: scoreRow?.avg_score ?? null, fileCount: scoreRow?.file_count ?? 0 };
}
