// ── CORTEX UTILS & CONSTANTS ─────────────────────────────────────────────────

import type { Scan } from './types';

// ── COLORS ────────────────────────────────────────────────────────────────────

// Couleur adaptée au thème via CSS variables — fonctionne dans les styles inline
export function scoreColor(score: number): string {
  return score >= 50 ? 'var(--red)' : score >= 20 ? 'var(--orange)' : 'var(--green)';
}

// hex pour SVG attributes (stroke=, fill=) qui n'acceptent pas var()
export function scoreColorHex(score: number): string {
  return score >= 50 ? '#ff453a' : score >= 20 ? '#ff9f0a' : '#34c759';
}

// ── STATUS — source de vérité unique ────────────────────────────────────────
//
// Règle simple basée sur le score moyen (0-100) :
//   >= 50 → High pressure (rouge)
//   >= 20 → Elevated      (orange)
//   <  20 → Low pressure  (vert)
//
// Utilisée partout : HealthPill, CortexView, OverviewView, ProjectSwitcher.

export interface HealthStatus {
  label:    'High pressure' | 'Elevated' | 'Low pressure' | 'Observing';
  colorHex: string;   // pour SVG attributes, boxShadow, etc.
  colorVar: string;   // pour inline styles (var(--red) etc.)
}

export function projectHealthStatus(avgScore: number | null): HealthStatus {
  if (avgScore === null) return { label: 'Observing', colorHex: '#636366', colorVar: 'var(--text-muted)' };
  if (avgScore >= 50)    return { label: 'High pressure', colorHex: '#ff453a', colorVar: 'var(--red)'    };
  if (avgScore >= 20)    return { label: 'Elevated',      colorHex: '#ff9f0a', colorVar: 'var(--orange)' };
  return                        { label: 'Low pressure',  colorHex: '#34c759', colorVar: 'var(--green)'  };
}

/** Calcule le score moyen d'un tableau de scans (0 si vide). */
export function avgRiskScore(scans: Scan[]): number {
  if (!scans.length) return 0;
  return scans.reduce((a, s) => a + s.globalScore, 0) / scans.length;
}





// ── LAYER CLASSIFICATION ──────────────────────────────────────────────────────
//
// Table de règles ordonnées — une règle = un prédicat + un résultat.
// Plus lisible et moins complexe cognitivement qu'une cascade if/else.
// Ordre : spécifique → général. La première règle qui matche l'emporte.

export type Layer = 'ui' | 'api' | 'core' | 'db' | 'config';

// Noms de fichiers qui indiquent CORE indépendamment de leur dossier
// Note : 'index' exclu ici — son layer dépend du dossier (preload/index.ts = config)
const CORE_FILE_NAMES = /^(types|utils|constants|helpers|i18n|theme)\.(ts|js|tsx|jsx)$/;

// Suffixes de chemin qui indiquent un fichier de logique pure même dans /renderer/
const CORE_PATH_SUFFIXES = ['/graphlayout.ts', '/graphlayout.js'];

// Règles path → layer, testées dans l'ordre
const LAYER_RULES: [RegExp | string, Layer][] = [
  // Core — partagé ou hooks
  ['/hooks/',        'core'],
  // Config — preload Electron (avant /renderer/ pour éviter que index.ts soit ui)
  ['preload',        'config'],
  // DB — persistance
  ['/database/',     'db'],
  ['/db/',           'db'],
  ['/models/',       'db'],
  ['/repositories/', 'db'],
  ['/entities/',     'db'],
  ['migration',      'db'],
  ['schema',         'db'],
  // API — réseau, services
  ['/api/',          'api'],
  ['/routes/',       'api'],
  ['/socket',        'api'],
  ['/handlers/',     'api'],
  ['/controllers/',  'api'],
  ['/endpoints/',    'api'],
  ['/services/',     'api'],
  ['/service/',      'api'],
  ['/requests/',     'api'],
  ['/http/',         'api'],
  ['/fetch/',        'api'],
  // Config — réglages, env
  ['config',         'config'],
  ['settings',       'config'],
  ['/env/',          'config'],
  // UI — composants visuels
  ['/components/',   'ui'],
  ['/pages/',        'ui'],
  ['/views/',        'ui'],
  ['/screens/',      'ui'],
  ['/layouts/',      'ui'],
  ['/templates/',    'ui'],
  ['/renderer/',     'ui'],
  ['/ui/',           'ui'],
];

export function classifyLayer(filePath: string): Layer {
  const p    = filePath.toLowerCase();
  const file = p.split('/').pop() ?? '';

  // Fichiers partagés connus → core (prioritaire sur le dossier)
  if (CORE_FILE_NAMES.test(file)) return 'core';

  // Fichiers de logique pure dans /renderer/ → core même si dans un dossier UI
  if (CORE_PATH_SUFFIXES.some(s => p.endsWith(s))) return 'core';

  // Application des règles en ordre
  for (const [pattern, layer] of LAYER_RULES) {
    if (p.includes(pattern as string)) return layer;
  }

  return 'core';
}

export const LAYER_LABELS: Record<Layer, string> = {
  ui: 'UI', api: 'API', core: 'CORE', db: 'DATABASE', config: 'CONFIG',
};

export const LAYER_COLORS: Record<Layer, string> = {
  ui: '#4a9eff', api: '#f97316', core: '#a0a0a8', db: '#22c55e', config: '#8b5cf6',
};

export const LAYER_ORDER: Layer[] = ['ui', 'api', 'core', 'db', 'config'];

