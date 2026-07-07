export type DiagnosisFamily =
    | 'structural-load'
    | 'change-pressure'
    | 'dependency-impact'
    | 'balanced'
    | 'low-pressure';

export type FilePressureProfile =
    | 'hotspot-priority'
    | 'complex-but-stable'
    | 'volatile-but-simple'
    | 'high-impact'
    | 'low-pressure'
    | 'mixed-pressure';

export type DiagnosisMetric =
    | 'complexityScore'
    | 'cognitiveComplexityScore'
    | 'functionSizeScore'
    | 'depthScore'
    | 'paramScore'
    | 'churnScore'
    | 'hotspotScore'
    | 'fanIn'
    | 'fanOut'
    | 'trend';

export interface DiagnosisReason {
    label:  string;
    metric: DiagnosisMetric;
    score:  number;
}

export interface ScoreDiagnosis {
    family:         DiagnosisFamily;
    profile:        FilePressureProfile;
    label:          string;
    summary:        string;
    dominantSignal: DiagnosisReason | null;
    reasons:        DiagnosisReason[];
}

export interface ScoreDiagnosisInput {
    complexityScore?:          number;
    cognitiveComplexityScore?: number;
    functionSizeScore?:        number;
    depthScore?:               number;
    paramScore?:               number;
    churnScore?:               number;
    hotspotScore?:             number;
    fanIn?:                    number;
    fanOut?:                   number;
    trend?:                    '↑' | '↓' | '↔' | string;
    details?: {
        complexityScore?:          number;
        cognitiveComplexityScore?: number;
        functionSizeScore?:        number;
        depthScore?:               number;
        paramScore?:               number;
        churnScore?:               number;
        fanIn?:                    number;
        fanOut?:                   number;
    };
}

const STRONG = 60;
const MEDIUM = 30;

function num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, max = 100): number {
    return Math.min(max, Math.max(0, value));
}

function metric(input: ScoreDiagnosisInput, key: keyof NonNullable<ScoreDiagnosisInput['details']> & keyof ScoreDiagnosisInput): number {
    return num(input[key] ?? input.details?.[key]);
}

function fanScore(value: number): number {
    return clamp((value / 15) * 100);
}

function hotspotScore(value: number): number {
    return clamp((value / 150) * 100);
}

function trendScore(value: ScoreDiagnosisInput['trend']): number {
    return value === '↑' ? 45 : value === '↓' ? 0 : 0;
}

function topReasons(reasons: DiagnosisReason[]): DiagnosisReason[] {
    return reasons
        .filter(r => r.score >= MEDIUM)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
}

function familyLabel(family: DiagnosisFamily): string {
    switch (family) {
        case 'structural-load': return 'Charge structurelle élevée';
        case 'change-pressure': return 'Pression de changement';
        case 'dependency-impact': return 'Impact de dépendance';
        case 'balanced': return 'Pression mixte';
        case 'low-pressure': return 'Faible pression';
    }
}

function familySummary(family: DiagnosisFamily, profile: FilePressureProfile): string {
    if (profile === 'hotspot-priority') {
        return 'Ce fichier combine une charge structurelle notable et une activité récente élevée.';
    }
    if (profile === 'complex-but-stable') {
        return 'Ce fichier ressort surtout par sa structure, mais il ne semble pas très actif récemment.';
    }
    if (profile === 'volatile-but-simple') {
        return 'Ce fichier change souvent, mais ses signaux structurels restent limités.';
    }
    if (profile === 'high-impact') {
        return 'Ce fichier a un impact potentiel élevé car il est dépendu ou connecté à plusieurs fichiers.';
    }
    if (profile === 'low-pressure') {
        return 'Aucun signal notable ne ressort pour ce fichier.';
    }
    switch (family) {
        case 'structural-load':
            return 'Ce fichier ressort surtout à cause de sa complexité de lecture ou de sa taille.';
        case 'change-pressure':
            return 'Ce fichier ressort surtout à cause de son activité récente ou de sa tendance.';
        case 'dependency-impact':
            return 'Ce fichier ressort surtout à cause de sa position dans le graphe de dépendances.';
        case 'balanced':
            return 'Plusieurs signaux moyens contribuent à la pression de maintenance.';
        case 'low-pressure':
            return 'Aucun signal notable ne ressort pour ce fichier.';
    }
}

export function diagnoseScore(input: ScoreDiagnosisInput): ScoreDiagnosis {
    const reasons: DiagnosisReason[] = [
        { label: 'Complexité cyclomatique élevée', metric: 'complexityScore', score: metric(input, 'complexityScore') },
        { label: 'Complexité cognitive élevée', metric: 'cognitiveComplexityScore', score: metric(input, 'cognitiveComplexityScore') },
        { label: 'Fonction principale longue', metric: 'functionSizeScore', score: metric(input, 'functionSizeScore') },
        { label: 'Imbrication importante', metric: 'depthScore', score: metric(input, 'depthScore') },
        { label: 'Interface de fonction large', metric: 'paramScore', score: metric(input, 'paramScore') },
        { label: 'Churn récent élevé', metric: 'churnScore', score: metric(input, 'churnScore') },
        { label: 'Hotspot complexité × churn', metric: 'hotspotScore', score: hotspotScore(num(input.hotspotScore)) },
        { label: 'Nombreux fichiers dépendants', metric: 'fanIn', score: fanScore(num(input.fanIn ?? input.details?.fanIn)) },
        { label: 'Nombreuses dépendances sortantes', metric: 'fanOut', score: fanScore(num(input.fanOut ?? input.details?.fanOut)) },
        { label: 'Pression en hausse', metric: 'trend', score: trendScore(input.trend) },
    ];

    const selectedReasons = topReasons(reasons);
    const structuralScores = [
        metric(input, 'complexityScore'),
        metric(input, 'cognitiveComplexityScore'),
        metric(input, 'functionSizeScore'),
        metric(input, 'depthScore'),
        metric(input, 'paramScore'),
    ];
    const changeScores = [
        metric(input, 'churnScore'),
        hotspotScore(num(input.hotspotScore)),
        trendScore(input.trend),
    ];
    const dependencyScores = [
        fanScore(num(input.fanIn ?? input.details?.fanIn)),
        fanScore(num(input.fanOut ?? input.details?.fanOut)),
    ];

    const structural = Math.max(...structuralScores);
    const change = Math.max(...changeScores);
    const dependency = Math.max(...dependencyScores);
    const mediumFamilies = [structural, change, dependency].filter(s => s >= MEDIUM).length;

    let family: DiagnosisFamily;
    if (selectedReasons.length === 0) family = 'low-pressure';
    else if (mediumFamilies > 1 && Math.max(structural, change, dependency) < STRONG) family = 'balanced';
    else if (structural >= change && structural >= dependency) family = 'structural-load';
    else if (change >= dependency) family = 'change-pressure';
    else family = 'dependency-impact';

    let profile: FilePressureProfile;
    if (selectedReasons.length === 0) profile = 'low-pressure';
    else if (structural >= STRONG && change >= STRONG) profile = 'hotspot-priority';
    else if (structural >= STRONG && change < MEDIUM) profile = 'complex-but-stable';
    else if (change >= STRONG && structural < MEDIUM) profile = 'volatile-but-simple';
    else if (dependency >= STRONG && structural < STRONG && change < STRONG) profile = 'high-impact';
    else profile = 'mixed-pressure';

    if (profile === 'high-impact') family = 'dependency-impact';
    if (profile === 'low-pressure') family = 'low-pressure';

    const dominantSignal = selectedReasons[0] ?? null;

    return {
        family,
        profile,
        label: familyLabel(family),
        summary: familySummary(family, profile),
        dominantSignal,
        reasons: selectedReasons,
    };
}
