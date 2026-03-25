import { app, ipcMain, dialog, shell, BrowserWindow, Notification } from "electron";
import * as path from "node:path";
import path__default, { join } from "node:path";
import * as fs from "node:fs";
import fs__default, { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { SyntaxKind, Project } from "ts-morph";
import { simpleGit } from "simple-git";
import { execFile } from "node:child_process";
import chokidar from "chokidar";
import { EventEmitter } from "node:events";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const CURRENT_VERSION = 8;
const MIGRATIONS = [
  {
    version: 1,
    description: "Initial schema — scans, feedbacks, functions",
    up: (db) => {
      db.exec(`
                CREATE TABLE IF NOT EXISTS scans (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path           TEXT    NOT NULL,
                    global_score        REAL    NOT NULL,
                    complexity_score    REAL    NOT NULL DEFAULT 0,
                    function_size_score REAL    NOT NULL DEFAULT 0,
                    churn_score         REAL    NOT NULL DEFAULT 0,
                    depth_score         REAL    NOT NULL DEFAULT 0,
                    param_score         REAL    NOT NULL DEFAULT 0,
                    fan_in              INTEGER NOT NULL DEFAULT 0,
                    fan_out             INTEGER NOT NULL DEFAULT 0,
                    language            TEXT    NOT NULL DEFAULT 'unknown',
                    project_path        TEXT    NOT NULL DEFAULT '',
                    scanned_at          TEXT    NOT NULL
                )
            `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scans_project_file ON scans(project_path, file_path)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scans_project_id   ON scans(project_path, id DESC)`);
      db.exec(`
                CREATE TABLE IF NOT EXISTS feedbacks (
                    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path          TEXT NOT NULL,
                    action             TEXT NOT NULL,
                    risk_score_at_time REAL NOT NULL,
                    created_at         TEXT NOT NULL
                )
            `);
      db.exec(`
                CREATE TABLE IF NOT EXISTS functions (
                    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path             TEXT    NOT NULL,
                    name                  TEXT    NOT NULL,
                    start_line            INTEGER NOT NULL,
                    line_count            INTEGER NOT NULL,
                    cyclomatic_complexity INTEGER NOT NULL,
                    cognitive_complexity  INTEGER NOT NULL DEFAULT 0,
                    parameter_count       INTEGER NOT NULL DEFAULT 0,
                    max_depth             INTEGER NOT NULL DEFAULT 0,
                    project_path          TEXT    NOT NULL DEFAULT '',
                    scanned_at            TEXT    NOT NULL
                )
            `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_functions_file ON functions(file_path)`);
    }
  },
  {
    version: 2,
    description: "Add raw metric columns to scans",
    up: (db) => {
      const cols = [
        `raw_complexity          INTEGER NOT NULL DEFAULT 0`,
        `raw_cognitive_complexity INTEGER NOT NULL DEFAULT 0`,
        `raw_function_size       INTEGER NOT NULL DEFAULT 0`,
        `raw_depth               INTEGER NOT NULL DEFAULT 0`,
        `raw_params              INTEGER NOT NULL DEFAULT 0`,
        `raw_churn               REAL    NOT NULL DEFAULT 0`,
        `cognitive_complexity_score REAL NOT NULL DEFAULT 0`,
        `hotspot_score           REAL    NOT NULL DEFAULT 0`
      ];
      for (const col of cols) {
        try {
          db.exec(`ALTER TABLE scans ADD COLUMN ${col}`);
        } catch {
        }
      }
    }
  },
  {
    version: 3,
    description: "Couplings and weight_state tables",
    up: (db) => {
      db.exec(`
                CREATE TABLE IF NOT EXISTS couplings (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_a          TEXT    NOT NULL,
                    file_b          TEXT    NOT NULL,
                    co_change_count INTEGER NOT NULL DEFAULT 0,
                    project_path    TEXT    NOT NULL,
                    updated_at      TEXT    NOT NULL
                )
            `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_couplings_file_a ON couplings(file_a, project_path)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_couplings_file_b ON couplings(file_b, project_path)`);
      db.exec(`
                CREATE TABLE IF NOT EXISTS weight_state (
                    project_path TEXT PRIMARY KEY,
                    weights      TEXT NOT NULL,
                    updated_at   TEXT NOT NULL
                )
            `);
    }
  },
  {
    version: 4,
    description: "LLM reports and intel messages tables — legacy (LLM supprimé)",
    up: (db) => {
      db.exec(`
                CREATE TABLE IF NOT EXISTS llm_reports (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path  TEXT NOT NULL UNIQUE,
                    report     TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            `);
      db.exec(`
                CREATE TABLE IF NOT EXISTS intel_messages (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_path TEXT NOT NULL,
                    role         TEXT NOT NULL,
                    content      TEXT NOT NULL,
                    created_at   TEXT NOT NULL
                )
            `);
    }
  },
  {
    version: 5,
    description: "Terminal errors and episodes tables — legacy (LLM supprimé)",
    up: (db) => {
      db.exec(`
                CREATE TABLE IF NOT EXISTS terminal_errors (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    command      TEXT    NOT NULL,
                    exit_code    INTEGER NOT NULL,
                    error_hash   TEXT    NOT NULL,
                    error_text   TEXT    NOT NULL DEFAULT '',
                    cwd          TEXT    NOT NULL DEFAULT '',
                    project_path TEXT    NOT NULL DEFAULT '',
                    llm_response TEXT,
                    resolved     INTEGER NOT NULL DEFAULT 0,
                    created_at   TEXT    NOT NULL
                )
            `);
      db.exec(`
                CREATE TABLE IF NOT EXISTS episodes (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    type       TEXT NOT NULL DEFAULT 'chat',
                    organ      TEXT NOT NULL DEFAULT 'cortex',
                    llm_used   TEXT NOT NULL DEFAULT '',
                    messages   TEXT NOT NULL DEFAULT '[]',
                    summary    TEXT,
                    embedding  BLOB,
                    status     TEXT NOT NULL DEFAULT 'open',
                    context    TEXT,
                    links_to   TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            `);
    }
  },
  {
    version: 6,
    description: "Project snapshots table for history tracking",
    up: (db) => {
      db.exec(`
                CREATE TABLE IF NOT EXISTS project_snapshots (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_path TEXT NOT NULL,
                    avg_score    REAL NOT NULL,
                    health_pct   REAL NOT NULL,
                    file_count   INTEGER NOT NULL,
                    scanned_at   TEXT NOT NULL
                )
            `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_project ON project_snapshots(project_path, scanned_at)`);
    }
  },
  {
    version: 7,
    description: "Add llm_report column to scans (legacy — kept for compat)",
    up: (db) => {
      try {
        db.exec(`ALTER TABLE scans ADD COLUMN llm_report TEXT`);
      } catch {
      }
    }
  },
  {
    version: 8,
    description: "Performance indexes on feedbacks and scans",
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_feedbacks_file ON feedbacks(file_path, created_at DESC)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_project_at ON project_snapshots(project_path, scanned_at DESC)`);
    }
  }
];
function runMigrations(db) {
  db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version    INTEGER NOT NULL,
            applied_at TEXT    NOT NULL
        )
    `);
  const row = db.prepare(`SELECT MAX(version) as v FROM schema_version`).get();
  const currentVersion = row.v ?? 0;
  if (currentVersion >= CURRENT_VERSION) return;
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  console.log(`[DB] Applying ${pending.length} migration(s) (schema v${currentVersion} → v${CURRENT_VERSION})`);
  const insertVersion = db.prepare(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`);
  for (const migration of pending) {
    const applyMigration = db.transaction(() => {
      migration.up(db);
      insertVersion.run(migration.version, (/* @__PURE__ */ new Date()).toISOString());
    });
    try {
      applyMigration();
      console.log(`[DB] ✓ Migration ${migration.version}: ${migration.description}`);
    } catch (err) {
      console.error(`[DB] ✗ Migration ${migration.version} failed:`, err);
      throw err;
    }
  }
}
let _db = null;
function getDb() {
  if (_db) return _db;
  const dbPath = app?.getPath ? join(app.getPath("userData"), "pulse.db") : join(process.cwd(), "pulse.db");
  console.log(`[Cortex] Opening DB at: ${dbPath}`);
  _db = new Database(dbPath);
  return _db;
}
function initDb() {
  const db = getDb();
  runMigrations(db);
  _backfillSnapshotsIfNeeded(db);
}
function _backfillSnapshotsIfNeeded(db) {
  const snapshotCount = db.prepare(`SELECT COUNT(*) as n FROM project_snapshots`).get().n;
  if (snapshotCount > 0) return;
  const allScans = db.prepare(`
        SELECT project_path, global_score, scanned_at
        FROM scans WHERE project_path != ''
        ORDER BY project_path, scanned_at ASC
    `).all();
  if (allScans.length === 0) return;
  const runs = [];
  let cur = null;
  for (const row of allScans) {
    const ts = new Date(row.scanned_at).getTime();
    if (!cur || cur.project_path !== row.project_path || ts - new Date(cur.scanned_at).getTime() > 6e4) {
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
      const avg = run.scores.reduce((a, b) => a + b, 0) / run.scores.length;
      const rounded = Math.round(avg * 10) / 10;
      insert.run(run.project_path, rounded, Math.max(0, 100 - rounded), run.scores.length, run.scanned_at);
    }
  })();
  console.log(`[Cortex] Backfilled ${runs.length} project snapshots from ${allScans.length} scan rows.`);
}
function saveScan(result, projectPath) {
  const db = getDb();
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
    result.filePath,
    result.globalScore,
    result.hotspotScore,
    result.details.complexityScore,
    result.details.cognitiveComplexityScore,
    result.details.functionSizeScore,
    result.details.churnScore,
    result.details.depthScore,
    result.details.paramScore,
    result.details.fanIn,
    result.details.fanOut,
    result.language ?? "unknown",
    projectPath,
    result.raw.complexity,
    result.raw.cognitiveComplexity,
    result.raw.functionSize,
    result.raw.depth,
    result.raw.params,
    result.raw.churn,
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function saveFunctions(filePath, functions, projectPath) {
  const db = getDb();
  db.prepare(`DELETE FROM functions WHERE file_path = ?`).run(filePath);
  const stmt = db.prepare(`
        INSERT INTO functions (file_path, name, start_line, line_count, cyclomatic_complexity, cognitive_complexity, parameter_count, max_depth, project_path, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const fn of functions) {
    stmt.run(filePath, fn.name, fn.startLine, fn.lineCount, fn.cyclomaticComplexity, fn.cognitiveComplexity ?? 0, fn.parameterCount, fn.maxDepth, projectPath, now);
  }
}
function getLatestScans(projectPath) {
  const db = getDb();
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
    `).all(projectPath, projectPath, todayISO, projectPath, todayISO);
  return rows.map((row) => {
    let trend = "↔";
    if (row.ref_score !== null && row.ref_score !== void 0) {
      const delta = row.global_score - row.ref_score;
      if (delta > 2) trend = "↑";
      if (delta < -2) trend = "↓";
    }
    return {
      filePath: row.file_path,
      globalScore: row.global_score,
      hotspotScore: row.hotspot_score,
      complexityScore: row.complexity_score,
      cognitiveComplexityScore: row.cognitive_complexity_score,
      functionSizeScore: row.function_size_score,
      churnScore: row.churn_score,
      depthScore: row.depth_score,
      paramScore: row.param_score,
      fanIn: row.fan_in,
      fanOut: row.fan_out,
      language: row.language,
      scannedAt: row.scanned_at,
      trend,
      rawComplexity: row.raw_complexity,
      rawCognitiveComplexity: row.raw_cognitive_complexity,
      rawFunctionSize: row.raw_function_size,
      rawDepth: row.raw_depth,
      rawParams: row.raw_params,
      rawChurn: row.raw_churn
    };
  });
}
function getScoreHistory(filePath) {
  const rows = getDb().prepare(`
        SELECT ROUND(AVG(global_score), 2) as score,
               MIN(scanned_at)            as scanned_at
        FROM scans
        WHERE file_path = ?
        GROUP BY strftime('%Y-%m-%dT%H', scanned_at)
        ORDER BY scanned_at DESC
        LIMIT 200
    `).all(filePath);
  rows.reverse();
  return rows.filter((r, i) => {
    if (i === 0 || i === rows.length - 1) return true;
    const prev = rows[i - 1];
    return Math.abs(r.score - prev.score) >= 0.1;
  });
}
function getProjectScoreHistory(projectPath) {
  const rows = getDb().prepare(`
        SELECT substr(scanned_at, 1, 10) as date, ROUND(AVG(global_score), 2) as score
        FROM scans WHERE project_path = ?
        GROUP BY substr(scanned_at, 1, 10)
        ORDER BY date ASC LIMIT 60
    `).all(projectPath);
  return rows.filter((r, i) => {
    if (i === 0 || i === rows.length - 1) return true;
    const prev = rows[i - 1];
    return Math.abs(r.score - prev.score) > 0.5;
  });
}
const ALWAYS_IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "out", "dist", "build", "assets", ".vite", "__pycache__", "venv", ".venv", "env", "site-packages", "migrations"]);
function purgeIgnoredFromDb() {
  const db = getDb();
  const allPaths = db.prepare("SELECT DISTINCT file_path FROM scans").all();
  const toDelete = allPaths.filter(
    ({ file_path }) => file_path.split("/").some((seg) => ALWAYS_IGNORE_DIRS.has(seg))
  );
  if (toDelete.length === 0) return;
  const stmt = db.prepare("DELETE FROM scans WHERE file_path = ?");
  for (const { file_path } of toDelete) stmt.run(file_path);
  console.log(`[DB] Purged ${toDelete.length} build artifact(s).`);
}
function cleanDeletedFiles() {
  const db = getDb();
  const files = db.prepare(`SELECT DISTINCT file_path FROM scans`).all();
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
function getFunctions(filePath) {
  return getDb().prepare(`
        SELECT name, start_line, line_count, cyclomatic_complexity, cognitive_complexity, parameter_count, max_depth
        FROM functions WHERE file_path = ? ORDER BY cyclomatic_complexity DESC
    `).all(filePath);
}
function saveCouplings(couplings, projectPath) {
  const db = getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(`DELETE FROM couplings WHERE project_path = ?`).run(projectPath);
  const stmt = db.prepare(`INSERT INTO couplings (file_a, file_b, co_change_count, project_path, updated_at) VALUES (?, ?, ?, ?, ?)`);
  const inserted = /* @__PURE__ */ new Set();
  for (const [, pairs] of couplings) {
    for (const { fileA, fileB, coChangeCount } of pairs) {
      const key = fileA < fileB ? `${fileA}\0${fileB}` : `${fileB}\0${fileA}`;
      if (inserted.has(key)) continue;
      inserted.add(key);
      stmt.run(fileA, fileB, coChangeCount, projectPath, now);
    }
  }
}
function saveProjectSnapshot(projectPath, avgScore, fileCount) {
  const db = getDb();
  const rounded = Math.round(avgScore * 10) / 10;
  const now = /* @__PURE__ */ new Date();
  const today = now.toISOString().slice(0, 10);
  const last = db.prepare(`
        SELECT avg_score, substr(scanned_at, 1, 10) as day
        FROM project_snapshots WHERE project_path = ?
        ORDER BY scanned_at DESC LIMIT 1
    `).get(projectPath);
  const isNewDay = !last || last.day !== today;
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
    now.toISOString()
  );
}
function getProjectHistory(projectPath) {
  const rows = getDb().prepare(`
        SELECT avg_score, health_pct, scanned_at
        FROM project_snapshots
        WHERE project_path = ?
        ORDER BY scanned_at ASC LIMIT 500
    `).all(projectPath);
  return rows.map((r) => ({ date: r.scanned_at, score: r.avg_score, healthPct: r.health_pct }));
}
function getProjectHistoryByDay(projectPath) {
  const rows = getDb().prepare(`
        SELECT substr(scanned_at, 1, 10) || 'T12:00:00.000Z' as date,
               ROUND(AVG(avg_score), 1)   as score,
               ROUND(AVG(health_pct), 1)  as healthPct
        FROM project_snapshots
        WHERE project_path = ?
        GROUP BY substr(scanned_at, 1, 10)
        ORDER BY date ASC LIMIT 200
    `).all(projectPath);
  return rows;
}
function getProjectSummary(projectPath) {
  const db = getDb();
  const scoreRow = db.prepare(`
        SELECT ROUND(AVG(global_score), 1) as avg_score, COUNT(*) as file_count
        FROM scans s
        INNER JOIN (
            SELECT MAX(id) as max_id FROM scans WHERE project_path = ? GROUP BY file_path
        ) latest ON s.id = latest.max_id
    `).get(projectPath);
  return { avgScore: scoreRow?.avg_score ?? null, fileCount: scoreRow?.file_count ?? 0 };
}
const EXTENSION_MAP = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python"
};
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? "unknown";
}
let _sharedProject = null;
function getSharedProject() {
  if (!_sharedProject) {
    _sharedProject = new Project({
      useInMemoryFileSystem: false,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true, skipLibCheck: true }
    });
  }
  return _sharedProject;
}
function resolveFunctionName(fn) {
  if ("getName" in fn && typeof fn.getName === "function") {
    const name = fn.getName();
    if (name) return name;
  }
  let cursor = fn.getParent();
  for (let i = 0; i < 3 && cursor; i++) {
    const kind = cursor.getKind();
    if (kind === SyntaxKind.VariableDeclaration) {
      const varDecl = cursor;
      const name = varDecl.getName();
      if (name) return name;
    }
    if (kind === SyntaxKind.PropertyAssignment) {
      const prop = cursor;
      const nameNode = prop.getNameNode();
      const text = nameNode.getText();
      if (text) return text;
    }
    if (kind === SyntaxKind.Parameter) {
      const param = cursor;
      const name = param.getName();
      if (name) return `<param:${name}>`;
    }
    if (kind === SyntaxKind.BinaryExpression) {
      const bin = cursor;
      const left = bin.getLeft().getText();
      const shortName = left.split(".").pop();
      if (shortName) return shortName;
    }
    cursor = cursor.getParent();
  }
  return "anonymous";
}
const NESTING_KINDS = /* @__PURE__ */ new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.TryStatement,
  // JSX conditionnel — on compte l'imbrication logique, pas l'imbrication HTML structurelle
  // JsxExpression = { condition && <X/> } ou { condition ? <A/> : <B/> } dans du JSX
  SyntaxKind.JsxExpression
]);
function computeMaxDepth(node, current = 0, isRoot = false) {
  let max = current;
  for (const child of node.getChildren()) {
    const kind = child.getKind();
    if (!isRoot && (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression || kind === SyntaxKind.FunctionDeclaration)) continue;
    const next = NESTING_KINDS.has(kind) ? current + 1 : current;
    max = Math.max(max, computeMaxDepth(child, next, false));
  }
  return max;
}
const COMPLEXITY_KINDS = /* @__PURE__ */ new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken
]);
const COGNITIVE_BREAK_KINDS = /* @__PURE__ */ new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken
]);
const COGNITIVE_NESTING_KINDS = /* @__PURE__ */ new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.TryStatement
]);
function computeCognitiveComplexity(node, nestingLevel = 0, isRoot = false) {
  let score = 0;
  for (const child of node.getChildren()) {
    const kind = child.getKind();
    if (!isRoot && (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression || kind === SyntaxKind.FunctionDeclaration)) continue;
    if (COGNITIVE_BREAK_KINDS.has(kind)) {
      score += 1 + nestingLevel;
    }
    if (kind === SyntaxKind.ElseKeyword) {
      score += 1;
    }
    const nextLevel = COGNITIVE_NESTING_KINDS.has(kind) ? nestingLevel + 1 : nestingLevel;
    score += computeCognitiveComplexity(child, nextLevel, false);
  }
  return score;
}
function analyzeSourceFile(sourceFile, filePath, language) {
  const totalLines = sourceFile.getEndLineNumber();
  const allFunctions = [
    ...sourceFile.getFunctions(),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getClasses().flatMap((cls) => cls.getMethods())
  ];
  const functions = allFunctions.map((fn) => {
    const name = resolveFunctionName(fn);
    const startLine = fn.getStartLineNumber();
    const lineCount = fn.getEndLineNumber() - startLine + 1;
    let cyclomaticComplexity = 1;
    fn.forEachDescendant((node, traversal) => {
      const kind = node.getKind();
      if (node !== fn && (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression || kind === SyntaxKind.FunctionDeclaration)) {
        traversal.skip();
        return;
      }
      if (COMPLEXITY_KINDS.has(kind)) cyclomaticComplexity++;
    });
    const cognitiveComplexity = computeCognitiveComplexity(fn, 0, true);
    const parameterCount = (() => {
      if (!("getParameters" in fn) || typeof fn.getParameters !== "function") return 0;
      const params = fn.getParameters();
      if (params.length === 0) return 0;
      if (params.length === 1) {
        const nameNode = params[0].getNameNode();
        if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
          const elements = nameNode.getElements();
          return elements.length;
        }
      }
      return params.length;
    })();
    const maxDepth = computeMaxDepth(fn, 0, true);
    return { name, startLine, lineCount, cyclomaticComplexity, cognitiveComplexity, parameterCount, maxDepth };
  });
  return { filePath, totalLines, totalFunctions: functions.length, functions, language };
}
function analyzeWithTsMorph(filePath) {
  const language = detectLanguage(filePath);
  const project = getSharedProject();
  const existing = project.getSourceFile(filePath);
  if (existing) project.removeSourceFile(existing);
  const sourceFile = project.addSourceFileAtPath(filePath);
  const result = analyzeSourceFile(sourceFile, filePath, language);
  project.removeSourceFile(sourceFile);
  return result;
}
function analyzeWithRegex(source, filePath, language) {
  const lines = source.split("\n");
  const patterns = [
    /^\s*def\s+(\w+)\s*\(/,
    /^\s*async\s+def\s+(\w+)\s*\(/
  ];
  const complexityPatterns = [
    /\bif\b/,
    /\belif\b/,
    /\bfor\b/,
    /\bwhile\b/,
    /\bexcept\b/,
    /\band\b/,
    /\bor\b/
  ];
  const cogNestingPatterns = [
    /^\s*(if|elif|for|while|with|try)\b/
  ];
  const cogBreakPatterns = [
    /\bif\b/,
    /\belif\b/,
    /\belse\b/,
    /\bfor\b/,
    /\bwhile\b/,
    /\bexcept\b/,
    /\bfinally\b/,
    /\band\b/,
    /\bor\b/
  ];
  const functions = [];
  lines.forEach((line, i) => {
    for (const pat of patterns) {
      if (pat.test(line)) {
        const nameMatch = /(?:def\s+|async\s+def\s+)(\w+)/.exec(line);
        const name = nameMatch?.[1] ?? "anonymous";
        let endLine = lines.length;
        for (let j = i + 1; j < lines.length; j++) {
          if (patterns.some((p) => p.test(lines[j] ?? ""))) {
            endLine = j;
            break;
          }
        }
        const fnLines = lines.slice(i, endLine);
        const cyclomaticComplexity = 1 + fnLines.reduce((acc, l) => acc + complexityPatterns.filter((p) => p.test(l)).length, 0);
        let cognitiveComplexity = 0;
        for (const fl of fnLines) {
          const indent = Math.floor((fl.match(/^(\s+)/)?.[1]?.replace(/\t/g, "    ").length ?? 0) / 4);
          const nestingLevel = Math.max(0, indent - 1);
          if (cogBreakPatterns.some((p) => p.test(fl))) {
            cognitiveComplexity += 1 + (cogNestingPatterns.some((p) => p.test(fl)) ? nestingLevel : 0);
          }
        }
        const sigMatch = /\(([^)]*)\)/.exec(line);
        const parameterCount = sigMatch?.[1]?.trim() ? sigMatch[1].split(",").filter((p) => p.trim().length > 0).length : 0;
        const maxDepth = fnLines.reduce((max, l) => {
          const indent = l.match(/^(\s+)/)?.[1] ?? "";
          const depth = Math.floor(indent.replace(/\t/g, "    ").length / 4);
          return Math.max(max, depth);
        }, 0);
        functions.push({
          name,
          startLine: i + 1,
          lineCount: fnLines.length,
          cyclomaticComplexity,
          cognitiveComplexity,
          parameterCount,
          maxDepth
        });
        break;
      }
    }
  });
  return { filePath, totalLines: lines.length, totalFunctions: functions.length, functions, language };
}
async function analyzeFile(filePath) {
  const language = detectLanguage(filePath);
  if (language === "typescript" || language === "javascript") {
    try {
      return analyzeWithTsMorph(filePath);
    } catch (err) {
      console.warn(`[Pulse] ts-morph failed for ${filePath}, using regex fallback:`, err);
    }
  }
  const source = fs.readFileSync(filePath, "utf-8");
  return analyzeWithRegex(source, filePath, language);
}
const REFERENCE_BASELINES = {
  complexity: { p25: 3, p90: 12 },
  complexityMean: { p25: 1.5, p90: 5 },
  cognitiveComplexity: { p25: 4, p90: 30 },
  functionSize: { p25: 15, p90: 60 },
  functionSizeMean: { p25: 8, p90: 30 },
  depth: { p25: 1, p90: 4 },
  params: { p25: 2, p90: 5 },
  churn: { p25: 1, p90: 10 },
  fanIn: { p25: 1, p90: 10 }
};
const FILE_TYPE_OVERRIDES = {
  entrypoint: {
    complexity: { p25: 8, p90: 40 },
    cognitiveComplexity: { p25: 10, p90: 80 },
    functionSize: { p25: 30, p90: 200 },
    functionSizeMean: { p25: 15, p90: 80 }
  },
  // TSX : seuils relevés pour absorber les ternaires de style JSX.
  // Un composant bien écrit avec 20 ternaires de style peut avoir cx=25-30 — c'est normal.
  // On flag uniquement la vraie logique métier imbriquée (cx > 40, cog > 60).
  "component-tsx": {
    complexity: { p25: 5, p90: 40 },
    // vs 3/12 générique
    complexityMean: { p25: 3, p90: 15 },
    cognitiveComplexity: { p25: 8, p90: 60 },
    // vs 4/30 générique
    functionSize: { p25: 25, p90: 120 },
    // fonctions de rendu naturellement grandes
    functionSizeMean: { p25: 12, p90: 50 },
    depth: { p25: 2, p90: 5 }
    // JSX imbrique naturellement plus
  },
  "component-jsx": {
    complexity: { p25: 5, p90: 35 },
    complexityMean: { p25: 3, p90: 12 },
    cognitiveComplexity: { p25: 8, p90: 55 },
    functionSize: { p25: 25, p90: 100 },
    functionSizeMean: { p25: 12, p90: 45 },
    depth: { p25: 2, p90: 5 }
  },
  service: {
    complexity: { p25: 4, p90: 18 },
    cognitiveComplexity: { p25: 6, p90: 40 },
    functionSize: { p25: 20, p90: 80 },
    functionSizeMean: { p25: 12, p90: 40 },
    churn: { p25: 2, p90: 15 }
  },
  parser: {
    complexity: { p25: 6, p90: 25 },
    cognitiveComplexity: { p25: 8, p90: 50 },
    functionSize: { p25: 25, p90: 100 },
    functionSizeMean: { p25: 15, p90: 50 },
    depth: { p25: 2, p90: 6 }
  },
  utility: {
    complexity: { p25: 1, p90: 6 },
    cognitiveComplexity: { p25: 1, p90: 12 },
    functionSize: { p25: 8, p90: 30 },
    functionSizeMean: { p25: 5, p90: 20 }
  },
  config: {
    complexity: { p25: 1, p90: 6 },
    cognitiveComplexity: { p25: 1, p90: 10 },
    functionSize: { p25: 5, p90: 40 },
    functionSizeMean: { p25: 3, p90: 20 }
  },
  generic: {}
};
const NEUTRAL = {
  complexity: 1,
  cognitiveComplexity: 1,
  functionSize: 1,
  depth: 1,
  churn: 1,
  params: 1,
  fanIn: 1
};
const LANGUAGE_MULTIPLIERS = {
  // TSX : ternaires de style inline gonflent cx et cog artificiellement
  tsx: { ...NEUTRAL, complexity: 0.8, cognitiveComplexity: 0.75 },
  // JSX : même problème, légèrement atténué (moins de style inline en pratique)
  jsx: { ...NEUTRAL, complexity: 0.85, cognitiveComplexity: 0.8 },
  // Python : complexité cognitive approximative via indentation — légère réduction
  py: { ...NEUTRAL, cognitiveComplexity: 0.9 },
  // TypeScript/JavaScript purs : pas d'ajustement — les seuils absolus suffisent
  ts: NEUTRAL,
  js: NEUTRAL,
  mjs: NEUTRAL
};
function getLanguageMultipliers(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_MULTIPLIERS[ext] ?? NEUTRAL;
}
const EXACT_NAMES = {
  "app.tsx": "entrypoint",
  "app.ts": "entrypoint",
  "app.jsx": "entrypoint",
  "index.tsx": "entrypoint",
  "main.tsx": "entrypoint",
  "index.ts": "entrypoint",
  "main.ts": "entrypoint",
  "index.js": "entrypoint",
  "main.js": "entrypoint",
  "types.ts": "config",
  "types.tsx": "config",
  "constants.ts": "config",
  "settings.ts": "config"
};
const NAME_FRAGMENTS = [
  // config — données statiques
  ["baseline", "config"],
  ["reference", "config"],
  ["constants", "config"],
  ["fixtures", "config"],
  ["defaults", "config"],
  ["thresholds", "config"],
  // parser — algorithmique
  ["parser", "parser"],
  ["lexer", "parser"],
  ["analyzer", "parser"],
  // service — logique métier
  ["service", "service"],
  ["store", "service"],
  ["engine", "service"],
  ["manager", "service"],
  ["handler", "service"],
  ["controller", "service"],
  ["scanner", "service"],
  ["watcher", "service"],
  ["socket", "service"],
  ["churn", "service"],
  // utility — fonctions pures
  ["util", "utility"],
  ["helper", "utility"],
  ["common", "utility"],
  ["format", "utility"],
  ["transform", "utility"]
];
function detectFileType(filePath) {
  const name = filePath.split("/").pop()?.toLowerCase() ?? "";
  const ext = name.split(".").pop() ?? "";
  const parts = filePath.toLowerCase().split("/");
  if (name in EXACT_NAMES) return EXACT_NAMES[name];
  if (name.startsWith("config") || name.endsWith(".config.ts") || name.endsWith(".config.js")) return "config";
  if (ext === "tsx") return "component-tsx";
  if (ext === "jsx") return "component-jsx";
  for (const [fragment, type] of NAME_FRAGMENTS) {
    if (name.includes(fragment)) return type;
  }
  if (parts.includes("shared") || parts.includes("lib")) return "utility";
  return "generic";
}
function getReferenceBaselines(filePath) {
  const fileType = detectFileType(filePath);
  const overrides = FILE_TYPE_OVERRIDES[fileType];
  const result = { ...REFERENCE_BASELINES };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value;
  }
  return result;
}
const ABS_SAFE = {
  complexity: 3,
  complexityMean: 2,
  cognitiveComplexity: 8,
  // recalibré — fonctions simples atteignent 3-5 naturellement
  functionSize: 20,
  functionSizeMean: 15,
  depth: 2,
  params: 3,
  churn: 3,
  fanIn: 3
};
const ABS_DANGER = {
  complexity: 15,
  complexityMean: 8,
  cognitiveComplexity: 60,
  // recalibré — buildFileBlueprint à cog:52 = stressed, pas critical
  functionSize: 80,
  functionSizeMean: 40,
  depth: 6,
  params: 8,
  churn: 20,
  fanIn: 15
};
function clampedScore(value, safe, danger) {
  if (safe >= danger) return value > safe ? 100 : 0;
  if (value <= safe) return 0;
  if (value >= danger) return 100;
  return (value - safe) / (danger - safe) * 100;
}
function adaptiveScore(value, metric, baselines, refBaselines) {
  let safe = ABS_SAFE[metric];
  let danger = ABS_DANGER[metric];
  if (refBaselines) {
    safe = Math.max(safe, refBaselines[metric].p25);
    danger = Math.max(danger, refBaselines[metric].p90);
    if (safe >= danger) danger = safe + 1;
  }
  if (baselines) {
    safe = Math.max(safe, baselines[metric].p25);
    if (safe >= danger) danger = safe + 1;
  }
  return clampedScore(value, safe, danger);
}
function blendedScore(maxMetric, meanMetric, raw, baselines, refBaselines) {
  const maxScore = adaptiveScore(raw[maxMetric], maxMetric, baselines, refBaselines);
  const meanScore = adaptiveScore(raw[meanMetric], meanMetric, baselines, refBaselines);
  return maxScore * 0.65 + meanScore * 0.35;
}
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p / 100) - 1);
  return sorted[idx] ?? 0;
}
function computeProjectBaselines(allRaw) {
  const metrics = [
    "complexity",
    "complexityMean",
    "cognitiveComplexity",
    "functionSize",
    "functionSizeMean",
    "depth",
    "params",
    "churn",
    "fanIn"
  ];
  const result = {};
  for (const m of metrics) {
    const values = allRaw.map((r) => r[m]);
    result[m] = { p25: percentile(values, 25), p90: percentile(values, 90) };
  }
  return result;
}
function scoreFromRaw(raw, filePath, language, baselines) {
  const refBaselines = getReferenceBaselines(filePath);
  const langMult = getLanguageMultipliers(filePath);
  const complexityScore = blendedScore("complexity", "complexityMean", raw, baselines, refBaselines);
  const cognitiveComplexityScore = adaptiveScore(raw.cognitiveComplexity, "cognitiveComplexity", baselines, refBaselines);
  const functionSizeScore = blendedScore("functionSize", "functionSizeMean", raw, baselines, refBaselines);
  const depthScore = adaptiveScore(raw.depth, "depth", baselines, refBaselines);
  const paramScore = adaptiveScore(raw.params, "params", baselines, refBaselines);
  const churnScore = adaptiveScore(raw.churn, "churn", baselines, refBaselines);
  const fanInScore = adaptiveScore(raw.fanIn, "fanIn", baselines, refBaselines);
  const hotspotScore = Math.min(Math.max(raw.complexity * raw.churn, 0), 150);
  const globalScore = complexityScore * 0.28 * langMult.complexity + cognitiveComplexityScore * 0.19 * langMult.cognitiveComplexity + functionSizeScore * 0.14 * langMult.functionSize + depthScore * 0.14 * langMult.depth + churnScore * 0.12 * langMult.churn + paramScore * 0.08 * langMult.params + fanInScore * 0.05 * langMult.fanIn;
  return {
    filePath,
    language,
    globalScore,
    hotspotScore,
    raw,
    details: {
      complexityScore,
      cognitiveComplexityScore,
      functionSizeScore,
      churnScore,
      depthScore,
      paramScore,
      fanInScore,
      fanIn: 0,
      // sera rempli par scanner après le calcul des edges
      fanOut: 0
    }
  };
}
let _churnCache = null;
let _cachedProjectPath = null;
async function buildChurnCache(projectPath) {
  try {
    const git = simpleGit(projectPath);
    const gitRoot = (await git.revparse(["--show-toplevel"])).trim();
    const log = await git.raw(["log", "--since=30 days ago", "--name-only", "--pretty=format:"]);
    _churnCache = /* @__PURE__ */ new Map();
    for (const line of log.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const abs = join(gitRoot, trimmed);
      _churnCache.set(abs, (_churnCache.get(abs) ?? 0) + 1);
    }
    _cachedProjectPath = projectPath;
    console.log(`[Cortex] Churn cache built — ${_churnCache.size} files tracked.`);
  } catch {
    _churnCache = /* @__PURE__ */ new Map();
    _cachedProjectPath = projectPath;
  }
}
function clearChurnCache() {
  _churnCache = null;
  _cachedProjectPath = null;
}
async function getChurnScore(filePath, projectPath) {
  if (!_churnCache) {
    if (!projectPath) throw new Error("getChurnScore: projectPath required on first call");
    await buildChurnCache(projectPath);
  }
  return _churnCache.get(filePath) ?? 0;
}
async function buildCouplingMap(projectPath, minCoChanges = 3) {
  const result = /* @__PURE__ */ new Map();
  try {
    const git = simpleGit(projectPath);
    const gitRoot = (await git.revparse(["--show-toplevel"])).trim();
    const log = await git.raw(["log", "--since=90 days ago", "--name-only", "--pretty=format:%H"]);
    const commitGroups = /* @__PURE__ */ new Map();
    let currentHash = null;
    for (const line of log.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[0-9a-f]{40}$/.test(trimmed)) {
        currentHash = trimmed;
        commitGroups.set(currentHash, []);
      } else if (currentHash) {
        const abs = join(gitRoot, trimmed);
        commitGroups.get(currentHash).push(abs);
      }
    }
    const pairCounts = /* @__PURE__ */ new Map();
    for (const [, filesInCommit] of commitGroups) {
      if (filesInCommit.length < 2) continue;
      for (let i = 0; i < filesInCommit.length; i++) {
        for (let j = i + 1; j < filesInCommit.length; j++) {
          const a = filesInCommit[i];
          const b = filesInCommit[j];
          const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
    for (const [key, count] of pairCounts) {
      if (count < minCoChanges) continue;
      const [fileA, fileB] = key.split("\0");
      const coupling = { fileA, fileB, coChangeCount: count };
      if (!result.has(fileA)) result.set(fileA, []);
      if (!result.has(fileB)) result.set(fileB, []);
      result.get(fileA).push(coupling);
      result.get(fileB).push(coupling);
    }
  } catch {
  }
  return result;
}
const SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"]);
const IGNORE_FILE_PATTERNS = [".min.js", ".min.ts", ".d.ts", ".map", ".spec.", ".test.", "__tests__"];
const ALWAYS_IGNORE = /* @__PURE__ */ new Set(["node_modules", ".git", "out", "dist", "build", "assets", ".vite", "__pycache__", "venv", ".venv", "env", "site-packages", "migrations"]);
function shouldIgnoreFile(filename) {
  return IGNORE_FILE_PATTERNS.some((p) => filename.includes(p));
}
function getFiles(dir, ignore, fileList = [], visited = /* @__PURE__ */ new Set()) {
  let realDir;
  try {
    realDir = fs__default.realpathSync(dir);
  } catch {
    return fileList;
  }
  if (visited.has(realDir)) return fileList;
  visited.add(realDir);
  let entries;
  try {
    entries = fs__default.readdirSync(dir);
  } catch {
    return fileList;
  }
  for (const entry of entries) {
    if (ALWAYS_IGNORE.has(entry) || ignore.includes(entry)) continue;
    const fullPath = path__default.join(dir, entry);
    let stat;
    try {
      stat = fs__default.statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      getFiles(fullPath, ignore, fileList, visited);
      continue;
    }
    const ext = path__default.extname(entry).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext) && !shouldIgnoreFile(entry)) fileList.push(fullPath);
  }
  return fileList;
}
const IMPORT_PATTERNS = {
  js: [
    /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ],
  py: [
    /^from\s+(\.{0,2}[\w.]+)\s+import/gm,
    /^import\s+([\w.]+)/gm
  ]
};
function extractImports(filePath, source) {
  const ext = path__default.extname(filePath).toLowerCase();
  const pats = ext === ".py" ? IMPORT_PATTERNS.py : IMPORT_PATTERNS.js;
  const imports = [];
  for (const pat of pats) {
    pat.lastIndex = 0;
    let match;
    while ((match = pat.exec(source)) !== null) {
      const raw = match[1];
      if (raw.startsWith(".")) imports.push(raw);
    }
  }
  return imports;
}
function resolveImport(fromFile, importPath, allFiles) {
  const dir = path__default.dirname(fromFile);
  const stripped = importPath.replace(/\.js$/, "");
  const base = path__default.resolve(dir, stripped);
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + ".jsx",
    path__default.join(base, "index.ts"),
    path__default.join(base, "index.js")
  ];
  for (const c of candidates) {
    if (allFiles.has(c)) return c;
  }
  return null;
}
function buildEdges(files, fileSources) {
  const fileSet = new Set(files);
  const edges = [];
  const seen = /* @__PURE__ */ new Set();
  for (const file of files) {
    const source = fileSources.get(file);
    if (!source) continue;
    const imports = extractImports(file, source);
    for (const imp of imports) {
      const resolved = resolveImport(file, imp, fileSet);
      if (!resolved) continue;
      const key = `${file}→${resolved}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: file, to: resolved });
    }
  }
  return edges;
}
async function scanProject(projectPath, ignoreList, ignoredFiles) {
  const ignore = ignoreList ?? ["node_modules", ".git", "dist", "build", ".vite", "vendor", "__pycache__"];
  const ignoredSet = new Set(ignoredFiles ?? []);
  const allFiles = getFiles(projectPath, ignore);
  const files = allFiles.filter((f) => !ignoredSet.has(f));
  clearChurnCache();
  await buildChurnCache(projectPath);
  console.log(`[Cortex] Found ${files.length} files to scan`);
  const analyses = [];
  const fileSources = /* @__PURE__ */ new Map();
  for (const file of files) {
    try {
      const source = fs__default.readFileSync(file, "utf-8");
      fileSources.set(file, source);
      const metrics = await analyzeFile(file);
      saveFunctions(file, metrics.functions, projectPath);
      const fns = metrics.functions.filter((fn) => fn.name !== "anonymous");
      const churn = await getChurnScore(file, projectPath);
      const raw = {
        complexity: fns.length > 0 ? Math.max(...fns.map((f) => f.cyclomaticComplexity)) : 0,
        complexityMean: fns.length > 0 ? fns.reduce((s, f) => s + f.cyclomaticComplexity, 0) / fns.length : 0,
        cognitiveComplexity: fns.length > 0 ? Math.max(...fns.map((f) => f.cognitiveComplexity ?? 0)) : 0,
        functionSize: fns.length > 0 ? Math.max(...fns.map((f) => f.lineCount)) : 0,
        functionSizeMean: fns.length > 0 ? fns.reduce((s, f) => s + f.lineCount, 0) / fns.length : 0,
        depth: fns.length > 0 ? Math.max(...fns.map((f) => f.maxDepth)) : 0,
        params: fns.length > 0 ? Math.max(...fns.map((f) => f.parameterCount)) : 0,
        churn
      };
      analyses.push({ metrics, raw });
    } catch (error) {
      console.error(`[Cortex] Error analyzing ${path__default.basename(file)}:`, error);
    }
  }
  const edges = buildEdges(files, fileSources);
  const fanOutMap = /* @__PURE__ */ new Map();
  const fanInMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    fanOutMap.set(file, 0);
    fanInMap.set(file, 0);
  }
  for (const edge of edges) {
    fanOutMap.set(edge.from, (fanOutMap.get(edge.from) ?? 0) + 1);
    fanInMap.set(edge.to, (fanInMap.get(edge.to) ?? 0) + 1);
  }
  for (const analysis of analyses) {
    analysis.raw.fanIn = fanInMap.get(analysis.metrics.filePath) ?? 0;
  }
  const baselines = computeProjectBaselines(analyses.map((a) => a.raw));
  console.log("[Cortex] Baselines —", Object.entries(baselines).map(([k, v]) => `${k}: p25=${v.p25.toFixed(1)} p90=${v.p90.toFixed(1)}`).join(" | "));
  const results = analyses.map(
    ({ metrics, raw }) => scoreFromRaw(raw, metrics.filePath, metrics.language, baselines)
  );
  for (const result of results) {
    result.details.fanIn = fanInMap.get(result.filePath) ?? 0;
    result.details.fanOut = fanOutMap.get(result.filePath) ?? 0;
    saveScan(result, projectPath);
  }
  try {
    const couplings = await buildCouplingMap(projectPath);
    await saveCouplings(couplings, projectPath);
    console.log(`[Cortex] Coupling map built — ${couplings.size} files with co-changes`);
  } catch (err) {
    console.warn("[Cortex] Coupling map failed (non-fatal):", err);
  }
  console.log(`[Cortex] Scan complete — ${results.length} files, ${edges.length} connections`);
  return { files: results.sort((a, b) => b.globalScore - a.globalScore), edges };
}
const RULES = [
  // ── Secrets ──────────────────────────────────────────────────────────────
  {
    id: "hardcoded-secret",
    pattern: /(?:password|passwd|pwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["']([^"']{6,})["']/i,
    severity: "critical",
    category: "secret",
    message: "Potential hardcoded secret — move to environment variable.",
    skip: (line, match) => {
      const l = line.toLowerCase();
      if (l.includes("example") || l.includes("placeholder") || l.includes("your_") || l.includes("xxx") || l.includes("todo") || l.includes("changeme") || l.trim().startsWith("//") || l.trim().startsWith("*") || l.trim().startsWith("#")) return true;
      const value = match[1] ?? "";
      if (value.startsWith("var(") || value.startsWith("rgba") || value.startsWith("rgb") || value.startsWith("#") || !/[a-zA-Z0-9]{4}/.test(value)) return true;
      if (/^[A-Z][a-z]+$/.test(value) && value.length < 20) return true;
      return false;
    },
    skipFile: (filePath) => {
      const name = filePath.split("/").pop() ?? "";
      return name.startsWith("test_") || name.startsWith("test.") || name.includes(".test.") || name.includes(".spec.");
    }
  },
  {
    id: "aws-access-key",
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
    category: "secret",
    message: "AWS access key ID detected in source code."
  },
  {
    id: "github-token",
    pattern: /ghp_[a-zA-Z0-9]{36}/,
    severity: "critical",
    category: "secret",
    message: "GitHub personal access token detected in source code."
  },
  {
    id: "private-key-block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: "critical",
    category: "secret",
    message: "Private key block found in source code."
  },
  {
    id: "connection-string",
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^@\s"']+:[^@\s"']+@/i,
    severity: "high",
    category: "secret",
    message: "Database connection string with embedded credentials."
  },
  {
    id: "console-log-sensitive",
    pattern: /console\.(?:log|debug|info)\s*\([^)]*(?:password|token|secret|apikey|credential)[^)]*\)/i,
    severity: "medium",
    category: "secret",
    message: "Potentially sensitive data logged to console.",
    languages: ["typescript", "javascript"],
    skip: (line) => line.trim().startsWith("//")
  },
  // ── Injection ─────────────────────────────────────────────────────────────
  {
    id: "eval-usage",
    pattern: /\beval\s*\(/,
    severity: "high",
    category: "injection",
    message: "eval() executes arbitrary code — code injection risk.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*")
  },
  {
    id: "new-function",
    pattern: /new\s+Function\s*\(/,
    severity: "high",
    category: "injection",
    message: "new Function() is equivalent to eval — code injection risk.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*")
  },
  {
    id: "exec-variable",
    pattern: /(?<![.\w])exec\s*\(\s*(?![`"'])/,
    severity: "high",
    category: "injection",
    message: "exec() called with a variable — potential command injection.",
    languages: ["typescript", "javascript"],
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*")
  },
  {
    id: "python-exec-eval",
    pattern: /\b(?:exec|eval)\s*\(\s*(?!["'])/,
    severity: "high",
    category: "injection",
    message: "exec/eval with a variable — arbitrary code execution risk.",
    languages: ["python"],
    skip: (line) => line.trim().startsWith("#")
  },
  {
    id: "sql-concatenation",
    pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.{0,60}["'`]\s*\+/i,
    severity: "high",
    category: "injection",
    message: "SQL query built by string concatenation — SQL injection risk. Use parameterized queries.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("#")
  },
  // ── XSS ──────────────────────────────────────────────────────────────────
  {
    id: "dangerous-inner-html",
    pattern: /dangerouslySetInnerHTML/,
    severity: "high",
    category: "xss",
    message: "dangerouslySetInnerHTML bypasses React XSS protection — sanitize content before use.",
    languages: ["typescript", "javascript"]
  },
  {
    id: "inner-html-assignment",
    pattern: /\.innerHTML\s*=/,
    severity: "low",
    category: "xss",
    message: "Direct innerHTML assignment — verify that all user-supplied content is escaped.",
    languages: ["typescript", "javascript"],
    skip: (line) => {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) return true;
      return /\bescape\s*\(|\bescapeHtml\s*\(|\bsanitize\s*\(|DOMPurify/.test(line);
    }
  },
  {
    id: "document-write",
    pattern: /document\.write\s*\(/,
    severity: "medium",
    category: "xss",
    message: "document.write() can introduce XSS vulnerabilities.",
    languages: ["typescript", "javascript"],
    skip: (line) => line.trim().startsWith("//")
  },
  // ── Crypto ────────────────────────────────────────────────────────────────
  {
    id: "math-random-security",
    pattern: /Math\.random\s*\(\)/,
    severity: "medium",
    category: "crypto",
    message: "Math.random() is not cryptographically secure — use crypto.randomBytes() for tokens or IDs.",
    languages: ["typescript", "javascript"],
    skip: (line) => {
      const l = line.toLowerCase();
      return l.includes("color") || l.includes("position") || l.includes("animation") || l.includes("delay") || l.includes("jitter") || l.includes("test") || l.includes("mock") || l.trim().startsWith("//") || l.trim().startsWith("*");
    }
  },
  {
    id: "weak-hash-md5",
    pattern: /\bmd5\s*\(/i,
    severity: "medium",
    category: "crypto",
    message: "MD5 is cryptographically broken — use SHA-256 or stronger.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("#")
  },
  {
    id: "weak-hash-sha1",
    pattern: /\bsha1\s*\(/i,
    severity: "low",
    category: "crypto",
    message: "SHA-1 is deprecated — prefer SHA-256 or stronger.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("#")
  },
  // ── Misc ──────────────────────────────────────────────────────────────────
  {
    id: "http-cleartext",
    pattern: /["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/,
    severity: "low",
    category: "misc",
    message: "Cleartext HTTP URL — prefer HTTPS to prevent interception.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("#")
  },
  {
    id: "disable-ssl-verify",
    pattern: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
    severity: "high",
    category: "misc",
    message: "SSL/TLS certificate verification disabled — vulnerable to MITM attacks.",
    skip: (line) => line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("#")
  },
  {
    id: "debugger-statement",
    pattern: /^\s*debugger\s*;?\s*$/,
    severity: "info",
    category: "misc",
    message: "debugger statement left in code.",
    languages: ["typescript", "javascript"]
  }
];
function detectLang(filePath) {
  const ext = path__default.extname(filePath).toLowerCase();
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) return "typescript";
  if (ext === ".py") return "python";
  return "unknown";
}
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
function scanFileForPatterns(filePath, source) {
  const findings = [];
  const lang = detectLang(filePath);
  const lines = source.split("\n");
  for (const rule of RULES) {
    if (rule.languages && !rule.languages.includes(lang)) continue;
    const flags = "g" + (rule.pattern.flags.includes("i") ? "i" : "");
    const pat = new RegExp(rule.pattern.source, flags);
    if (rule.skipFile?.(filePath)) continue;
    lines.forEach((line, idx) => {
      pat.lastIndex = 0;
      const match = pat.exec(line);
      if (!match) return;
      if (rule.skip?.(line, match)) return;
      findings.push({
        filePath,
        line: idx + 1,
        rule: rule.id,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        snippet: line.trim().slice(0, 120)
      });
    });
  }
  return findings;
}
function scanProjectForPatterns(projectPath, ignoreList = []) {
  const ALWAYS_SKIP = ["node_modules", ".git", "out", "dist", "build", "assets", ".vite", "__pycache__", "venv", ".venv"];
  const ignore = [.../* @__PURE__ */ new Set([...ALWAYS_SKIP, ...ignoreList])];
  const allFiles = getFiles(projectPath, ignore);
  const files = allFiles.filter((f) => !f.endsWith("patternScanner.ts") && !f.endsWith("patternScanner.js"));
  const all = [];
  for (const file of files) {
    try {
      const source = fs__default.readFileSync(file, "utf-8");
      all.push(...scanFileForPatterns(file, source));
    } catch {
    }
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.filePath.localeCompare(b.filePath));
  return all;
}
const DEFAULTS = {
  projects: [],
  activeProjectPath: "",
  thresholds: {
    alert: 50,
    warning: 20
  },
  ignore: ["node_modules", ".git", "dist", "build", "out", ".vite", "vendor", "__pycache__", "assets", "venv", ".venv", "env", "site-packages", "migrations"],
  ignoredFiles: [],
  locale: "fr",
  autoSecurityScan: true
};
function getSettingsPath() {
  return path__default.join(app.getPath("userData"), "cortex-settings.json");
}
function loadSettings() {
  try {
    const raw = JSON.parse(fs__default.readFileSync(getSettingsPath(), "utf-8"));
    if (!raw.projects) {
      const legacyPath = raw.projectPath || raw.activeProjectPath || "";
      const projects = legacyPath ? [{ path: legacyPath, name: path__default.basename(legacyPath), addedAt: (/* @__PURE__ */ new Date()).toISOString() }] : [];
      return {
        ...DEFAULTS,
        projects,
        activeProjectPath: legacyPath
      };
    }
    const mergedIgnore = [.../* @__PURE__ */ new Set([...DEFAULTS.ignore, ...raw.ignore ?? []])];
    return {
      ...DEFAULTS,
      ...raw,
      ignore: mergedIgnore,
      ignoredFiles: raw.ignoredFiles ?? [],
      locale: raw.locale === "en" ? "en" : "fr",
      thresholds: { ...DEFAULTS.thresholds, ...raw.thresholds ?? {} },
      autoSecurityScan: raw.autoSecurityScan !== false
    };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings(s) {
  const p = getSettingsPath();
  fs__default.mkdirSync(path__default.dirname(p), { recursive: true });
  fs__default.writeFileSync(p, JSON.stringify(s, null, 2), "utf-8");
}
function addProject(settings, projectPath) {
  const name = path__default.basename(projectPath);
  const already = settings.projects.find((p) => p.path === projectPath);
  if (already) {
    return { ...settings, activeProjectPath: projectPath };
  }
  const newProject = { path: projectPath, name, addedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return {
    ...settings,
    projects: [...settings.projects, newProject],
    activeProjectPath: projectPath
  };
}
function removeProject(settings, projectPath) {
  const projects = settings.projects.filter((p) => p.path !== projectPath);
  const active = settings.activeProjectPath === projectPath ? projects[0]?.path ?? "" : settings.activeProjectPath;
  return { ...settings, projects, activeProjectPath: active };
}
function setActiveProject(settings, projectPath) {
  return { ...settings, activeProjectPath: projectPath };
}
function ignoreFile(settings, filePath) {
  const already = settings.ignoredFiles.includes(filePath);
  if (already) return settings;
  return { ...settings, ignoredFiles: [...settings.ignoredFiles, filePath] };
}
function unignoreFile(settings, filePath) {
  return { ...settings, ignoredFiles: settings.ignoredFiles.filter((f) => f !== filePath) };
}
const SUPPORTED = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"];
function startWatcher(options) {
  const emitter = new EventEmitter();
  let currentPath = options.projectPath;
  let currentIgnore = options.ignore;
  let watcher = null;
  function attachListeners(w) {
    w.on("add", (path2) => {
      if (SUPPORTED.some((ext) => path2.endsWith(ext))) emitter.emit("file:added", path2);
    });
    w.on("change", (path2) => {
      if (SUPPORTED.some((ext) => path2.endsWith(ext))) emitter.emit("file:changed", path2);
    });
    w.on("unlink", (path2) => emitter.emit("file:deleted", path2));
    w.on("error", (err) => emitter.emit("error", err));
  }
  function createWatcher(projectPath, ignore) {
    return chokidar.watch(projectPath, {
      ignored: (filePath) => {
        const parts = filePath.split("/");
        return parts.some((part) => ignore.includes(part));
      },
      ignoreInitial: true
    });
  }
  watcher = createWatcher(currentPath, currentIgnore);
  attachListeners(watcher);
  async function restart(newPath, newIgnore) {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
    currentPath = newPath;
    currentIgnore = newIgnore ?? currentIgnore;
    watcher = createWatcher(currentPath, currentIgnore);
    attachListeners(watcher);
    emitter.emit("watcher:restarted", newPath);
  }
  return {
    emitter,
    restart,
    getCurrentPath: () => currentPath,
    close: async () => {
      if (watcher) await watcher.close();
    }
  };
}
function metricExplain(name, raw, score) {
  if (score < 30) return "";
  const level = score >= 60 ? "critical" : "elevated";
  const map = {
    complexity: `Cyclomatic complexity of ${raw} (${level}) — ${raw} independent execution paths. Every branch that isn't tested is a potential bug. Refactor by extracting logic into smaller, single-purpose functions.`,
    cognitive: `Cognitive complexity of ${raw} (${level}) — the code is hard to follow due to deep nesting or non-linear control flow. Use guard clauses, early returns, and extract helper functions to flatten the structure.`,
    functionSize: `Largest function is ${raw} lines (${level}) — functions this long almost always handle more than one responsibility. Apply the single-responsibility principle: one function, one job.`,
    churn: `${raw} commits in the last 30 days (${level}) — this file changes very often, which indicates either instability or accumulated technical debt. Frequent churn combined with high complexity is a major risk factor.`,
    depth: `Nesting depth of ${raw} (${level}) — deeply nested code is cognitively exhausting. Replace nested conditions with early returns or guard clauses.`,
    params: `${raw} parameters on the largest function (${level}) — functions with many parameters are hard to call correctly and test exhaustively. Group related parameters into a configuration object or a dedicated type.`,
    fanIn: `Imported by ${raw} other files (${level}) — this file is a hub. Any bug or breaking change here propagates to many other modules. Prioritize stability and test coverage here.`
  };
  return map[name] ?? "";
}
const LAYER_MAP = {
  "src/cortex/analyzer": { label: "analyzer", role: "AST parsing, complexity & churn metrics" },
  "src/cortex/risk-score": { label: "risk-score", role: "scoring pipeline, trend detection, reference baselines" },
  "src/cortex/watcher": { label: "watcher", role: "filesystem watch, debouncing" },
  "src/database": { label: "database", role: "SQLite persistence (scans, feedbacks, snapshots, migrations)" },
  "src/app/main": { label: "main", role: "Electron main process, IPC handlers, scan orchestration" },
  "src/app/preload": { label: "preload", role: "Electron contextBridge, IPC exposure to renderer" },
  "src/app/renderer/components": { label: "components", role: "React UI components" },
  "src/app/renderer/hooks": { label: "hooks", role: "React custom hooks" },
  "src/app/renderer": { label: "renderer", role: "React renderer entry, types, i18n, utils" }
};
const ENTRY_POINT_PATTERNS = [
  /\/main\/index\.(ts|js)$/,
  /\/preload\/index\.(ts|js)$/,
  /\/renderer\/main\.(tsx|jsx|ts|js)$/,
  /electron\.vite\.config\.(ts|js)$/,
  /vite\.config\.(ts|js)$/,
  /vitest\.config\.(ts|js)$/,
  /tsconfig.*\.json$/
];
const UTILITY_MODULE_PATTERNS = [
  /\/cortex\/risk-score\//,
  /\/cortex\/analyzer\//
];
function isEntryPoint(filePath) {
  return ENTRY_POINT_PATTERNS.some((p) => p.test(filePath));
}
function isDeadFile(s) {
  if (isEntryPoint(s.filePath)) return false;
  if (UTILITY_MODULE_PATTERNS.some((p) => p.test(s.filePath))) return false;
  return s.fanIn === 0 && s.fanOut === 0;
}
function getLayer(filePath, projectPath) {
  const rel = filePath.replace(projectPath + "/", "");
  for (const [prefix, info] of Object.entries(LAYER_MAP)) {
    if (rel.startsWith(prefix)) return info;
  }
  return null;
}
function topMetricKey(s) {
  const candidates = [
    { key: "cognitive_complexity", v: s.cognitiveComplexityScore ?? 0 },
    { key: "complexity", v: s.complexityScore ?? 0 },
    { key: "function_size", v: s.functionSizeScore ?? 0 },
    { key: "churn", v: s.churnScore ?? 0 },
    { key: "depth", v: s.depthScore ?? 0 },
    { key: "fan_in", v: s.fanIn > 0 ? Math.min(100, s.fanIn * 7) : 0 }
  ];
  return candidates.sort((a, b) => b.v - a.v)[0]?.key ?? "?";
}
function avgRisk(scans) {
  return scans.length > 0 ? scans.reduce((acc, s) => acc + s.globalScore, 0) / scans.length : 0;
}
function fname(s) {
  return s.filePath.split("/").pop() ?? s.filePath;
}
function mdSummary(scans, projName, date) {
  const avg = avgRisk(scans);
  const health = Math.max(0, 100 - avg);
  const healthLabel = avg >= 50 ? "Critical" : avg >= 20 ? "Stressed" : "Healthy";
  const critical = scans.filter((s) => s.globalScore >= 50).length;
  const stressed = scans.filter((s) => s.globalScore >= 20 && s.globalScore < 50).length;
  const healthy = scans.filter((s) => s.globalScore < 20).length;
  const trendingUp = scans.filter((s) => s.trend === "↑").length;
  return [
    `# Cortex Report — ${projName}`,
    `_Generated by Cortex · ${date}_

---
`,
    `## Executive Summary
`,
    `**Overall health: ${healthLabel}** (${health.toFixed(0)}% / risk score ${avg.toFixed(1)})
`,
    `| Metric | Value |
|---|---|`,
    `| Total modules | ${scans.length} |`,
    `| Critical (score ≥ 50) | ${critical} |`,
    `| Stressed (score 20–50) | ${stressed} |`,
    `| Healthy (score < 20) | ${healthy} |`,
    `| Trending worse | ${trendingUp} |
`
  ].join("\n");
}
function mdMetricsGuide() {
  return [
    `## How to Read This Report
`,
    `| Metric | What it measures | Why it matters |
|---|---|---|`,
    `| Cyclomatic Complexity | Number of independent execution paths | Each path that isn't tested is a potential bug |`,
    `| Cognitive Complexity | How hard the code is to read | Penalizes deep nesting and non-linear flow |`,
    `| Function Size | Lines in the largest function | Long functions violate single-responsibility |`,
    `| Churn | Commits in the last 30 days | Frequent changes signal instability or debt |`,
    `| Nesting Depth | Max depth of nested blocks | Deep nesting is cognitively exhausting |`,
    `| Parameters | Max params in any function | Too many params = missing abstraction |`,
    `| Fan-in | Files that import this one | High fan-in = changes propagate widely |
`
  ].join("\n");
}
function mdCriticalFile(s) {
  const trend = s.trend === "↑" ? " ↑ worsening" : s.trend === "↓" ? " ↓ improving" : "";
  const issues = [
    metricExplain("complexity", s.rawComplexity, s.complexityScore ?? 0),
    metricExplain("cognitive", s.rawCognitiveComplexity, s.cognitiveComplexityScore ?? 0),
    metricExplain("functionSize", s.rawFunctionSize, s.functionSizeScore ?? 0),
    metricExplain("churn", s.rawChurn, s.churnScore ?? 0),
    metricExplain("depth", s.rawDepth, s.depthScore ?? 0),
    metricExplain("params", s.rawParams, s.paramScore ?? 0),
    metricExplain("fanIn", s.fanIn, s.fanIn >= 8 ? 70 : s.fanIn >= 5 ? 40 : 0)
  ].filter(Boolean);
  const lines = [
    `### ${fname(s)} — Risk Score ${s.globalScore.toFixed(1)}${trend}
`,
    `\`${s.filePath}\`
`
  ];
  if (issues.length > 0) {
    lines.push(`**Issues identified:**
`);
    issues.forEach((i) => lines.push(`- ${i}`));
    lines.push("");
  }
  lines.push(`**Raw metrics:** cx ${s.rawComplexity} · cog ${s.rawCognitiveComplexity ?? "—"} · size ${s.rawFunctionSize}L · churn ${s.rawChurn} · depth ${s.rawDepth} · params ${s.rawParams} · fan-in ${s.fanIn}
`);
  return lines.join("\n");
}
function mdCriticalSection(scans) {
  const critical = scans.filter((s) => s.globalScore >= 50).sort((a, b) => b.globalScore - a.globalScore);
  if (!critical.length) return "";
  return [
    `---

## Critical Files (${critical.length})
`,
    `These files score ≥ 50 and require immediate attention.
`,
    ...critical.map(mdCriticalFile)
  ].join("\n");
}
function mdStressedSection(scans) {
  const stressed = scans.filter((s) => s.globalScore >= 20 && s.globalScore < 50).sort((a, b) => b.globalScore - a.globalScore);
  if (!stressed.length) return "";
  const lines = [`---

## Stressed Files (${stressed.length})
`];
  const worsening = stressed.filter((s) => s.trend === "↑");
  if (worsening.length) {
    lines.push(`**Trending worse (act soon):**
`);
    worsening.forEach((s) => lines.push(`- **${fname(s)}** — score ${s.globalScore.toFixed(1)} ↑`));
    lines.push("");
  }
  const stable = stressed.filter((s) => s.trend !== "↑");
  if (stable.length) {
    lines.push(`**Stable (watch):**
`);
    stable.slice(0, 8).forEach((s) => lines.push(`- ${fname(s)} — score ${s.globalScore.toFixed(1)} ${s.trend ?? "↔"}`));
    if (stable.length > 8) lines.push(`- _…and ${stable.length - 8} more_`);
    lines.push("");
  }
  return lines.join("\n");
}
function mdHotspotsSection(scans) {
  const hotspots = scans.filter((s) => s.hotspotScore > 50).sort((a, b) => b.hotspotScore - a.hotspotScore);
  if (!hotspots.length) return "";
  return [
    `---

## Hotspots — High Complexity + High Churn
`,
    ...hotspots.slice(0, 5).map((s) => `- **${fname(s)}** — hotspot ${s.hotspotScore.toFixed(0)} · cx ${s.rawComplexity} · churn ${s.rawChurn}`),
    ""
  ].join("\n");
}
function mdHubsSection(scans) {
  const hubs = scans.filter((s) => s.fanIn >= 8).sort((a, b) => b.fanIn - a.fanIn);
  if (!hubs.length) return "";
  return [
    `---

## Critical Hubs — Widely Imported
`,
    ...hubs.slice(0, 5).map((s) => `- **${fname(s)}** — imported by ${s.fanIn} files · risk score ${s.globalScore.toFixed(1)}`),
    ""
  ].join("\n");
}
function mdAiSection(scans, projName) {
  const avg = avgRisk(scans);
  const healthLabel = avg >= 50 ? "Critical" : avg >= 20 ? "Stressed" : "Healthy";
  const critical = scans.filter((s) => s.globalScore >= 50).sort((a, b) => b.globalScore - a.globalScore);
  const lines = [
    `---

## Context for AI Refactoring Assistant
`,
    `> Copy and paste this section into Claude, GPT-4, or any AI assistant.
`,
    `I have a ${projName} project analyzed by Cortex. Overall health: **${healthLabel}** (risk ${avg.toFixed(1)}/100).
`
  ];
  if (critical.length) {
    lines.push(`**Priority files for refactoring:**
`);
    critical.slice(0, 5).forEach(
      (s, i) => lines.push(`${i + 1}. \`${fname(s)}\` — risk ${s.globalScore.toFixed(1)}, cx ${s.rawComplexity}, churn ${s.rawChurn}/30d`)
    );
    lines.push("");
  }
  lines.push(`Please analyze these files and suggest concrete refactoring actions.`);
  return lines.join("\n");
}
function buildMarkdown(scans, projectPath, projName, date, security) {
  return [
    mdSummary(scans, projName, date),
    mdMetricsGuide(),
    mdCriticalSection(scans),
    mdStressedSection(scans),
    mdHotspotsSection(scans),
    mdHubsSection(scans),
    mdSecuritySection(security),
    mdAiSection(scans, projName)
  ].join("\n");
}
function buildJson(scans, projectPath, projName, date, security) {
  const avg = avgRisk(scans);
  const critical = scans.filter((s) => s.globalScore >= 50);
  const stressed = scans.filter((s) => s.globalScore >= 20 && s.globalScore < 50);
  const activeScans = scans.filter((s) => !isDeadFile(s) || s.globalScore >= 50);
  const deadFiles = scans.filter(isDeadFile).map((s) => s.filePath.replace(projectPath + "/", ""));
  const layerSummary = {};
  for (const s of activeScans) {
    const layer = getLayer(s.filePath, projectPath);
    if (!layer) continue;
    if (!layerSummary[layer.label]) layerSummary[layer.label] = { role: layer.role, fileCount: 0, avgRisk: 0 };
    layerSummary[layer.label].fileCount++;
    layerSummary[layer.label].avgRisk += s.globalScore;
  }
  for (const k of Object.keys(layerSummary)) {
    const l = layerSummary[k];
    l.avgRisk = Math.round(l.avgRisk / l.fileCount * 10) / 10;
  }
  return JSON.stringify({
    meta: { project: projName, date, generatedBy: "Cortex", version: "1.0", stack: ["TypeScript", "Electron", "React", "SQLite", "ts-morph"] },
    summary: {
      totalFiles: scans.length,
      activeFiles: activeScans.length,
      deadFiles,
      critical: critical.length,
      stressed: stressed.length,
      healthy: scans.filter((s) => s.globalScore < 20).length,
      avgRisk: parseFloat(avg.toFixed(1)),
      healthPct: Math.round(Math.max(0, 100 - avg)),
      topPriorities: activeScans.filter((s) => s.globalScore >= 50).slice(0, 5).map((s) => ({
        file: s.filePath.replace(projectPath + "/", ""),
        risk: parseFloat(s.globalScore.toFixed(1)),
        trend: s.trend,
        topIssue: topMetricKey(s),
        lines: s.rawFunctionSize,
        fanIn: s.fanIn,
        layer: getLayer(s.filePath, projectPath)?.label ?? "unknown"
      }))
    },
    architecture: layerSummary,
    files: activeScans.map((s) => ({
      file: s.filePath.replace(projectPath + "/", ""),
      layer: getLayer(s.filePath, projectPath)?.label ?? "other",
      risk: parseFloat(s.globalScore.toFixed(1)),
      status: s.globalScore >= 50 ? "critical" : s.globalScore >= 20 ? "stressed" : "healthy",
      trend: s.trend,
      topIssue: topMetricKey(s),
      cx: s.rawComplexity,
      cog: s.rawCognitiveComplexity,
      lines: s.rawFunctionSize,
      depth: s.rawDepth,
      churn: s.rawChurn,
      fanIn: s.fanIn,
      fanOut: s.fanOut
    })),
    security: security ? {
      scannedAt: security.scannedAt,
      patternCount: (security.findings ?? []).length,
      patterns: (security.findings ?? []).map((f) => ({
        file: f.filePath.split("/").slice(-3).join("/"),
        line: f.line,
        rule: f.rule,
        severity: f.severity,
        category: f.category,
        message: f.message
      })),
      audit: security.audit?.status === "ok" ? {
        total: security.audit.counts?.total ?? 0,
        counts: security.audit.counts,
        vulns: (security.audit.vulns ?? []).map((v) => ({
          name: v.name,
          severity: v.severity,
          range: v.range,
          fix: v.fixAvailable,
          cves: v.cves
        }))
      } : { status: security.audit?.status ?? "not_run" }
    } : null
  }, null, 2);
}
function mdSecuritySection(security) {
  if (!security) return "";
  const findings = security.findings ?? [];
  const audit = security.audit;
  const scannedAt = security.scannedAt ? new Date(security.scannedAt).toLocaleString() : "";
  if (findings.length === 0 && (!audit || audit.counts?.total === 0)) return "";
  const lines = [`---

## Security

_Scanned ${scannedAt}_
`];
  if (findings.length > 0) {
    const bySev = (sev) => findings.filter((f) => f.severity === sev);
    const counts = ["critical", "high", "medium", "low", "info"].map((s) => {
      const n = bySev(s).length;
      return n > 0 ? `${n} ${s}` : "";
    }).filter(Boolean).join(" · ");
    lines.push(`### Static Patterns — ${findings.length} finding${findings.length > 1 ? "s" : ""} (${counts})
`);
    for (const sev of ["critical", "high", "medium", "low", "info"]) {
      const group = bySev(sev);
      if (!group.length) continue;
      group.forEach((f) => {
        const rel = f.filePath.split("/").slice(-3).join("/");
        lines.push(`- **[${sev.toUpperCase()}]** \`${rel}:${f.line}\` — ${f.message}`);
        lines.push(`  \`${f.snippet}\``);
      });
    }
    lines.push("");
  } else {
    lines.push(`### Static Patterns

✓ No patterns detected.
`);
  }
  if (audit?.status === "ok") {
    const total = audit.counts?.total ?? 0;
    if (total === 0) {
      lines.push(`### Dependency Audit

✓ No known vulnerabilities in dependencies.
`);
    } else {
      const c = audit.counts;
      lines.push(`### Dependency Audit — ${total} vulnerabilit${total > 1 ? "ies" : "y"}
`);
      lines.push(`| Severity | Count |
|---|---|`);
      for (const [k, v] of Object.entries(c)) {
        if (k === "total" || !v) continue;
        lines.push(`| ${k} | ${v} |`);
      }
      lines.push("");
      (audit.vulns ?? []).forEach((v) => {
        const sev = v.severity === "moderate" ? "medium" : v.severity;
        lines.push(`- **[${sev.toUpperCase()}]** \`${v.name}\` — range \`${v.range}\`${v.fixAvailable ? " _(fix available)_" : ""}`);
        if (v.cves?.length) lines.push(`  CVE: ${v.cves.join(", ")}`);
      });
      lines.push("");
    }
  }
  return lines.join("\n");
}
function buildReport(scans, projectPath, security) {
  const projName = projectPath.split("/").pop() ?? projectPath;
  const date = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  return {
    markdown: buildMarkdown(scans, projectPath, projName, date, security),
    json: buildJson(scans, projectPath, projName, date, security)
  };
}
function dumpSnapshot(projectPath) {
  try {
    const db = getDb();
    const scans = db.prepare(`
      SELECT file_path, global_score, complexity_score, cognitive_complexity_score,
             function_size_score, churn_score, depth_score, param_score,
             fan_in, fan_out, hotspot_score, language,
             raw_complexity, raw_cognitive_complexity, raw_function_size,
             raw_churn, raw_depth, raw_params, scanned_at
      FROM scans s1
      WHERE project_path = ?
        AND id = (SELECT MAX(id) FROM scans s2 WHERE s2.file_path = s1.file_path AND s2.project_path = s1.project_path)
      ORDER BY global_score DESC
    `).all(projectPath);
    const history = db.prepare(`
      SELECT avg_score, health_pct, file_count, scanned_at
      FROM project_snapshots WHERE project_path = ?
      ORDER BY scanned_at ASC LIMIT 90
    `).all(projectPath);
    let couplings = [];
    try {
      couplings = db.prepare(`
        SELECT file_a, file_b, co_change_count FROM couplings
        WHERE project_path = ? ORDER BY co_change_count DESC LIMIT 15
      `).all(projectPath);
    } catch {
    }
    let weights = null;
    try {
      const w = db.prepare(`SELECT weights FROM weight_state WHERE project_path = ?`).get(projectPath);
      if (w) weights = JSON.parse(w.weights);
    } catch {
    }
    const avg = scans.length > 0 ? scans.reduce((a, s) => a + s.global_score, 0) / scans.length : 0;
    const snapshot = {
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      project: {
        path: projectPath,
        name: projectPath.split("/").pop(),
        summary: {
          total: scans.length,
          critical: scans.filter((s) => s.global_score >= 50).length,
          stressed: scans.filter((s) => s.global_score >= 20 && s.global_score < 50).length,
          healthy: scans.filter((s) => s.global_score < 20).length,
          avg_score: parseFloat(avg.toFixed(1)),
          health_pct: Math.round(Math.max(0, 100 - avg))
        },
        weights,
        scans: scans.map((s) => ({
          file: s.file_path.replace(projectPath + "/", ""),
          score: parseFloat(s.global_score.toFixed(1)),
          status: s.global_score >= 50 ? "critical" : s.global_score >= 20 ? "stressed" : "healthy",
          language: s.language,
          cx: s.raw_complexity,
          cog: s.raw_cognitive_complexity,
          size: s.raw_function_size,
          churn: s.raw_churn,
          depth: s.raw_depth,
          params: s.raw_params,
          fanIn: s.fan_in,
          fanOut: s.fan_out,
          hotspot: parseFloat((s.hotspot_score ?? 0).toFixed(1)),
          scanned_at: s.scanned_at
        })),
        history,
        couplings: couplings.map((c) => ({
          a: c.file_a.replace(projectPath + "/", ""),
          b: c.file_b.replace(projectPath + "/", ""),
          co_changes: c.co_change_count
        }))
      }
    };
    let outDir = projectPath;
    let candidate = join(app.getAppPath(), "..", "..", "..");
    if (fs__default.existsSync(join(candidate, "package.json"))) outDir = candidate;
    const outPath = join(outDir, "cortex-snapshot.json");
    fs__default.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    console.log("[Cortex] Snapshot écrit :", outPath);
  } catch (err) {
    console.warn("[Cortex] dumpSnapshot failed (non-fatal):", err);
  }
}
let mainWindow = null;
let lastEdges = [];
let lastScoreSnapshot = /* @__PURE__ */ new Map();
function getActiveProjectPath() {
  const settings = loadSettings();
  if (settings.activeProjectPath) return settings.activeProjectPath;
  if (settings.projects.length > 0) return settings.projects[0].path;
  return "";
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 15 },
    title: "Cortex",
    transparent: true,
    backgroundColor: "#00000000",
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js")
    }
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("enter-full-screen", () => mainWindow?.webContents.send("fullscreen-change", true));
  mainWindow.on("leave-full-screen", () => mainWindow?.webContents.send("fullscreen-change", false));
}
function emit(type, message, level = "info") {
  mainWindow?.webContents.send("cortex-event", { type, message, level, ts: Date.now() });
}
async function runScan() {
  try {
    const projectPath = getActiveProjectPath();
    emit("scan-start", "analysis triggered", "info");
    const settings = loadSettings();
    const result = await scanProject(projectPath, settings.ignore, settings.ignoredFiles);
    lastEdges = result.edges;
    const thresholdHit = [];
    const degraded = [];
    const improved = [];
    for (const file of result.files) {
      const prev = lastScoreSnapshot.get(file.filePath);
      const curr = file.globalScore;
      const name = file.filePath.split("/").pop() ?? file.filePath;
      if (prev === void 0) continue;
      const delta = curr - prev;
      if (prev < 50 && curr >= 50) thresholdHit.push({ name, filePath: file.filePath, score: curr });
      else if (delta >= 8) degraded.push(`${name} +${delta.toFixed(0)}`);
      else if (delta <= -8) improved.push(`${name} ${delta.toFixed(0)}`);
    }
    if (thresholdHit.length > 0) {
      for (const t of thresholdHit) {
        emit("threshold", `${t.name} · crossed critical threshold`, "critical");
      }
      if (Notification.isSupported()) {
        const toNotify = thresholdHit.slice(0, 3);
        const extra = thresholdHit.length - toNotify.length;
        const body = [
          ...toNotify.map((t) => `${t.name}  ·  score ${t.score.toFixed(0)}`),
          ...extra > 0 ? [`+${extra} more`] : []
        ].join("\n");
        const notif = new Notification({ title: "⚠ Cortex — Critical", body, silent: false });
        notif.on("click", () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (toNotify[0]) mainWindow.webContents.send("focus-file", toNotify[0].filePath);
          }
        });
        notif.show();
      }
    }
    if (degraded.length > 0) emit("degraded", `${degraded.slice(0, 2).join(", ")}${degraded.length > 2 ? ` +${degraded.length - 2} more` : ""} · score up`, "warn");
    if (improved.length > 0) emit("improved", `${improved.slice(0, 2).join(", ")}${improved.length > 2 ? ` +${improved.length - 2} more` : ""} · score down`, "ok");
    const totalDegraded = degraded.length + thresholdHit.length;
    const summary = totalDegraded > 0 ? `${result.files.length} modules · ${totalDegraded} degraded` : improved.length > 0 ? `${result.files.length} modules · ${improved.length} improved` : `${result.files.length} modules · stable`;
    emit("scan-done", summary, totalDegraded > 0 ? "warn" : improved.length > 0 ? "ok" : "info");
    lastScoreSnapshot = new Map(result.files.map((f) => [f.filePath, f.globalScore]));
    const avgScore = result.files.length > 0 ? result.files.reduce((a, f) => a + f.globalScore, 0) / result.files.length : 0;
    saveProjectSnapshot(projectPath, avgScore, result.files.length);
    dumpSnapshot(projectPath);
    mainWindow?.webContents.send("scan-complete");
  } catch (err) {
    console.error("[Cortex] Scan error:", err);
    emit("scan-error", "scan failed · check console", "critical");
  }
}
app.whenReady().then(async () => {
  initDb();
  const cleaned = cleanDeletedFiles();
  if (cleaned > 0) console.log(`[Cortex] Cleaned ${cleaned} deleted file(s) from DB.`);
  purgeIgnoredFromDb();
  ipcMain.handle("get-scans", () => {
    const ignoredSet = new Set(loadSettings().ignoredFiles);
    return getLatestScans(getActiveProjectPath()).filter((s) => !ignoredSet.has(s.filePath));
  });
  ipcMain.handle("get-project-path", () => getActiveProjectPath());
  ipcMain.handle("get-edges", () => lastEdges);
  ipcMain.handle("get-functions", (_e, filePath) => getFunctions(filePath));
  ipcMain.handle("get-score-history", (_e, filePath) => getScoreHistory(filePath));
  ipcMain.handle("get-project-score-history", () => getProjectScoreHistory(getActiveProjectPath()));
  ipcMain.handle("get-project-history", () => getProjectHistory(getActiveProjectPath()));
  ipcMain.handle("get-project-history-day", () => getProjectHistoryByDay(getActiveProjectPath()));
  ipcMain.handle("get-settings", () => loadSettings());
  ipcMain.handle("save-settings", (_e, s) => saveSettings(s));
  ipcMain.handle("get-projects", () => loadSettings().projects);
  ipcMain.handle("add-project", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Add project folder"
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const newPath = result.filePaths[0];
    const updated = addProject(loadSettings(), newPath);
    saveSettings(updated);
    lastScoreSnapshot = /* @__PURE__ */ new Map();
    emit("project-switch", `switched · ${newPath.split("/").pop()}`, "info");
    const w = global.__cortexWatcher;
    if (w) await w.restart(newPath, loadSettings().ignore);
    runScan();
    return updated.projects;
  });
  ipcMain.handle("remove-project", (_e, projectPath) => {
    const updated = removeProject(loadSettings(), projectPath);
    saveSettings(updated);
    lastScoreSnapshot = /* @__PURE__ */ new Map();
    const w = global.__cortexWatcher;
    if (updated.activeProjectPath && updated.activeProjectPath !== projectPath) {
      emit("project-switch", `switched · ${updated.activeProjectPath.split("/").pop()}`, "info");
      if (w) w.restart(updated.activeProjectPath, loadSettings().ignore);
      runScan();
    } else if (!updated.activeProjectPath) {
      if (w) w.close();
      emit("project-switch", "", "info");
      mainWindow?.webContents.send("scan-complete");
    }
    return updated.projects;
  });
  ipcMain.handle("ignore-file", (_e, filePath) => {
    const updated = ignoreFile(loadSettings(), filePath);
    saveSettings(updated);
    runScan();
    return updated.ignoredFiles;
  });
  ipcMain.handle("unignore-file", (_e, filePath) => {
    const updated = unignoreFile(loadSettings(), filePath);
    saveSettings(updated);
    runScan();
    return updated.ignoredFiles;
  });
  ipcMain.handle("get-ignored-files", () => loadSettings().ignoredFiles);
  ipcMain.handle("run-security-scan", async (_e, projectPath) => {
    const getSecurityCachePath = (projPath) => {
      const key = projPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-60);
      return join(app.getPath("userData"), `security_${key}.json`);
    };
    const saveSecurityToSnapshot = (result2) => {
      try {
        fs__default.writeFileSync(getSecurityCachePath(projectPath), JSON.stringify(result2, null, 2));
      } catch {
      }
    };
    const settings = loadSettings();
    const findings = scanProjectForPatterns(projectPath, settings.ignore);
    const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "out", ".vite", "__pycache__", "venv", ".venv"]);
    function findNodeProjects(dir, depth = 0) {
      if (depth > 4) return [];
      const found = [];
      try {
        const entries = fs__default.readdirSync(dir, { withFileTypes: true });
        const hasPkg = entries.some((e) => e.isFile() && e.name === "package.json");
        const hasLock = entries.some((e) => e.isFile() && ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(e.name));
        if (hasPkg && hasLock) {
          found.push(dir);
          return found;
        }
        for (const entry of entries) {
          if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
          found.push(...findNodeProjects(path__default.join(dir, entry.name), depth + 1));
        }
      } catch {
      }
      return found;
    }
    const nodeProjects = findNodeProjects(projectPath);
    if (nodeProjects.length === 0) {
      let hasPkgAnywhere = function(dir, depth = 0) {
        if (depth > 4) return false;
        try {
          const entries = fs__default.readdirSync(dir, { withFileTypes: true });
          if (entries.some((e) => e.isFile() && e.name === "package.json")) return true;
          return entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name)).some((e) => hasPkgAnywhere(path__default.join(dir, e.name), depth + 1));
        } catch {
          return false;
        }
      };
      const pkgExists = hasPkgAnywhere(projectPath);
      const reason = pkgExists ? "package.json found but no lockfile (package-lock.json / yarn.lock / pnpm-lock.yaml). Run your package manager install first." : "No package.json found in this project — dependency audit only applies to Node.js projects.";
      const result2 = {
        findings,
        audit: { status: "not_run", vulns: [], counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }, reason },
        scannedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveSecurityToSnapshot(result2);
      return result2;
    }
    function runAuditIn(dir) {
      return new Promise((resolve) => {
        execFile("npm", ["audit", "--json"], { cwd: dir, timeout: 3e4 }, (_err, stdout) => {
          try {
            const json = JSON.parse(stdout);
            const vulns = Object.values(json.vulnerabilities ?? {});
            const counts = json.metadata?.vulnerabilities ?? { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
            resolve({ vulns, counts });
          } catch (e) {
            resolve({ vulns: [], counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }, error: String(e) });
          }
        });
      });
    }
    const auditResults = await Promise.all(
      nodeProjects.map(async (dir) => ({ dir, ...await runAuditIn(dir) }))
    );
    const allVulns = [];
    const merged = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
    let hasError = false;
    for (const { dir, vulns, counts, error } of auditResults) {
      if (error) {
        hasError = true;
        continue;
      }
      const subdir = dir === projectPath ? "" : dir.replace(projectPath + "/", "");
      for (const v of vulns) {
        allVulns.push({ ...v, subdir: subdir || void 0 });
      }
      for (const k of Object.keys(merged)) {
        merged[k] += counts[k] ?? 0;
      }
    }
    const audit = {
      status: "ok",
      counts: merged,
      vulns: allVulns.map((v) => ({
        name: v.name ?? "?",
        severity: v.severity ?? "low",
        via: (v.via ?? []).filter((x) => typeof x === "string"),
        range: v.range ?? "",
        fixAvailable: !!v.fixAvailable,
        subdir: v.subdir,
        cves: (v.via ?? []).filter((x) => typeof x === "object" && x?.url).map((x) => x.cve ?? x.url ?? "").filter(Boolean)
      })),
      ...hasError ? { error: "Some sub-projects failed to audit." } : {}
    };
    const result = { findings, audit, scannedAt: (/* @__PURE__ */ new Date()).toISOString() };
    saveSecurityToSnapshot(result);
    return result;
  });
  ipcMain.handle("open-external", (_e, url) => shell.openExternal(url));
  ipcMain.handle("get-last-security-result", (_e, projectPath) => {
    try {
      const key = projectPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-60);
      const cachePath = join(app.getPath("userData"), `security_${key}.json`);
      if (fs__default.existsSync(cachePath)) return JSON.parse(fs__default.readFileSync(cachePath, "utf-8"));
    } catch {
    }
    return null;
  });
  ipcMain.handle("read-file", (_e, filePath) => {
    try {
      return { ok: true, content: fs__default.readFileSync(filePath, "utf-8") };
    } catch (err) {
      return { ok: false, content: "" };
    }
  });
  ipcMain.handle("get-projects-health", async () => {
    const settings = loadSettings();
    return settings.projects.map((p) => {
      const summary = getProjectSummary(p.path);
      return { path: p.path, avgScore: summary.avgScore, fileCount: summary.fileCount };
    });
  });
  ipcMain.handle("switch-project", async (_e, projectPath) => {
    const updated = setActiveProject(loadSettings(), projectPath);
    saveSettings(updated);
    lastScoreSnapshot = /* @__PURE__ */ new Map();
    emit("project-switch", `switched · ${projectPath.split("/").pop()}`, "info");
    const w = global.__cortexWatcher;
    if (w) await w.restart(projectPath, loadSettings().ignore);
    runScan();
    return projectPath;
  });
  ipcMain.handle("pick-project", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select project folder"
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const newPath = result.filePaths[0];
    const updated = addProject(loadSettings(), newPath);
    saveSettings(updated);
    lastScoreSnapshot = /* @__PURE__ */ new Map();
    emit("project-switch", `switched · ${newPath.split("/").pop()}`, "info");
    const w = global.__cortexWatcher;
    if (w) await w.restart(newPath, loadSettings().ignore);
    runScan();
    return newPath;
  });
  ipcMain.handle("export-report", async () => {
    const projectPath = getActiveProjectPath();
    const projName = projectPath.split("/").pop() ?? "project";
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const baseName = `cortex-report-${projName}-${dateStr}`;
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "Export Cortex Report",
      defaultPath: baseName + ".md",
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "JSON", extensions: ["json"] }
      ]
    });
    if (canceled || !filePath) return { ok: false };
    const ignoredSet = new Set(loadSettings().ignoredFiles);
    const scans = getLatestScans(projectPath).filter((s) => !ignoredSet.has(s.filePath));
    let security = null;
    try {
      const key = projectPath.replace(/[^a-zA-Z0-9]/g, "_").slice(-60);
      const cachePath = join(app.getPath("userData"), `security_${key}.json`);
      if (fs__default.existsSync(cachePath)) security = JSON.parse(fs__default.readFileSync(cachePath, "utf-8"));
    } catch {
    }
    const { markdown, json } = buildReport(scans, projectPath, security);
    const isJson = filePath.endsWith(".json");
    fs__default.writeFileSync(filePath, isJson ? json : markdown, "utf-8");
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const companion = isJson ? `${dir}/${baseName}.md` : `${dir}/${baseName}.json`;
    fs__default.writeFileSync(companion, isJson ? markdown : json, "utf-8");
    console.log(`[Cortex] Report exported: ${filePath} + ${companion}`);
    return { ok: true, path: filePath };
  });
  createWindow();
  runScan();
  const initialSettings = loadSettings();
  const watcher = startWatcher({
    projectPath: getActiveProjectPath(),
    ignore: initialSettings.ignore
  });
  let scanTimeout = null;
  const debouncedScan = (path2, eventType) => {
    const file = path2.split("/").pop();
    mainWindow?.webContents.send("cortex-event", {
      type: eventType,
      file,
      filePath: path2,
      message: `${file} · ${eventType}`,
      level: "info",
      ts: Date.now()
    });
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => runScan(), 1500);
  };
  watcher.emitter.on("file:changed", (p) => debouncedScan(p, "changed"));
  watcher.emitter.on("file:added", (p) => debouncedScan(p, "added"));
  watcher.emitter.on("file:deleted", (p) => debouncedScan(p, "deleted"));
  watcher.emitter.on("watcher:restarted", (newPath) => {
    emit("watcher-restarted", `watching · ${newPath.split("/").pop()}`, "info");
  });
  global.__cortexWatcher = watcher;
  app.on("before-quit", async () => {
    await watcher.close();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
