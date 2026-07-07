export type FunctionDiagnosisFamily =
    | 'readability-load'
    | 'size-load'
    | 'signature-load'
    | 'low-pressure';

export type FunctionPressureProfile =
    | 'hard-to-read'
    | 'long-function'
    | 'deeply-nested'
    | 'too-many-params'
    | 'low-pressure'
    | 'mixed-pressure';

export type FunctionDiagnosisMetric =
    | 'line_count'
    | 'cyclomatic_complexity'
    | 'cognitive_complexity'
    | 'parameter_count'
    | 'max_depth';

export interface FunctionDiagnosisReason {
    label:  string;
    metric: FunctionDiagnosisMetric;
    score:  number;
    value:  number;
}

export interface FunctionDiagnosis {
    priority: number;
    family:   FunctionDiagnosisFamily;
    profile:  FunctionPressureProfile;
    label:    string;
    summary:  string;
    reasons:  FunctionDiagnosisReason[];
}

export interface FunctionDiagnosisInput {
    line_count?:            number;
    cyclomatic_complexity?: number;
    cognitive_complexity?:  number;
    parameter_count?:       number;
    max_depth?:             number;
}

const MEDIUM = 30;
const STRONG = 60;

function num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampedScore(value: number, safe: number, danger: number): number {
    if (value <= safe) return 0;
    if (value >= danger) return 100;
    return ((value - safe) / (danger - safe)) * 100;
}

function topReasons(reasons: FunctionDiagnosisReason[]): FunctionDiagnosisReason[] {
    return reasons
        .filter(reason => reason.score >= MEDIUM)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

function profileLabel(profile: FunctionPressureProfile): string {
    switch (profile) {
        case 'hard-to-read': return 'Difficile à lire';
        case 'long-function': return 'Fonction longue';
        case 'deeply-nested': return 'Imbrication élevée';
        case 'too-many-params': return 'Signature large';
        case 'mixed-pressure': return 'Signaux mixtes';
        case 'low-pressure': return 'Faible pression';
    }
}

function profileSummary(profile: FunctionPressureProfile): string {
    switch (profile) {
        case 'hard-to-read':
            return 'Cette fonction demande une attention de lecture prioritaire.';
        case 'long-function':
            return 'Cette fonction est surtout notable par sa taille.';
        case 'deeply-nested':
            return 'Cette fonction est surtout notable par son niveau d’imbrication.';
        case 'too-many-params':
            return 'Cette fonction est surtout notable par le nombre de paramètres.';
        case 'mixed-pressure':
            return 'Plusieurs signaux rendent cette fonction intéressante à relire.';
        case 'low-pressure':
            return 'Aucun signal particulier ne ressort pour cette fonction.';
    }
}

export function diagnoseFunction(fn: FunctionDiagnosisInput): FunctionDiagnosis {
    const lineCount = num(fn.line_count);
    const cyclomatic = num(fn.cyclomatic_complexity);
    const cognitive = num(fn.cognitive_complexity);
    const params = num(fn.parameter_count);
    const depth = num(fn.max_depth);

    const reasons: FunctionDiagnosisReason[] = [
        {
            label: 'Complexité cognitive élevée',
            metric: 'cognitive_complexity',
            score: clampedScore(cognitive, 10, 35),
            value: cognitive,
        },
        {
            label: 'Complexité cyclomatique élevée',
            metric: 'cyclomatic_complexity',
            score: clampedScore(cyclomatic, 5, 15),
            value: cyclomatic,
        },
        {
            label: 'Imbrication importante',
            metric: 'max_depth',
            score: clampedScore(depth, 2, 6),
            value: depth,
        },
        {
            label: 'Fonction longue',
            metric: 'line_count',
            score: clampedScore(lineCount, 30, 120),
            value: lineCount,
        },
        {
            label: 'Nombre de paramètres élevé',
            metric: 'parameter_count',
            score: clampedScore(params, 3, 8),
            value: params,
        },
    ];

    const selectedReasons = topReasons(reasons);
    const readability = Math.max(reasons[0]!.score, reasons[1]!.score, reasons[2]!.score);
    const size = reasons[3]!.score;
    const signature = reasons[4]!.score;
    const priority = Math.max(readability, size, signature);

    let family: FunctionDiagnosisFamily;
    if (selectedReasons.length === 0) family = 'low-pressure';
    else if (readability >= size && readability >= signature) family = 'readability-load';
    else if (size >= signature) family = 'size-load';
    else family = 'signature-load';

    const strongFamilies = [readability, size, signature].filter(score => score >= STRONG).length;
    let profile: FunctionPressureProfile;
    if (selectedReasons.length === 0) profile = 'low-pressure';
    else if (strongFamilies > 1) profile = 'mixed-pressure';
    else if (reasons[2]!.score >= STRONG && reasons[2]!.score >= readability - 1) profile = 'deeply-nested';
    else if (readability >= STRONG) profile = 'hard-to-read';
    else if (size >= STRONG) profile = 'long-function';
    else if (signature >= STRONG) profile = 'too-many-params';
    else profile = 'mixed-pressure';

    if (profile === 'low-pressure') family = 'low-pressure';

    return {
        priority,
        family,
        profile,
        label: profileLabel(profile),
        summary: profileSummary(profile),
        reasons: selectedReasons,
    };
}
