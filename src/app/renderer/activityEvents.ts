import type { TranslationKey } from './i18n';

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export interface ActivityChange {
  name: string;
  delta: number;
}

export interface ActivityEventPayload {
  type: string;
  level?: string;
  message?: string;
  code?: string;
  file?: string;
  filePath?: string | null;
  projectName?: string;
  fileName?: string;
  fileCount?: number;
  count?: number;
  score?: number;
  changes?: ActivityChange[];
  extraCount?: number;
}

function formatChanges(changes: ActivityChange[] | undefined, extraCount: number | undefined, suffix: string, t: TFn): string {
  const visible = (changes ?? []).slice(0, 2).map(change => `${change.name} ${change.delta >= 0 ? '+' : ''}${change.delta.toFixed(0)}`);
  const extra = extraCount && extraCount > 0 ? [t('activity.more', { n: extraCount })] : [];
  return [...visible, ...extra, suffix].filter(Boolean).join(' · ');
}

export function formatActivityEvent(event: ActivityEventPayload, t: TFn): string {
  switch (event.code) {
    case 'analysis_triggered':
      return t('activity.analysisTriggered');
    case 'scan_unchanged':
      return t('activity.scanUnchanged', { n: event.fileCount ?? 0 });
    case 'critical_threshold_crossed':
      return t('activity.criticalThreshold', { file: event.fileName ?? event.file ?? '?' });
    case 'score_up':
      return formatChanges(event.changes, event.extraCount, t('activity.scoreUp'), t);
    case 'score_down':
      return formatChanges(event.changes, event.extraCount, t('activity.scoreDown'), t);
    case 'scan_degraded':
      return t('activity.scanDegraded', {
        files: event.fileCount ?? 0,
        count: event.count ?? 0,
        s: (event.count ?? 0) > 1 ? 's' : '',
      });
    case 'scan_improved':
      return t('activity.scanImproved', {
        files: event.fileCount ?? 0,
        count: event.count ?? 0,
        s: (event.count ?? 0) > 1 ? 's' : '',
      });
    case 'scan_stable':
      return t('activity.scanStable', { files: event.fileCount ?? 0 });
    case 'scan_failed':
      return t('activity.scanFailed');
    case 'project_switched':
      return event.projectName ? t('activity.projectSwitched', { project: event.projectName }) : '';
    case 'watching_project':
      return event.projectName ? t('activity.watchingProject', { project: event.projectName }) : '';
    default:
      return event.message ?? '';
  }
}
