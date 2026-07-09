export interface FunctionMetricInput {
    name:                  string;
    start_line:            number;
    line_count:            number;
    cyclomatic_complexity: number;
    cognitive_complexity:  number;
    parameter_count:       number;
    max_depth:             number;
}

export type ResponsibleFunctionRole =
    | 'dominant'
    | 'cyclomatic'
    | 'cognitive'
    | 'size'
    | 'depth'
    | 'params';

export type FunctionMetricKey =
    | 'cyclomatic_complexity'
    | 'cognitive_complexity'
    | 'line_count'
    | 'max_depth'
    | 'parameter_count';

export interface ResponsibleFunctionItem<TFunction extends FunctionMetricInput = FunctionMetricInput> {
    fn: TFunction;
    role: ResponsibleFunctionRole;
    metricKey: FunctionMetricKey;
    metricValue: number;
    reasons: ResponsibleFunctionReason[];
    startLine: number;
    endLine: number;
    isDominantSignal: boolean;
}

export interface ResponsibleFunctionReason {
    role: ResponsibleFunctionRole;
    metricKey: FunctionMetricKey;
    metricValue: number;
    isDominantSignal: boolean;
}

export interface ResponsibleFunctions<TFunction extends FunctionMetricInput = FunctionMetricInput> {
    largestFunction: TFunction | null;
    mostCyclomatic: TFunction | null;
    mostCognitive: TFunction | null;
    deepestFunction: TFunction | null;
    mostParams: TFunction | null;
    dominantSignalFunction: TFunction | null;
    dominantSignalIsWholeFile: boolean;
    items: ResponsibleFunctionItem<TFunction>[];
}

type FunctionSlot =
    | 'mostCyclomatic'
    | 'mostCognitive'
    | 'largestFunction'
    | 'deepestFunction'
    | 'mostParams';

function endLine(fn: FunctionMetricInput): number {
    return fn.start_line + fn.line_count - 1;
}

function functionKey(fn: FunctionMetricInput): string {
    return `${fn.name}:${fn.start_line}:${fn.line_count}`;
}

function numeric(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function maxBy<TFunction extends FunctionMetricInput>(functions: TFunction[], metric: FunctionMetricKey): TFunction | null {
    if (functions.length === 0) return null;

    return functions.reduce<TFunction | null>((best, fn) => {
        if (!best) return fn;
        return numeric(fn[metric]) > numeric(best[metric]) ? fn : best;
    }, null);
}

function dominantSlot(signal: string | null | undefined): FunctionSlot | 'whole-file' | null {
    switch (signal) {
        case 'complexity':
        case 'cyclomatic_complexity':
        case 'complexityScore':
            return 'mostCyclomatic';
        case 'cognitive_complexity':
        case 'cognitiveComplexityScore':
            return 'mostCognitive';
        case 'function_size':
        case 'functionSizeScore':
            return 'largestFunction';
        case 'depth':
        case 'depthScore':
            return 'deepestFunction';
        case 'params':
        case 'parameter_count':
        case 'paramScore':
            return 'mostParams';
        case 'churn':
        case 'churnScore':
        case 'fan_in':
        case 'fanIn':
        case 'fan_out':
        case 'fanOut':
        case 'hotspotScore':
        case 'trend':
            return 'whole-file';
        default:
            return null;
    }
}

function reasonFor(fn: FunctionMetricInput, role: ResponsibleFunctionRole, metricKey: FunctionMetricKey, isDominantSignal: boolean): ResponsibleFunctionReason {
    return {
        role,
        metricKey,
        metricValue: numeric(fn[metricKey]),
        isDominantSignal,
    };
}

function isRelevantReason(reason: ResponsibleFunctionReason): boolean {
    if (reason.isDominantSignal) return true;

    switch (reason.metricKey) {
        case 'cyclomatic_complexity':
            return reason.metricValue >= 10;
        case 'cognitive_complexity':
            return reason.metricValue >= 15;
        case 'line_count':
            return reason.metricValue >= 50;
        case 'max_depth':
            return reason.metricValue >= 3;
        case 'parameter_count':
            return reason.metricValue >= 5;
    }
}

function itemFor<TFunction extends FunctionMetricInput>(fn: TFunction, reason: ResponsibleFunctionReason): ResponsibleFunctionItem<TFunction> {
    return {
        fn,
        role: reason.role,
        metricKey: reason.metricKey,
        metricValue: reason.metricValue,
        reasons: [reason],
        startLine: fn.start_line,
        endLine: endLine(fn),
        isDominantSignal: reason.isDominantSignal,
    };
}

export function selectResponsibleFunctions<TFunction extends FunctionMetricInput>(
    functions: TFunction[],
    dominantSignal?: string | null,
): ResponsibleFunctions<TFunction> {
    const namedFunctions = functions.filter(fn => fn.name !== 'anonymous');
    const mostCyclomatic = maxBy(namedFunctions, 'cyclomatic_complexity');
    const mostCognitive = maxBy(namedFunctions, 'cognitive_complexity');
    const largestFunction = maxBy(namedFunctions, 'line_count');
    const deepestFunction = maxBy(namedFunctions, 'max_depth');
    const mostParams = maxBy(namedFunctions, 'parameter_count');

    const slots: Record<FunctionSlot, TFunction | null> = {
        mostCyclomatic,
        mostCognitive,
        largestFunction,
        deepestFunction,
        mostParams,
    };

    const slotForSignal = dominantSlot(dominantSignal);
    const dominantSignalFunction = slotForSignal && slotForSignal !== 'whole-file'
        ? slots[slotForSignal]
        : null;

    const itemByFunction = new Map<string, ResponsibleFunctionItem<TFunction>>();
    const items: ResponsibleFunctionItem<TFunction>[] = [];

    const addItem = (fn: TFunction | null, role: ResponsibleFunctionRole, metricKey: FunctionMetricKey, dominant: boolean): void => {
        if (!fn) return;
        const key = functionKey(fn);
        const reason = reasonFor(fn, role, metricKey, dominant);
        if (!isRelevantReason(reason)) return;
        const existing = itemByFunction.get(key);
        if (existing) {
            if (!existing.reasons.some(r => r.metricKey === metricKey)) existing.reasons.push(reason);
            if (dominant) existing.isDominantSignal = true;
            return;
        }
        if (items.length >= 4) return;
        const item = itemFor(fn, reason);
        itemByFunction.set(key, item);
        items.push(item);
    };

    if (dominantSignalFunction) {
        const dominantMetric = slotForSignal === 'mostCyclomatic' ? 'cyclomatic_complexity'
            : slotForSignal === 'mostCognitive' ? 'cognitive_complexity'
                : slotForSignal === 'largestFunction' ? 'line_count'
                    : slotForSignal === 'deepestFunction' ? 'max_depth'
                        : 'parameter_count';
        addItem(dominantSignalFunction, 'dominant', dominantMetric, true);
    }

    addItem(mostCognitive, 'cognitive', 'cognitive_complexity', false);
    addItem(mostCyclomatic, 'cyclomatic', 'cyclomatic_complexity', false);
    addItem(largestFunction, 'size', 'line_count', false);
    addItem(deepestFunction, 'depth', 'max_depth', false);
    addItem(mostParams, 'params', 'parameter_count', false);

    return {
        largestFunction,
        mostCyclomatic,
        mostCognitive,
        deepestFunction,
        mostParams,
        dominantSignalFunction,
        dominantSignalIsWholeFile: slotForSignal === 'whole-file',
        items,
    };
}
