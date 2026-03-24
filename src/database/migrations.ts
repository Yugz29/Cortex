/**
 * Système de migrations versionnées pour la base SQLite.
 *
 * Chaque migration est une fonction idempotente identifiée par un numéro de version.
 * La table `schema_version` stocke la version courante.
 * Au démarrage, seules les migrations manquantes sont appliquées, dans l'ordre.
 *
 * Pour ajouter une migration :
 *   1. Incrémenter CURRENT_VERSION
 *   2. Ajouter une entrée dans MIGRATIONS avec la version correspondante
 *   3. Ne jamais modifier une migration existante — créer une nouvelle
 */

// Type-only import — better-sqlite3 est external dans electron-vite
// On utilise un type structurel plutôt qu'un import externe
type BetterSqlite3 = { exec: (sql: string) => void; prepare: (sql: string) => { run: (...args: any[]) => void }; transaction: (fn: () => void) => () => void };

export const CURRENT_VERSION = 8;

type Migration = {
    version: number;
    description: string;
    up: (db: BetterSqlite3) => void;
};

export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        description: 'Initial schema — scans, feedbacks, functions',
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
        },
    },
    {
        version: 2,
        description: 'Add raw metric columns to scans',
        up: (db) => {
            const cols = [
                `raw_complexity          INTEGER NOT NULL DEFAULT 0`,
                `raw_cognitive_complexity INTEGER NOT NULL DEFAULT 0`,
                `raw_function_size       INTEGER NOT NULL DEFAULT 0`,
                `raw_depth               INTEGER NOT NULL DEFAULT 0`,
                `raw_params              INTEGER NOT NULL DEFAULT 0`,
                `raw_churn               REAL    NOT NULL DEFAULT 0`,
                `cognitive_complexity_score REAL NOT NULL DEFAULT 0`,
                `hotspot_score           REAL    NOT NULL DEFAULT 0`,
            ];
            for (const col of cols) {
                try { db.exec(`ALTER TABLE scans ADD COLUMN ${col}`); } catch { /* already exists */ }
            }
        },
    },
    {
        version: 3,
        description: 'Couplings and weight_state tables',
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

            // weight_state — legacy (feedback loop supprimée)
            db.exec(`
                CREATE TABLE IF NOT EXISTS weight_state (
                    project_path TEXT PRIMARY KEY,
                    weights      TEXT NOT NULL,
                    updated_at   TEXT NOT NULL
                )
            `);
        },
    },
    {
        version: 4,
        description: 'LLM reports and intel messages tables — legacy (LLM supprimé)',
        up: (db) => {
            // Tables conservées pour compatibilité DB des utilisateurs existants
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
        },
    },
    {
        version: 5,
        description: 'Terminal errors and episodes tables — legacy (LLM supprimé)',
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
        },
    },
    {
        version: 6,
        description: 'Project snapshots table for history tracking',
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
        },
    },
    {
        version: 7,
        description: 'Add llm_report column to scans (legacy — kept for compat)',
        up: (db) => {
            try { db.exec(`ALTER TABLE scans ADD COLUMN llm_report TEXT`); } catch { /* already exists */ }
        },
    },
    {
        version: 8,
        description: 'Performance indexes on feedbacks and scans',
        up: (db) => {
            db.exec(`CREATE INDEX IF NOT EXISTS idx_feedbacks_file ON feedbacks(file_path, created_at DESC)`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_project_at ON project_snapshots(project_path, scanned_at DESC)`);
        },
    },
];

// ── Runner ──────────────────────────────────────────────────────────────────

export function runMigrations(db: BetterSqlite3): void {
    // Créer la table de versionnement si elle n'existe pas
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version    INTEGER NOT NULL,
            applied_at TEXT    NOT NULL
        )
    `);

    const row = db.prepare(`SELECT MAX(version) as v FROM schema_version`).get() as { v: number | null };
    const currentVersion = row.v ?? 0;

    if (currentVersion >= CURRENT_VERSION) return;

    const pending = MIGRATIONS.filter(m => m.version > currentVersion);
    console.log(`[DB] Applying ${pending.length} migration(s) (schema v${currentVersion} → v${CURRENT_VERSION})`);

    const insertVersion = db.prepare(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`);

    for (const migration of pending) {
        const applyMigration = db.transaction(() => {
            migration.up(db);
            insertVersion.run(migration.version, new Date().toISOString());
        });
        try {
            applyMigration();
            console.log(`[DB] ✓ Migration ${migration.version}: ${migration.description}`);
        } catch (err) {
            console.error(`[DB] ✗ Migration ${migration.version} failed:`, err);
            throw err; // fail fast — ne pas démarrer avec un schéma partiel
        }
    }
}
