import type { TranslationKey } from './i18n';
import type { Scan } from './types';

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function topMetric(s: Scan, t: T): { label: string; value: string; explain: string } {
  const candidates = [
    { score: s.churnScore,                    label: t('metric.highChurn'),      value: `${s.rawChurn} commits/30d`,       explain: t('explain.highChurn') },
    { score: s.complexityScore,               label: t('metric.highComplexity'), value: `cx ${s.rawComplexity}`,           explain: t('explain.highComplexity') },
    { score: s.cognitiveComplexityScore ?? 0, label: t('metric.hardToRead'),     value: `cog ${s.rawCognitiveComplexity}`, explain: t('explain.hardToRead') },
    { score: s.functionSizeScore,             label: t('metric.largeFunctions'), value: `${s.rawFunctionSize} lines`,      explain: t('explain.largeFunctions') },
    { score: s.depthScore,                    label: t('metric.deepNesting'),     value: `depth ${s.rawDepth}`,             explain: t('explain.deepNesting') },
    { score: s.fanIn > 0 ? Math.min(100, s.fanIn * 7) : 0, label: t('metric.widelyImported'), value: `${s.fanIn} ${t('overview.dependents')}`, explain: t('explain.widelyImported') },
  ].sort((a, b) => b.score - a.score);
  return candidates[0]!;
}

export function formatPressureImproving(count: number, t: T): string {
  return t(count > 1 ? 'summary.pressureImprovingMulti' : 'summary.pressureImprovingSingle', { n: count });
}

export function formatPressureDegrading(count: number, t: T): string {
  return t(count > 1 ? 'summary.pressureDegradingMulti' : 'summary.pressureDegradingSingle', { n: count });
}

function formatFilesImproving(count: number, t: T): string {
  return t(count > 1 ? 'summary.filesImprovingMulti' : 'summary.filesImprovingSingle', { n: count });
}

export function generateSummary(scans: Scan[], critical: Scan[], stressed: Scan[], avgScore: number, t: T): string {
  if (!scans.length) return t('summary.noModules');

  if (critical.length === 0 && stressed.length === 0) {
    const improving = scans.filter(s => s.trend === '↓').length;
    const allHealthy = t(scans.length > 1 ? 'summary.allHealthyMulti' : 'summary.allHealthySingle', { n: scans.length });
    if (improving > scans.length * 0.3) {
      return [allHealthy, formatFilesImproving(improving, t)].join('\n');
    }
    return allHealthy;
  }

  const parts: string[] = [];

  if (critical.length > 0) {
    const top = critical[0]!;
    const m   = topMetric(top, t);
    const key = critical.length > 1 ? 'summary.highPressureMulti' : 'summary.highPressureSingle';
    parts.push(t(key, { n: critical.length }));
    parts.push(t('summary.topSignal', { file: top.filePath.split('/').pop() ?? '', metric: m.label.toLowerCase() }));
  }

  if (stressed.length > 0) {
    const degrading = stressed.filter(s => s.trend === '↑');
    const improving = stressed.filter(s => s.trend === '↓');
    if (degrading.length > 0) {
      parts.push(formatPressureDegrading(degrading.length, t));
    } else if (improving.length > 0) {
      parts.push(formatPressureImproving(improving.length, t));
    } else {
      parts.push(t(stressed.length > 1 ? 'summary.stressedStableMulti' : 'summary.stressedStableSingle', { n: stressed.length }));
    }
  }

  if (avgScore >= 40)      parts.push(t('summary.healthDegraded'));
  else if (avgScore >= 20) parts.push(t('summary.healthModerate'));

  return parts.join('\n');
}
