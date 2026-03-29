// ── REFERENCE BASELINES ──────────────────────────────────────────────────────
//
// Percentiles de référence construits à partir de l'analyse de projets
// open source TypeScript/React/Python de taille moyenne (50–300 fichiers).
//
// Sources :
//   - Distributions de complexité cyclomatique (McCabe, SonarSource research)
//   - Métriques observées sur des projets GitHub populaires (React, Vite, ESLint, etc.)
//   - Ajustées empiriquement via les scans de Pulse sur lui-même
//
// Ces valeurs servent de PLANCHER pour les baselines projet.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectBaselines } from './riskScore.js';

// Référence générale — tous projets TypeScript/JS/Python confondus
export const REFERENCE_BASELINES: ProjectBaselines = {
    complexity:          { p25: 3,   p90: 12  },
    complexityMean:      { p25: 1.5, p90: 5   },
    cognitiveComplexity: { p25: 4,   p90: 30  },
    functionSize:        { p25: 15,  p90: 60  },
    functionSizeMean:    { p25: 8,   p90: 30  },
    depth:               { p25: 1,   p90: 4   },
    params:              { p25: 2,   p90: 5   },
    churn:               { p25: 1,   p90: 10  },
    fanIn:               { p25: 1,   p90: 10  },
};

// ── TYPES DE FICHIERS ─────────────────────────────────────────────────────────

export type FileType =
    | 'entrypoint'      // App.tsx, index.ts, main.ts — point d'entrée global
    | 'component-tsx'   // Composant React TSX — ternaires de style comptent comme branches
    | 'component-jsx'   // Composant React JSX
    | 'service'         // db.ts, scanner.ts, llm.ts — logique métier
    | 'parser'          // parser.ts, analyzer.ts — algorithmique dense
    | 'utility'         // utils.ts, helpers.ts — petites fonctions pures
    | 'config'          // types.ts, constants.ts, baselines — peu de logique
    | 'generic';        // tout le reste

// ── SURCHARGES PAR TYPE ───────────────────────────────────────────────────────
//
// TSX/JSX : les ternaires de style inline (`isSelected ? 'red' : 'blue'`)
// sont comptés comme branchements par ts-morph, ce qui gonfle artificiellement
// cx et cog. Les seuils sont relevés en conséquence pour éviter les faux positifs.
// Référence SonarQube : les règles TSX ignorent les ternaires purs de rendu.

const FILE_TYPE_OVERRIDES: Record<FileType, Partial<ProjectBaselines>> = {

    entrypoint: {
        complexity:          { p25: 8,  p90: 40  },
        cognitiveComplexity: { p25: 10, p90: 80  },
        functionSize:        { p25: 30, p90: 200 },
        functionSizeMean:    { p25: 15, p90: 80  },
    },

    // TSX : seuils relevés pour absorber les ternaires de style JSX.
    // Un composant bien écrit avec 20 ternaires de style peut avoir cx=25-30 — c'est normal.
    // On flag uniquement la vraie logique métier imbriquée (cx > 40, cog > 60).
    'component-tsx': {
        complexity:          { p25: 5,  p90: 40  },  // vs 3/12 générique
        complexityMean:      { p25: 3,  p90: 15  },
        cognitiveComplexity: { p25: 8,  p90: 60  },  // vs 4/30 générique
        functionSize:        { p25: 25, p90: 120 },  // fonctions de rendu naturellement grandes
        functionSizeMean:    { p25: 12, p90: 50  },
        depth:               { p25: 2,  p90: 5   },  // JSX imbrique naturellement plus
    },

    'component-jsx': {
        complexity:          { p25: 5,  p90: 35  },
        complexityMean:      { p25: 3,  p90: 12  },
        cognitiveComplexity: { p25: 8,  p90: 55  },
        functionSize:        { p25: 25, p90: 100 },
        functionSizeMean:    { p25: 12, p90: 45  },
        depth:               { p25: 2,  p90: 5   },
    },

    service: {
        complexity:          { p25: 4,  p90: 18  },
        cognitiveComplexity: { p25: 6,  p90: 40  },
        functionSize:        { p25: 20, p90: 80  },
        functionSizeMean:    { p25: 12, p90: 40  },
        churn:               { p25: 2,  p90: 15  },
    },

    parser: {
        complexity:          { p25: 6,  p90: 25  },
        cognitiveComplexity: { p25: 8,  p90: 50  },
        functionSize:        { p25: 25, p90: 100 },
        functionSizeMean:    { p25: 15, p90: 50  },
        depth:               { p25: 2,  p90: 6   },
    },

    utility: {
        complexity:          { p25: 1, p90: 6  },
        cognitiveComplexity: { p25: 1, p90: 12 },
        functionSize:        { p25: 8, p90: 30 },
        functionSizeMean:    { p25: 5, p90: 20 },
    },

    config: {
        complexity:          { p25: 1, p90: 6  },
        cognitiveComplexity: { p25: 1, p90: 10 },
        functionSize:        { p25: 5, p90: 40 },
        functionSizeMean:    { p25: 3, p90: 20 },
    },

    generic: {},
};

// ── MULTIPLICATEURS PAR LANGAGE ───────────────────────────────────────────────
//
// Ajustement appliqué AU NIVEAU DU SCORE (après normalisation 0-100),
// pas sur les seuils. Complémentaire aux surcharges par type.
//
// TSX/JSX : réduction de 20% sur complexity + cognitive car ts-morph
// ne distingue pas les ternaires de style des ternaires logiques.
// Python : la complexité cognitive est légèrement sous-évaluée (indentation
// approximative) — on réduit légèrement pour compenser la sur-détection.

export interface LanguageMultipliers {
    complexity:          number;  // [0.5 – 1.5]
    cognitiveComplexity: number;
    functionSize:        number;
    depth:               number;
    churn:               number;
    params:              number;
    fanIn:               number;
}

const NEUTRAL: LanguageMultipliers = {
    complexity: 1, cognitiveComplexity: 1, functionSize: 1,
    depth: 1, churn: 1, params: 1, fanIn: 1,
};

export const LANGUAGE_MULTIPLIERS: Record<string, LanguageMultipliers> = {
    // TSX : ternaires de style inline gonflent cx et cog artificiellement
    tsx: { ...NEUTRAL, complexity: 0.80, cognitiveComplexity: 0.75 },

    // JSX : même problème, légèrement atténué (moins de style inline en pratique)
    jsx: { ...NEUTRAL, complexity: 0.85, cognitiveComplexity: 0.80 },

    // Python : complexité cognitive via AST tree-sitter — plus d'approximation, multiplicateur neutre
    py:  NEUTRAL,

    // TypeScript/JavaScript purs : pas d'ajustement — les seuils absolus suffisent
    ts:  NEUTRAL,
    js:  NEUTRAL,
    mjs: NEUTRAL,
};

export function getLanguageMultipliers(filePath: string): LanguageMultipliers {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return LANGUAGE_MULTIPLIERS[ext] ?? NEUTRAL;
}

// ── DÉTECTION DU TYPE DE FICHIER ─────────────────────────────────────────────
//
// Ordre de priorité explicite — EXTENSION D'ABORD, puis contexte.
// Bug historique : le check dossier `shared → utility` écrasait l'extension
// `.tsx → component`, classifiant FileList.tsx, FilterBar.tsx etc. en `utility`.

const EXACT_NAMES: Record<string, FileType> = {
    'app.tsx': 'entrypoint', 'app.ts': 'entrypoint', 'app.jsx': 'entrypoint',
    'index.tsx': 'entrypoint', 'main.tsx': 'entrypoint',
    'index.ts': 'entrypoint', 'main.ts': 'entrypoint',
    'index.js': 'entrypoint', 'main.js': 'entrypoint',
    'types.ts': 'config', 'types.tsx': 'config',
    'constants.ts': 'config', 'settings.ts': 'config',
};

const NAME_FRAGMENTS: [string, FileType][] = [
    // config — données statiques
    ['baseline',   'config'],
    ['reference',  'config'],
    ['constants',  'config'],
    ['fixtures',   'config'],
    ['defaults',   'config'],
    ['thresholds', 'config'],
    // parser — algorithmique
    ['parser',     'parser'],
    ['lexer',      'parser'],
    ['analyzer',   'parser'],
    // service — logique métier
    ['service',    'service'],
    ['store',      'service'],
    ['engine',     'service'],
    ['manager',    'service'],
    ['handler',    'service'],
    ['controller', 'service'],
    ['scanner',    'service'],
    ['watcher',    'service'],
    ['socket',     'service'],
    ['churn',      'service'],
    // utility — fonctions pures
    ['util',       'utility'],
    ['helper',     'utility'],
    ['common',     'utility'],
    ['format',     'utility'],
    ['transform',  'utility'],
];

export function detectFileType(filePath: string): FileType {
    const name  = filePath.split('/').pop()?.toLowerCase() ?? '';
    const ext   = name.split('.').pop() ?? '';
    const parts = filePath.toLowerCase().split('/');

    // 1. Nom exact (entrypoints connus, types.ts, etc.)
    if (name in EXACT_NAMES) return EXACT_NAMES[name]!;

    // 2. Config par préfixe de nom
    if (name.startsWith('config') || name.endsWith('.config.ts') || name.endsWith('.config.js')) return 'config';

    // 3. Extension TSX/JSX — AVANT tout check de dossier
    //    Correction du bug : shared/FileList.tsx était classifié 'utility' au lieu de 'component-tsx'
    if (ext === 'tsx') return 'component-tsx';
    if (ext === 'jsx') return 'component-jsx';

    // 4. Fragments dans le nom (pour .ts, .js, .py)
    for (const [fragment, type] of NAME_FRAGMENTS) {
        if (name.includes(fragment)) return type;
    }

    // 5. Dossier partagé → utilitaire (uniquement pour les non-TSX/JSX)
    if (parts.includes('shared') || parts.includes('lib')) return 'utility';

    return 'generic';
}

// ── MERGE : baselines de référence + surcharge par type ──────────────────────

export function getReferenceBaselines(filePath: string): ProjectBaselines {
    const fileType  = detectFileType(filePath);
    const overrides = FILE_TYPE_OVERRIDES[fileType];
    const result    = { ...REFERENCE_BASELINES };

    for (const [key, value] of Object.entries(overrides)) {
        (result as any)[key] = value;
    }

    return result;
}
