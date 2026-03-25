"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // ── Scans & data ──────────────────────────────────────────────────────────
  getScans: () => electron.ipcRenderer.invoke("get-scans"),
  getEdges: () => electron.ipcRenderer.invoke("get-edges"),
  getFunctions: (filePath) => electron.ipcRenderer.invoke("get-functions", filePath),
  getScoreHistory: (filePath) => electron.ipcRenderer.invoke("get-score-history", filePath),
  // ── Project ───────────────────────────────────────────────────────────────
  getProjectPath: () => electron.ipcRenderer.invoke("get-project-path"),
  pickProject: () => electron.ipcRenderer.invoke("pick-project"),
  getProjectScoreHistory: () => electron.ipcRenderer.invoke("get-project-score-history"),
  getProjectHistory: () => electron.ipcRenderer.invoke("get-project-history"),
  getProjectHistoryByDay: () => electron.ipcRenderer.invoke("get-project-history-day"),
  // ── Events ────────────────────────────────────────────────────────────────
  onScanComplete: (cb) => {
    electron.ipcRenderer.removeAllListeners("scan-complete");
    electron.ipcRenderer.on("scan-complete", cb);
  },
  onEvent: (cb) => {
    electron.ipcRenderer.removeAllListeners("cortex-event");
    electron.ipcRenderer.on("cortex-event", (_ipc, e) => cb(e));
  },
  onFocusFile: (cb) => {
    const handler = (_ipc, filePath) => cb(filePath);
    electron.ipcRenderer.on("focus-file", handler);
    return () => electron.ipcRenderer.removeListener("focus-file", handler);
  },
  onFullscreenChange: (cb) => {
    const handler = (_ipc, value) => cb(value);
    electron.ipcRenderer.on("fullscreen-change", handler);
    return () => electron.ipcRenderer.removeListener("fullscreen-change", handler);
  },
  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => electron.ipcRenderer.invoke("save-settings", s),
  // ── Projets ──────────────────────────────────────────────────────
  getProjects: () => electron.ipcRenderer.invoke("get-projects"),
  addProject: () => electron.ipcRenderer.invoke("add-project"),
  removeProject: (projectPath) => electron.ipcRenderer.invoke("remove-project", projectPath),
  switchProject: (projectPath) => electron.ipcRenderer.invoke("switch-project", projectPath),
  getProjectsHealth: () => electron.ipcRenderer.invoke("get-projects-health"),
  // ── Export ────────────────────────────────────────────────────────────────
  exportReport: () => electron.ipcRenderer.invoke("export-report"),
  ignoreFile: (filePath) => electron.ipcRenderer.invoke("ignore-file", filePath),
  unignoreFile: (filePath) => electron.ipcRenderer.invoke("unignore-file", filePath),
  getIgnoredFiles: () => electron.ipcRenderer.invoke("get-ignored-files"),
  readFile: (filePath) => electron.ipcRenderer.invoke("read-file", filePath),
  runSecurityScan: (projectPath) => electron.ipcRenderer.invoke("run-security-scan", projectPath),
  openExternal: (url) => electron.ipcRenderer.invoke("open-external", url),
  getLastSecurityResult: (projectPath) => electron.ipcRenderer.invoke("get-last-security-result", projectPath)
});
