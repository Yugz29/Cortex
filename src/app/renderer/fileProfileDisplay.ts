import { inferFileProfile, type FileProfile, type FileProfileInfo } from '../../cortex/diagnostics/fileProfile';
import type { Locale } from './i18n';
import type { Scan } from './types';

const KNOWN_PROFILES: ReadonlySet<FileProfile> = new Set([
  'orchestration',
  'entrypoint',
  'parser',
  'decision_table',
  'renderer_component',
  'report_builder',
  'security_scanner',
  'dependency_audit',
  'change_analysis',
  'summary',
  'graph_layout',
  'formatter',
  'validation_contract',
  'state_management',
  'fixture_mock',
  'data_access',
  'utility',
  'routing',
  'controller',
  'service',
  'data_model',
  'configuration',
  'test',
  'script',
  'style',
  'documentation',
  'unknown',
]);

function isKnownProfile(profile: string | undefined): profile is FileProfile {
  return profile !== undefined && KNOWN_PROFILES.has(profile as FileProfile);
}

const FR_PROFILE_DISPLAY: Record<Exclude<FileProfile, 'unknown'>, Pick<FileProfileInfo, 'label' | 'description'>> = {
  orchestration: {
    label:       'Orchestration',
    description: 'Les fichiers d’orchestration coordonnent plusieurs flux et peuvent être denses même lorsque cette densité est intentionnelle.',
  },
  entrypoint: {
    label:       'Point d’entrée',
    description: 'Les points d’entrée câblent le démarrage de l’application et l’intégration à la plateforme.',
  },
  parser: {
    label:       'Parseur',
    description: 'La logique de parsing peut naturellement contenir de nombreuses branches pour gérer la syntaxe et les cas limites.',
  },
  decision_table: {
    label:       'Table de décision',
    description: 'La logique de classification peut contenir de nombreuses branches explicites par conception.',
  },
  renderer_component: {
    label:       'Composant d’interface',
    description: 'Les composants d’interface peuvent accumuler état, conditions d’affichage et gestionnaires d’événements.',
  },
  report_builder: {
    label:       'Générateur de rapport',
    description: 'La génération de rapport mélange souvent formatage, regroupement et texte explicatif.',
  },
  security_scanner: {
    label:       'Scanner de sécurité',
    description: 'Les scanners de sécurité contiennent souvent des règles de détection et une logique de correspondance prudente.',
  },
  dependency_audit: {
    label:       'Audit des dépendances',
    description: 'L’audit de dépendances coordonne la découverte des paquets, la sortie d’outils externes et les données d’avis de sécurité.',
  },
  change_analysis: {
    label:       'Analyse des changements',
    description: 'L’analyse Git/churn regroupe souvent le parsing des logs, les commits et les métriques de changement.',
  },
  summary: {
    label:       'Résumé',
    description: 'Les fichiers de résumé condensent état, métriques ou événements en vues courtes pour les lecteurs.',
  },
  graph_layout: {
    label:       'Graphe/layout',
    description: 'Les fichiers de graphe et de layout modélisent souvent relations, positions ou structure de dépendances.',
  },
  formatter: {
    label:       'Formatage',
    description: 'Les fichiers de formatage et d’affichage préparent libellés, messages ou valeurs pour la présentation.',
  },
  validation_contract: {
    label:       'Validation/contrat',
    description: 'Les fichiers de validation et de contrat définissent formes acceptées, contraintes ou attentes d’API.',
  },
  state_management: {
    label:       'Gestion d’état',
    description: 'Les fichiers de gestion d’état coordonnent stores, reducers ou transitions de l’état applicatif.',
  },
  fixture_mock: {
    label:       'Fixture/mock',
    description: 'Les fixtures et mocks fournissent des données d’exemple ou des substituts pour les tests et workflows locaux.',
  },
  data_access: {
    label:       'Accès aux données',
    description: 'Les modules de persistance regroupent souvent schéma, requêtes et logique liée aux migrations.',
  },
  utility: {
    label:       'Utilitaire',
    description: 'Les modules utilitaires servent de support partagé ; leur centralité seule n’est pas un diagnostic.',
  },
  routing: {
    label:       'Routage',
    description: 'Les fichiers de routage associent URLs, écrans ou messages à des gestionnaires et peuvent être centraux par conception.',
  },
  controller: {
    label:       'Contrôleur',
    description: 'Les contrôleurs traduisent souvent des requêtes externes en actions applicatives.',
  },
  service: {
    label:       'Service',
    description: 'Les services regroupent généralement des workflows métier et de la coordination autour d’un domaine.',
  },
  data_model: {
    label:       'Modèle de données',
    description: 'Les fichiers de modèles et schémas définissent des formes de données et des règles de validation partagées.',
  },
  configuration: {
    label:       'Configuration',
    description: 'Les fichiers de configuration câblent les outils, les environnements et le comportement global du projet.',
  },
  test: {
    label:       'Test',
    description: 'Les tests décrivent le comportement attendu et peuvent contenir préparation, fixtures et assertions.',
  },
  script: {
    label:       'Script',
    description: 'Les scripts automatisent souvent des workflows locaux et peuvent mélanger orchestration et tâches ponctuelles.',
  },
  style: {
    label:       'Style',
    description: 'Les fichiers de style définissent les règles de présentation plutôt que le flux de contrôle applicatif.',
  },
  documentation: {
    label:       'Documentation',
    description: 'Les fichiers de documentation expliquent le comportement, l’usage ou les décisions du projet pour les lecteurs humains.',
  },
};

function localizeFileProfile(profile: FileProfileInfo, locale: Locale): FileProfileInfo {
  if (locale !== 'fr' || profile.profile === 'unknown') return profile;

  const translated = FR_PROFILE_DISPLAY[profile.profile];
  return {
    profile:     profile.profile,
    label:       translated.label,
    description: translated.description,
  };
}

export function getScanFileProfile(
  scan: Pick<Scan, 'filePath' | 'profile' | 'profileLabel' | 'profileDescription'>,
  locale: Locale = 'en',
): FileProfileInfo {
  const inferred = inferFileProfile(scan.filePath);

  if (!isKnownProfile(scan.profile) || scan.profile === 'unknown') {
    return localizeFileProfile(inferred, locale);
  }

  return localizeFileProfile({
    profile:     scan.profile,
    label:       scan.profileLabel ?? inferred.label,
    description: scan.profileDescription ?? inferred.description,
  }, locale);
}

export function shouldShowScanFileProfile(profile: FileProfileInfo): boolean {
  return profile.profile !== 'unknown';
}
