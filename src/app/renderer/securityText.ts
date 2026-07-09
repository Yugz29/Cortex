import type { Category, SecurityFinding } from './types';
import type { TranslationKey } from './i18n';

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const FINDING_MESSAGE_KEYS: Partial<Record<string, TranslationKey>> = {
  'hardcoded-secret':     'security.patternHardcodedSecret',
  'private-key-block':   'security.patternPrivateKeyBlock',
  'connection-string':   'security.patternConnectionString',
  'math-random-security': 'security.patternMathRandom',
};

const CATEGORY_LABEL_KEYS: Record<Category, TranslationKey> = {
  secret:    'security.categorySecret',
  injection: 'security.categoryInjection',
  crypto:    'security.categoryCrypto',
  xss:       'security.categoryXss',
  misc:      'security.categoryMisc',
};

export function securityFindingMessage(finding: SecurityFinding, t: TFn): string {
  const key = FINDING_MESSAGE_KEYS[finding.rule];
  return key ? t(key) : finding.message;
}

export function securityCategoryLabel(category: Category, t: TFn): string {
  return t(CATEGORY_LABEL_KEYS[category]);
}
