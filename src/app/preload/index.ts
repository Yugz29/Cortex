import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Scans & data ──────────────────────────────────────────────────────────
  getScans: (): Promise<any[]> =>
    ipcRenderer.invoke('get-scans'),

  getEdges: (): Promise<{ from: string; to: string }[]> =>
    ipcRenderer.invoke('get-edges'),

  getFunctions: (filePath: string): Promise<any[]> =>
    ipcRenderer.invoke('get-functions', filePath),

  getScoreHistory: (filePath: string): Promise<{ score: number; scanned_at: string }[]> =>
    ipcRenderer.invoke('get-score-history', filePath),

  // ── Project ───────────────────────────────────────────────────────────────
  getProjectPath: (): Promise<string> =>
    ipcRenderer.invoke('get-project-path'),

  pickProject: (): Promise<string | null> =>
    ipcRenderer.invoke('pick-project'),

  getProjectScoreHistory: (): Promise<{ date: string; score: number }[]> =>
    ipcRenderer.invoke('get-project-score-history'),

  getProjectHistory: (): Promise<{ date: string; score: number; healthPct: number }[]> =>
    ipcRenderer.invoke('get-project-history'),

  getProjectHistoryByDay: (): Promise<{ date: string; score: number; healthPct: number }[]> =>
    ipcRenderer.invoke('get-project-history-day'),

  getSnapshotDetail: (date: string): Promise<any> =>
    ipcRenderer.invoke('get-snapshot-detail', date),

  getSnapshotDetailForDay: (day: string): Promise<any> =>
    ipcRenderer.invoke('get-snapshot-detail-for-day', day),

  // ── Events ────────────────────────────────────────────────────────────────
  onScanComplete: (cb: () => void): void => {
    ipcRenderer.removeAllListeners('scan-complete');
    ipcRenderer.on('scan-complete', cb);
  },

  onEvent: (cb: (e: any) => void): void => {
    ipcRenderer.removeAllListeners('cortex-event');
    ipcRenderer.on('cortex-event', (_ipc, e) => cb(e));
  },

  onFocusFile: (cb: (filePath: string) => void): (() => void) => {
    const handler = (_ipc: any, filePath: string) => cb(filePath);
    ipcRenderer.on('focus-file', handler);
    return () => ipcRenderer.removeListener('focus-file', handler);
  },

  onFullscreenChange: (cb: (isFullscreen: boolean) => void): (() => void) => {
    const handler = (_ipc: any, value: boolean) => cb(value);
    ipcRenderer.on('fullscreen-change', handler);
    return () => ipcRenderer.removeListener('fullscreen-change', handler);
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: (): Promise<any> =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (s: any): Promise<void> =>
    ipcRenderer.invoke('save-settings', s),

  // ── Projets ──────────────────────────────────────────────────────
  getProjects:   (): Promise<{ path: string; name: string; addedAt: string }[]> =>
    ipcRenderer.invoke('get-projects'),

  addProject:    (): Promise<{ path: string; name: string; addedAt: string }[] | null> =>
    ipcRenderer.invoke('add-project'),

  removeProject: (projectPath: string): Promise<{ path: string; name: string; addedAt: string }[]> =>
    ipcRenderer.invoke('remove-project', projectPath),

  switchProject: (projectPath: string): Promise<string> =>
    ipcRenderer.invoke('switch-project', projectPath),

  getProjectsHealth: (): Promise<{ path: string; avgScore: number | null }[]> =>
    ipcRenderer.invoke('get-projects-health'),

  // ── Export ────────────────────────────────────────────────────────────────
  exportReport: (): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke('export-report'),

  ignoreFile:     (filePath: string): Promise<string[]> =>
    ipcRenderer.invoke('ignore-file', filePath),

  unignoreFile:   (filePath: string): Promise<string[]> =>
    ipcRenderer.invoke('unignore-file', filePath),

  getIgnoredFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('get-ignored-files'),

  excludeFile:     (filePath: string): Promise<string[]> =>
    ipcRenderer.invoke('exclude-file', filePath),

  includeFile:     (filePath: string): Promise<string[]> =>
    ipcRenderer.invoke('include-file', filePath),

  getExcludedFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('get-excluded-files'),

  runScan: (): Promise<void> =>
    ipcRenderer.invoke('run-scan'),

  readFile: (filePath: string): Promise<{ ok: boolean; content: string }> =>
    ipcRenderer.invoke('read-file', filePath),

  runSecurityScan: (projectPath: string): Promise<any> =>
    ipcRenderer.invoke('run-security-scan', projectPath),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),

  getLastSecurityResult: (projectPath: string): Promise<any | null> =>
    ipcRenderer.invoke('get-last-security-result', projectPath),

  getPlatform: (): Promise<string> =>
    ipcRenderer.invoke('get-platform'),

  setWindowTransparency: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('set-window-transparency', enabled),

});
