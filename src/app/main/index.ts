import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron';
import { join } from 'node:path';
import path from 'node:path';
import fs from 'node:fs';
import {
  initDb, getLatestScans, getFunctions, cleanDeletedFiles, purgeIgnoredFromDb,
  getScoreHistory,
  getProjectScoreHistory, getProjectSummary,
  saveProjectSnapshot, getProjectHistory, getProjectHistoryByDay,
} from '../../database/db.js';
import { scanProject } from './scanner.js';
import { scanProjectForPatterns } from '../../cortex/security/patternScanner.js';
import type { SecurityScanResult } from '../../cortex/security/patternScanner.js';
import { execFile } from 'node:child_process';
import type { FileEdge } from './scanner.js';
import { loadSettings, saveSettings, addProject, removeProject, setActiveProject, ignoreFile, unignoreFile, type AppSettings } from './settings.js';
import { startWatcher } from '../../cortex/watcher/watcher.js';
import { buildReport } from './report.js';
import { getDb } from '../../database/db.js';

// ── Snapshot pour accès Claude ────────────────────────────────────────────────
// Écrit cortex-snapshot.json dans le dossier du projet Cortex après chaque scan.
// Permet à Claude de lire les métriques sans passer par l'UI.

function dumpSnapshot(projectPath: string): void {
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
    `).all(projectPath) as any[];

    const history = db.prepare(`
      SELECT avg_score, health_pct, file_count, scanned_at
      FROM project_snapshots WHERE project_path = ?
      ORDER BY scanned_at ASC LIMIT 90
    `).all(projectPath) as any[];

    let couplings: any[] = [];
    try {
      couplings = db.prepare(`
        SELECT file_a, file_b, co_change_count FROM couplings
        WHERE project_path = ? ORDER BY co_change_count DESC LIMIT 15
      `).all(projectPath) as any[];
    } catch { /* ok */ }

    let weights = null;
    try {
      const w = db.prepare(`SELECT weights FROM weight_state WHERE project_path = ?`).get(projectPath) as any;
      if (w) weights = JSON.parse(w.weights);
    } catch { /* ok */ }

    const avg = scans.length > 0
      ? scans.reduce((a: number, s: any) => a + s.global_score, 0) / scans.length : 0;

    const snapshot = {
      generated_at: new Date().toISOString(),
      project: {
        path: projectPath,
        name: projectPath.split('/').pop(),
        summary: {
          total:      scans.length,
          critical:   scans.filter((s: any) => s.global_score >= 50).length,
          stressed:   scans.filter((s: any) => s.global_score >= 20 && s.global_score < 50).length,
          healthy:    scans.filter((s: any) => s.global_score < 20).length,
          avg_score:  parseFloat(avg.toFixed(1)),
          health_pct: Math.round(Math.max(0, 100 - avg)),
        },
        weights,
        scans: scans.map((s: any) => ({
          file:     s.file_path.replace(projectPath + '/', ''),
          score:    parseFloat(s.global_score.toFixed(1)),
          status:   s.global_score >= 50 ? 'critical' : s.global_score >= 20 ? 'stressed' : 'healthy',
          language: s.language,
          cx: s.raw_complexity,          cog:    s.raw_cognitive_complexity,
          size: s.raw_function_size,     churn:  s.raw_churn,
          depth: s.raw_depth,            params: s.raw_params,
          fanIn: s.fan_in,               fanOut: s.fan_out,
          hotspot: parseFloat((s.hotspot_score ?? 0).toFixed(1)),
          scanned_at: s.scanned_at,
        })),
        history,
        couplings: couplings.map((c: any) => ({
          a: c.file_a.replace(projectPath + '/', ''),
          b: c.file_b.replace(projectPath + '/', ''),
          co_changes: c.co_change_count,
        })),
      },
    };

    // En dev  : app.getAppPath() = .../Cortex/out/main  → remonter de 3 niveaux
    // En prod : app.getAppPath() = .../Cortex.app/Contents/Resources/app → hors dossier Cortex
    // On utilise le projectPath comme ancre : on cherche package.json en remontant
    let outDir = projectPath; // fallback : dossier du projet analysé
    let candidate = join(app.getAppPath(), '..', '..', '..');
    if (fs.existsSync(join(candidate, 'package.json'))) outDir = candidate;
    const outPath = join(outDir, 'cortex-snapshot.json');
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    console.log('[Cortex] Snapshot écrit :', outPath);
  } catch (err) {
    console.warn('[Cortex] dumpSnapshot failed (non-fatal):', err);
  }
}

let mainWindow: BrowserWindow | null = null;
let lastEdges: FileEdge[] = [];
let lastScoreSnapshot = new Map<string, number>();

function getActiveProjectPath(): string {
  const settings = loadSettings();
  if (settings.activeProjectPath) return settings.activeProjectPath;
  if (settings.projects.length > 0) return settings.projects[0]!.path;
  return '';
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 15 },
    title: 'Cortex',
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('fullscreen-change', true));
  mainWindow.on('leave-full-screen',  () => mainWindow?.webContents.send('fullscreen-change', false));
}

function emit(type: string, message: string, level: 'info' | 'warn' | 'critical' | 'ok' = 'info') {
  mainWindow?.webContents.send('cortex-event', { type, message, level, ts: Date.now() });
}

async function runScan(): Promise<void> {
  try {
    const projectPath = getActiveProjectPath();
    emit('scan-start', 'analysis triggered', 'info');

    const settings = loadSettings();
    const result = await scanProject(projectPath, settings.ignore, settings.ignoredFiles);
    lastEdges = result.edges;

    const thresholdHit: { name: string; filePath: string; score: number }[] = [];
    const degraded:     string[] = [];
    const improved:     string[] = [];

    for (const file of result.files) {
      const prev = lastScoreSnapshot.get(file.filePath);
      const curr = file.globalScore;
      const name = file.filePath.split('/').pop() ?? file.filePath;
      if (prev === undefined) continue;
      const delta = curr - prev;
      if (prev < 50 && curr >= 50) thresholdHit.push({ name, filePath: file.filePath, score: curr });
      else if (delta >= 8)         degraded.push(`${name} +${delta.toFixed(0)}`);
      else if (delta <= -8)        improved.push(`${name} ${delta.toFixed(0)}`);
    }

    if (thresholdHit.length > 0) {
      for (const t of thresholdHit) {
        emit('threshold', `${t.name} · crossed critical threshold`, 'critical');
      }
      if (Notification.isSupported()) {
        const toNotify = thresholdHit.slice(0, 3);
        const extra    = thresholdHit.length - toNotify.length;
        const body     = [
          ...toNotify.map(t => `${t.name}  ·  score ${t.score.toFixed(0)}`),
          ...(extra > 0 ? [`+${extra} more`] : []),
        ].join('\n');
        const notif = new Notification({ title: '⚠ Cortex — Critical', body, silent: false });
        notif.on('click', () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (toNotify[0]) mainWindow.webContents.send('focus-file', toNotify[0]!.filePath);
          }
        });
        notif.show();
      }
    }
    if (degraded.length > 0) emit('degraded', `${degraded.slice(0, 2).join(', ')}${degraded.length > 2 ? ` +${degraded.length - 2} more` : ''} · score up`, 'warn');
    if (improved.length > 0) emit('improved', `${improved.slice(0, 2).join(', ')}${improved.length > 2 ? ` +${improved.length - 2} more` : ''} · score down`, 'ok');

    const totalDegraded = degraded.length + thresholdHit.length;
    const summary = totalDegraded > 0
      ? `${result.files.length} modules · ${totalDegraded} degraded`
      : improved.length > 0 ? `${result.files.length} modules · ${improved.length} improved`
      : `${result.files.length} modules · stable`;

    emit('scan-done', summary, totalDegraded > 0 ? 'warn' : improved.length > 0 ? 'ok' : 'info');
    lastScoreSnapshot = new Map(result.files.map(f => [f.filePath, f.globalScore]));

    const avgScore = result.files.length > 0
      ? result.files.reduce((a, f) => a + f.globalScore, 0) / result.files.length
      : 0;
    saveProjectSnapshot(projectPath, avgScore, result.files.length);

    dumpSnapshot(projectPath);
    mainWindow?.webContents.send('scan-complete');
  } catch (err) {
    console.error('[Cortex] Scan error:', err);
    emit('scan-error', 'scan failed · check console', 'critical');
  }
}

app.whenReady().then(async () => {
  initDb();
  const cleaned = cleanDeletedFiles();
  if (cleaned > 0) console.log(`[Cortex] Cleaned ${cleaned} deleted file(s) from DB.`);
  purgeIgnoredFromDb();

  // ── IPC handlers ──────────────────────────────────────────────────────────
  ipcMain.handle('get-scans', () => {
    const ignoredSet = new Set(loadSettings().ignoredFiles);
    return getLatestScans(getActiveProjectPath()).filter(s => !ignoredSet.has(s.filePath));
  });
  ipcMain.handle('get-project-path',        () => getActiveProjectPath());
  ipcMain.handle('get-edges',               () => lastEdges);
  ipcMain.handle('get-functions',           (_e, filePath: string) => getFunctions(filePath));
  ipcMain.handle('get-score-history',       (_e, filePath: string) => getScoreHistory(filePath));
  ipcMain.handle('get-project-score-history', () => getProjectScoreHistory(getActiveProjectPath()));
  ipcMain.handle('get-project-history',     () => getProjectHistory(getActiveProjectPath()));
  ipcMain.handle('get-project-history-day', () => getProjectHistoryByDay(getActiveProjectPath()));
  ipcMain.handle('get-settings', () => loadSettings());
  ipcMain.handle('save-settings', (_e, s) => saveSettings(s));

  // ── Gestion projets ────────────────────────────────────────────────────────
  ipcMain.handle('get-projects', () => loadSettings().projects);

  ipcMain.handle('add-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'], title: 'Add project folder',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const newPath = result.filePaths[0];
    const updated = addProject(loadSettings(), newPath);
    saveSettings(updated);
    lastScoreSnapshot = new Map();
    emit('project-switch', `switched · ${newPath.split('/').pop()}`, 'info');
    const w = (global as any).__cortexWatcher;
    if (w) await w.restart(newPath, loadSettings().ignore);
    runScan();
    return updated.projects;
  });

  ipcMain.handle('remove-project', (_e, projectPath: string) => {
    const updated = removeProject(loadSettings(), projectPath);
    saveSettings(updated);
    lastScoreSnapshot = new Map();
    const w = (global as any).__cortexWatcher;
    if (updated.activeProjectPath && updated.activeProjectPath !== projectPath) {
      // Bascule sur le projet suivant
      emit('project-switch', `switched · ${updated.activeProjectPath.split('/').pop()}`, 'info');
      if (w) w.restart(updated.activeProjectPath, loadSettings().ignore);
      runScan();
    } else if (!updated.activeProjectPath) {
      // Plus aucun projet — arrêter le watcher, signaler l'UI
      if (w) w.close();
      emit('project-switch', '', 'info');
      mainWindow?.webContents.send('scan-complete');
    }
    return updated.projects;
  });

  ipcMain.handle('ignore-file', (_e, filePath: string) => {
    const updated = ignoreFile(loadSettings(), filePath);
    saveSettings(updated);
    runScan();
    return updated.ignoredFiles;
  });

  ipcMain.handle('unignore-file', (_e, filePath: string) => {
    const updated = unignoreFile(loadSettings(), filePath);
    saveSettings(updated);
    runScan();
    return updated.ignoredFiles;
  });

  ipcMain.handle('get-ignored-files', () => loadSettings().ignoredFiles);

  ipcMain.handle('run-security-scan', async (_e, projectPath: string): Promise<SecurityScanResult> => {
    const getSecurityCachePath = (projPath: string) => {
      const key = projPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
      return join(app.getPath('userData'), `security_${key}.json`);
    };
    const saveSecurityToSnapshot = (result: SecurityScanResult) => {
      try {
        fs.writeFileSync(getSecurityCachePath(projectPath), JSON.stringify(result, null, 2));
      } catch { /* non-fatal */ }
    };
    const settings = loadSettings();
    const findings = scanProjectForPatterns(projectPath, settings.ignore);

    const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.vite', '__pycache__', 'venv', '.venv']);

    function findNodeProjects(dir: string, depth = 0): string[] {
      if (depth > 4) return [];
      const found: string[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const hasPkg  = entries.some(e => e.isFile() && e.name === 'package.json');
        const hasLock = entries.some(e => e.isFile() && ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(e.name));
        if (hasPkg && hasLock) { found.push(dir); return found; }
        for (const entry of entries) {
          if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
          found.push(...findNodeProjects(path.join(dir, entry.name), depth + 1));
        }
      } catch { /* dossier inaccessible */ }
      return found;
    }

    const nodeProjects = findNodeProjects(projectPath);

    if (nodeProjects.length === 0) {
      function hasPkgAnywhere(dir: string, depth = 0): boolean {
        if (depth > 4) return false;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          if (entries.some(e => e.isFile() && e.name === 'package.json')) return true;
          return entries
            .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
            .some(e => hasPkgAnywhere(path.join(dir, e.name), depth + 1));
        } catch { return false; }
      }
      const pkgExists = hasPkgAnywhere(projectPath);
      const reason = pkgExists
        ? 'package.json found but no lockfile (package-lock.json / yarn.lock / pnpm-lock.yaml). Run your package manager install first.'
        : 'No package.json found in this project — dependency audit only applies to Node.js projects.';

      const result: SecurityScanResult = {
        findings,
        audit: { status: 'not_run', vulns: [], counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }, reason },
        scannedAt: new Date().toISOString(),
      };
      saveSecurityToSnapshot(result);
      return result;
    }

    function runAuditIn(dir: string): Promise<{ vulns: any[]; counts: any; error?: string }> {
      return new Promise(resolve => {
        execFile('npm', ['audit', '--json'], { cwd: dir, timeout: 30_000 }, (_err, stdout) => {
          try {
            const json   = JSON.parse(stdout) as any;
            const vulns  = Object.values(json.vulnerabilities ?? {}) as any[];
            const counts = json.metadata?.vulnerabilities ?? { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
            resolve({ vulns, counts });
          } catch (e) {
            resolve({ vulns: [], counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }, error: String(e) });
          }
        });
      });
    }

    const auditResults = await Promise.all(
      nodeProjects.map(async dir => ({ dir, ...(await runAuditIn(dir)) }))
    );

    const allVulns: any[] = [];
    const merged = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
    let hasError = false;

    for (const { dir, vulns, counts, error } of auditResults) {
      if (error) { hasError = true; continue; }
      const subdir = dir === projectPath ? '' : dir.replace(projectPath + '/', '');
      for (const v of vulns) { allVulns.push({ ...v, subdir: subdir || undefined }); }
      for (const k of Object.keys(merged) as (keyof typeof merged)[]) {
        merged[k] += (counts[k] ?? 0);
      }
    }

    const audit: SecurityScanResult['audit'] = {
      status: 'ok',
      counts: merged,
      vulns: allVulns.map((v: any) => ({
        name:         v.name ?? '?',
        severity:     v.severity ?? 'low',
        via:          (v.via ?? []).filter((x: any) => typeof x === 'string'),
        range:        v.range ?? '',
        fixAvailable: !!v.fixAvailable,
        subdir:       v.subdir,
        cves:         (v.via ?? [])
                        .filter((x: any) => typeof x === 'object' && x?.url)
                        .map((x: any) => x.cve ?? x.url ?? '')
                        .filter(Boolean),
      })),
      ...(hasError ? { error: 'Some sub-projects failed to audit.' } : {}),
    };

    const result: SecurityScanResult = { findings, audit, scannedAt: new Date().toISOString() };
    saveSecurityToSnapshot(result);
    return result;
  });

  ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url));

  ipcMain.handle('get-last-security-result', (_e, projectPath: string) => {
    try {
      const key       = projectPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
      const cachePath = join(app.getPath('userData'), `security_${key}.json`);
      if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch { /* non-fatal */ }
    return null;
  });

  ipcMain.handle('read-file', (_e, filePath: string) => {
    try {
      return { ok: true, content: fs.readFileSync(filePath, 'utf-8') };
    } catch (err) {
      return { ok: false, content: '' };
    }
  });

  ipcMain.handle('get-projects-health', async () => {
    const settings = loadSettings();
    return settings.projects.map(p => {
      const summary = getProjectSummary(p.path);
      return { path: p.path, avgScore: summary.avgScore, fileCount: summary.fileCount };
    });
  });

  ipcMain.handle('switch-project', async (_e, projectPath: string) => {
    const updated = setActiveProject(loadSettings(), projectPath);
    saveSettings(updated);
    lastScoreSnapshot = new Map();
    emit('project-switch', `switched · ${projectPath.split('/').pop()}`, 'info');
    const w = (global as any).__cortexWatcher;
    if (w) await w.restart(projectPath, loadSettings().ignore);
    runScan();
    return projectPath;
  });

  ipcMain.handle('pick-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'], title: 'Select project folder',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const newPath = result.filePaths[0];
    const updated = addProject(loadSettings(), newPath);
    saveSettings(updated);
    lastScoreSnapshot = new Map();
    emit('project-switch', `switched · ${newPath.split('/').pop()}`, 'info');
    const w = (global as any).__cortexWatcher;
    if (w) await w.restart(newPath, loadSettings().ignore);
    runScan();
    return newPath;
  });

  // ── Export rapport ─────────────────────────────────────────────────────────
  ipcMain.handle('export-report', async () => {
    const projectPath = getActiveProjectPath();
    const projName    = projectPath.split('/').pop() ?? 'project';
    const dateStr     = new Date().toISOString().split('T')[0];
    const baseName    = `cortex-report-${projName}-${dateStr}`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title:       'Export Cortex Report',
      defaultPath: baseName + '.md',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON',     extensions: ['json'] },
      ],
    });

    if (canceled || !filePath) return { ok: false };

    const ignoredSet = new Set(loadSettings().ignoredFiles);
    const scans      = (getLatestScans(projectPath) as any[]).filter(s => !ignoredSet.has(s.filePath));
    let security: any = null;
    try {
      const key       = projectPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
      const cachePath = join(app.getPath('userData'), `security_${key}.json`);
      if (fs.existsSync(cachePath)) security = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch { /* non-fatal */ }
    const { markdown, json } = buildReport(scans, projectPath, security);
    const isJson = filePath.endsWith('.json');
    fs.writeFileSync(filePath, isJson ? json : markdown, 'utf-8');

    const dir       = filePath.substring(0, filePath.lastIndexOf('/'));
    const companion = isJson ? `${dir}/${baseName}.md` : `${dir}/${baseName}.json`;
    fs.writeFileSync(companion, isJson ? markdown : json, 'utf-8');

    console.log(`[Cortex] Report exported: ${filePath} + ${companion}`);
    return { ok: true, path: filePath };
  });

  createWindow();
  runScan();

  // ── Watcher ────────────────────────────────────────────────────────────────
  const initialSettings = loadSettings();
  const watcher = startWatcher({
    projectPath: getActiveProjectPath(),
    ignore:      initialSettings.ignore,
  });
  let scanTimeout: ReturnType<typeof setTimeout> | null = null;

  const debouncedScan = (path: string, eventType: string) => {
    const file = path.split('/').pop();
    mainWindow?.webContents.send('cortex-event', {
      type: eventType, file, filePath: path, message: `${file} · ${eventType}`,
      level: 'info', ts: Date.now(),
    });
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => runScan(), 1500);
  };

  watcher.emitter.on('file:changed', (p: string) => debouncedScan(p, 'changed'));
  watcher.emitter.on('file:added',   (p: string) => debouncedScan(p, 'added'));
  watcher.emitter.on('file:deleted', (p: string) => debouncedScan(p, 'deleted'));
  watcher.emitter.on('watcher:restarted', (newPath: string) => {
    emit('watcher-restarted', `watching · ${newPath.split('/').pop()}`, 'info');
  });

  (global as any).__cortexWatcher = watcher;

  app.on('before-quit', async () => {
    await watcher.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
