import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface Project {
    path:    string;
    name:    string;
    addedAt: string;
}

export interface AppSettings {
    projects:          Project[];
    activeProjectPath: string;
    thresholds: {
        alert:   number;
        warning: number;
    };
    ignore:        string[];
    ignoredFiles:       string[];
    excludedFiles:      string[];
    locale:             'fr' | 'en';
    autoSecurityScan:   boolean;
    windowTransparency: boolean;
}

// ── DEFAULTS ──────────────────────────────────────────────────────────────────

const DEFAULTS: AppSettings = {
    projects:          [],
    activeProjectPath: '',
    thresholds: {
        alert:   50,
        warning: 20,
    },
    ignore:            ['node_modules', '.git', 'dist', 'build', 'out', '.vite', 'vendor', '__pycache__', 'assets', 'venv', '.venv', 'env', 'site-packages', 'migrations'],
    ignoredFiles:      [],
    excludedFiles:     [],
    locale:             'fr',
    autoSecurityScan:   true,
    windowTransparency: false,
};

// ── I/O ───────────────────────────────────────────────────────────────────────

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), 'cortex-settings.json');
}

export function loadSettings(): AppSettings {
    try {
        const raw = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')) as any;

        // Migration depuis l'ancien format Pulse
        if (!raw.projects) {
            const legacyPath = raw.projectPath || raw.activeProjectPath || '';
            const projects: Project[] = legacyPath
                ? [{ path: legacyPath, name: path.basename(legacyPath), addedAt: new Date().toISOString() }]
                : [];
            return {
                ...DEFAULTS,
                projects,
                activeProjectPath: legacyPath,
            };
        }

        const mergedIgnore = [...new Set([...DEFAULTS.ignore, ...(raw.ignore ?? [])])];
        return {
            ...DEFAULTS,
            ...raw,
            ignore:           mergedIgnore,
            ignoredFiles:     raw.ignoredFiles ?? [],
            excludedFiles:    raw.excludedFiles ?? [],
            locale:           raw.locale  === 'en'    ? 'en'    : 'fr',
            thresholds:       { ...DEFAULTS.thresholds, ...(raw.thresholds ?? {}) },
            autoSecurityScan:   raw.autoSecurityScan !== false,
            windowTransparency: raw.windowTransparency === true,
        };
    } catch {
        return { ...DEFAULTS };
    }
}

export function saveSettings(s: AppSettings): void {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf-8');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function addProject(settings: AppSettings, projectPath: string): AppSettings {
    const name    = path.basename(projectPath);
    const already = settings.projects.find(p => p.path === projectPath);
    if (already) {
        // Juste activer si déjà présent
        return { ...settings, activeProjectPath: projectPath };
    }
    const newProject: Project = { path: projectPath, name, addedAt: new Date().toISOString() };
    return {
        ...settings,
        projects:          [...settings.projects, newProject],
        activeProjectPath: projectPath,
    };
}

export function removeProject(settings: AppSettings, projectPath: string): AppSettings {
    const projects = settings.projects.filter(p => p.path !== projectPath);
    const active   = settings.activeProjectPath === projectPath
        ? (projects[0]?.path ?? '')
        : settings.activeProjectPath;
    return { ...settings, projects, activeProjectPath: active };
}

export function setActiveProject(settings: AppSettings, projectPath: string): AppSettings {
    return { ...settings, activeProjectPath: projectPath };
}

export function ignoreFile(settings: AppSettings, filePath: string): AppSettings {
    const already = settings.ignoredFiles.includes(filePath);
    if (already) return settings;
    return { ...settings, ignoredFiles: [...settings.ignoredFiles, filePath] };
}

export function unignoreFile(settings: AppSettings, filePath: string): AppSettings {
    return { ...settings, ignoredFiles: settings.ignoredFiles.filter(f => f !== filePath) };
}

export function excludeFile(settings: AppSettings, filePath: string): AppSettings {
    if (settings.excludedFiles.includes(filePath)) return settings;
    return { ...settings, excludedFiles: [...settings.excludedFiles, filePath] };
}

export function includeFile(settings: AppSettings, filePath: string): AppSettings {
    return { ...settings, excludedFiles: settings.excludedFiles.filter(f => f !== filePath) };
}
