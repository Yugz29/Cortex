import path from 'node:path';

export type AnalysisCoverageLevel = 'complete' | 'partial' | 'limited' | 'none';
export type CoverageStrength = 'strong' | 'partial' | 'approximate' | 'none';

export interface AnalysisCoverage {
    level:              AnalysisCoverageLevel;
    label:              string;
    language:           string;
    functionCoverage:   CoverageStrength;
    dependencyCoverage: CoverageStrength;
    metricCoverage:     CoverageStrength;
    reasons:            string[];
}

export interface ProjectAnalysisCoverageSummary {
    level:             AnalysisCoverageLevel;
    label:             string;
    analyzedScopeNote: string;
    totalFiles:        number;
    byLevel:           Record<AnalysisCoverageLevel, number>;
    byLanguage:        Record<string, number>;
    languages:         string[];
    reasons:           string[];
}

const EMPTY_LEVEL_COUNTS: Record<AnalysisCoverageLevel, number> = {
    complete: 0,
    partial:  0,
    limited:  0,
    none:     0,
};

const LEVEL_LABELS: Record<AnalysisCoverageLevel, string> = {
    complete: 'Analyse complète',
    partial:  'Analyse partielle',
    limited:  'Analyse limitée',
    none:     'Non analysé',
};

function cloneLevelCounts(): Record<AnalysisCoverageLevel, number> {
    return { ...EMPTY_LEVEL_COUNTS };
}

function coverage(
    level: AnalysisCoverageLevel,
    label: string,
    language: string,
    functionCoverage: CoverageStrength,
    dependencyCoverage: CoverageStrength,
    metricCoverage: CoverageStrength,
    reasons: string[],
): AnalysisCoverage {
    return { level, label, language, functionCoverage, dependencyCoverage, metricCoverage, reasons };
}

export function getAnalysisCoverageForExtension(extOrFilePath: string): AnalysisCoverage {
    const ext = extOrFilePath.startsWith('.')
        ? extOrFilePath.toLowerCase()
        : path.extname(extOrFilePath).toLowerCase();

    if (['.ts', '.js', '.mjs', '.cjs'].includes(ext)) {
        return coverage(
            'complete',
            'Analyse complète',
            ext === '.ts' ? 'typescript' : 'javascript',
            'strong',
            'strong',
            'strong',
            ['Fonctions, métriques et dépendances internes sont analysées.'],
        );
    }

    if (['.tsx', '.jsx'].includes(ext)) {
        return coverage(
            'complete',
            'Analyse complète',
            ext === '.tsx' ? 'typescript' : 'javascript',
            'strong',
            'strong',
            'strong',
            ['Fonctions, métriques et dépendances internes sont analysées.', 'Les composants JSX peuvent augmenter certains signaux de complexité.'],
        );
    }

    if (ext === '.py') {
        return coverage(
            'partial',
            'Analyse partielle',
            'python',
            'strong',
            'partial',
            'strong',
            ['Les métriques Python sont solides.', 'Le graphe couvre les imports internes résolus, mais pas tous les environnements ou packages.'],
        );
    }

    if (ext === '.swift') {
        return coverage(
            'partial',
            'Analyse partielle',
            'swift',
            'partial',
            'approximate',
            'approximate',
            ['Les fonctions et propriétés SwiftUI importantes sont analysées.', 'Le graphe Swift repose sur des références de types locales, sans lecture Xcode/SPM.'],
        );
    }

    return coverage(
        'none',
        'Non analysé',
        'unknown',
        'none',
        'none',
        'none',
        ['Cette extension n’est pas analysée par Cortex.'],
    );
}

export function getAnalysisCoverageForLanguage(language: string, filePath?: string): AnalysisCoverage {
    if (filePath) return getAnalysisCoverageForExtension(filePath);

    switch (language) {
        case 'typescript':
            return coverage('complete', 'Analyse complète', 'typescript', 'strong', 'strong', 'strong', ['Fonctions, métriques et dépendances internes sont analysées.']);
        case 'javascript':
            return coverage('complete', 'Analyse complète', 'javascript', 'strong', 'strong', 'strong', ['Fonctions, métriques et dépendances internes sont analysées.']);
        case 'python':
            return getAnalysisCoverageForExtension('.py');
        case 'swift':
            return getAnalysisCoverageForExtension('.swift');
        default:
            return getAnalysisCoverageForExtension('');
    }
}

export function summarizeProjectAnalysisCoverage(files: { filePath: string; language?: string }[]): ProjectAnalysisCoverageSummary {
    const byLevel = cloneLevelCounts();
    const byLanguage: Record<string, number> = {};
    const reasons = new Set<string>();

    for (const file of files) {
        const c = getAnalysisCoverageForLanguage(file.language ?? 'unknown', file.filePath);
        byLevel[c.level]++;
        byLanguage[c.language] = (byLanguage[c.language] ?? 0) + 1;
        for (const reason of c.reasons) reasons.add(reason);
    }

    const totalFiles = files.length;
    const level: AnalysisCoverageLevel =
        totalFiles === 0 ? 'none'
            : byLevel.none === totalFiles ? 'none'
                : byLevel.partial > 0 || byLevel.limited > 0 || byLevel.none > 0 ? 'partial'
                    : 'complete';

    return {
        level,
        label: LEVEL_LABELS[level],
        analyzedScopeNote: 'Le score Cortex concerne le code analysé et ne doit pas être lu comme une vérité absolue sur tout le dépôt.',
        totalFiles,
        byLevel,
        byLanguage,
        languages: Object.keys(byLanguage).sort(),
        reasons: [...reasons],
    };
}
