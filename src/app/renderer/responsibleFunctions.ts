import type { FunctionDetail, Scan } from './types';

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

export interface ResponsibleFunctionItem {
  fn: FunctionDetail;
  role: ResponsibleFunctionRole;
  metricKey: FunctionMetricKey;
  metricValue: number;
  startLine: number;
  endLine: number;
  isDominantSignal: boolean;
}

export interface ResponsibleFunctions {
  largestFunction: FunctionDetail | null;
  mostCyclomatic: FunctionDetail | null;
  mostCognitive: FunctionDetail | null;
  deepestFunction: FunctionDetail | null;
  mostParams: FunctionDetail | null;
  dominantSignalFunction: FunctionDetail | null;
  dominantSignalIsWholeFile: boolean;
  items: ResponsibleFunctionItem[];
}

type FunctionSlot =
  | 'mostCyclomatic'
  | 'mostCognitive'
  | 'largestFunction'
  | 'deepestFunction'
  | 'mostParams';

function endLine(fn: FunctionDetail): number {
  return fn.start_line + fn.line_count - 1;
}

function functionKey(fn: FunctionDetail): string {
  return `${fn.name}:${fn.start_line}:${fn.line_count}`;
}

function numeric(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function maxBy(functions: FunctionDetail[], metric: FunctionMetricKey): FunctionDetail | null {
  if (functions.length === 0) return null;

  return functions.reduce<FunctionDetail | null>((best, fn) => {
    if (!best) return fn;
    return numeric(fn[metric]) > numeric(best[metric]) ? fn : best;
  }, null);
}

function maxByExcluding(functions: FunctionDetail[], metric: FunctionMetricKey, excluded: Set<string>): FunctionDetail | null {
  return maxBy(functions.filter(fn => !excluded.has(functionKey(fn))), metric);
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

function itemFor(fn: FunctionDetail, role: ResponsibleFunctionRole, metricKey: FunctionMetricKey, isDominantSignal: boolean): ResponsibleFunctionItem {
  return {
    fn,
    role,
    metricKey,
    metricValue: numeric(fn[metricKey]),
    startLine: fn.start_line,
    endLine: endLine(fn),
    isDominantSignal,
  };
}

export function selectResponsibleFunctions(
  scan: Pick<Scan, 'filePath'>,
  functions: FunctionDetail[],
  dominantSignal?: string | null,
): ResponsibleFunctions {
  void scan;

  const namedFunctions = functions.filter(fn => fn.name !== 'anonymous');
  const mostCyclomatic = maxBy(namedFunctions, 'cyclomatic_complexity');
  const mostCognitive = maxBy(namedFunctions, 'cognitive_complexity');
  const largestFunction = maxBy(namedFunctions, 'line_count');
  const deepestFunction = maxBy(namedFunctions, 'max_depth');
  const mostParams = maxBy(namedFunctions, 'parameter_count');

  const slots: Record<FunctionSlot, FunctionDetail | null> = {
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

  const seen = new Set<string>();
  const items: ResponsibleFunctionItem[] = [];

  const addItem = (fn: FunctionDetail | null, role: ResponsibleFunctionRole, metricKey: FunctionMetricKey, dominant: boolean): void => {
    if (!fn || items.length >= 4) return;
    const key = functionKey(fn);
    if (seen.has(key)) return;
    seen.add(key);
    items.push(itemFor(fn, role, metricKey, dominant));
  };

  if (dominantSignalFunction) {
    const dominantMetric = slotForSignal === 'mostCyclomatic' ? 'cyclomatic_complexity'
      : slotForSignal === 'mostCognitive' ? 'cognitive_complexity'
        : slotForSignal === 'largestFunction' ? 'line_count'
          : slotForSignal === 'deepestFunction' ? 'max_depth'
            : 'parameter_count';
    addItem(dominantSignalFunction, 'dominant', dominantMetric, true);
  }

  addItem(maxByExcluding(namedFunctions, 'cognitive_complexity', seen), 'cognitive', 'cognitive_complexity', false);
  addItem(maxByExcluding(namedFunctions, 'cyclomatic_complexity', seen), 'cyclomatic', 'cyclomatic_complexity', false);
  addItem(maxByExcluding(namedFunctions, 'line_count', seen), 'size', 'line_count', false);
  addItem(maxByExcluding(namedFunctions, 'max_depth', seen), 'depth', 'max_depth', false);
  addItem(maxByExcluding(namedFunctions, 'parameter_count', seen), 'params', 'parameter_count', false);

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
