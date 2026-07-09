# Cortex

> Un moniteur local-first de qualité de code qui indique quels fichiers inspecter en priorité avant que la dette ne devienne un problème.

---

## Présentation

Cortex est une application desktop qui surveille un dépôt de code en temps réel. Elle observe les fichiers, analyse la complexité du code et l’activité Git, puis fait ressortir les fichiers à inspecter en priorité.

---

## Ce que fait Cortex

**Surveillance continue du projet**

Tant que l’application desktop est ouverte, Cortex détecte les changements de fichiers. À chaque sauvegarde, il peut relancer une analyse : complexité, taille des fonctions, profondeur d’imbrication, churn, couplage et dépendances.

**Score par fichier de 0 à 100**

Chaque fichier reçoit un score de risque de maintenance basé sur 7 métriques pondérées. Les fichiers sont classés et colorés : 🟢 sain · 🟡 sous pression · 🔴 critique.

**Adaptation au codebase**

Les seuils sont calibrés par type de fichier : un composant React n’est pas évalué comme un parser, et un fichier de configuration n’est pas évalué comme un service. Cortex utilise aussi les distributions propres au projet pour s’adapter à ce qui est normal dans ce codebase.

**Historique des scores**

Chaque scan est stocké. Il est possible de voir si un fichier s’améliore ou se dégrade dans le temps, et de suivre l’évolution globale de la santé du projet par scan ou par jour.

**Snapshots structurés du projet**

Après chaque analyse effective, Cortex écrit un snapshot JSON structuré du projet : scores, historique, couplages, tendances et couverture d’analyse. Ce snapshot sert de contexte de maintenance pour relire les parties analysées du codebase.

---

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **Watcher temps réel** | Surveille `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.swift` — avec debounce et exclusions |
| **Scan manuel** | Déclenche un rescan complet depuis la barre supérieure |
| **Analyse AST / structurelle** | TS/JS via ts-morph, Python via tree-sitter avec fallback, Swift via un analyseur pragmatique dédié — complexité cyclomatique, complexité cognitive, taille des fonctions, profondeur d’imbrication, nombre de paramètres |
| **Churn Git** | Fréquence de modification par fichier sur les 30 derniers jours |
| **Graphe de dépendances** | Fan-in et fan-out à partir des imports JS/TS/Python résolus, complétés par des références de types Swift locales |
| **Scoring adaptatif** | Seuils par type de fichier + baselines par percentiles du projet |
| **Multiplicateurs par langage** | Ajustements pour TSX/JSX afin de limiter les biais liés aux ternaires ou à la densité visuelle des composants |
| **Historique des scores** | Courbes de tendance par fichier et santé globale du projet — par scan ou par jour |
| **Détection de hotspots** | Fichiers combinant complexité et modifications fréquentes |
| **Multi-projets** | Passage d’un projet à l’autre sans redémarrer l’application |
| **Vue graphe** | Graphe basé sur les imports résolus et les références de types Swift — mode LAYERS et mode ALL LINKS ; zoom, déplacement, clic et focus au survol |
| **Scan sécurité** | Patterns locaux de revue sécurité + audit optionnel des dépendances Node.js via `npm audit` |
| **Fichiers ignorés** | Exclusion de fichiers du scoring depuis la sidebar, ou exclusion complète du scan depuis les réglages |
| **Préférences UI** | Largeur de la sidebar, hauteur du panneau d’activité, mode de graphe et granularité persistés entre les sessions |
| **Snapshot projet** | `cortex-snapshot.json` écrit après chaque scan appliqué — contexte de maintenance structuré avec couverture d’analyse |
| **Export** | Rapport Markdown + JSON généré depuis l’onglet Overview |
| **Lecteur de code** | Visualisation syntax-highlighted du code, ouverture directe sur une fonction, édition rapide via CodeMirror 6 et rescan instantané à la sauvegarde |
| **Arborescence fichiers** | Bascule entre liste plate et arbre de dossiers dans la sidebar, avec tri par score |
| **i18n** | Interface disponible en français et en anglais, configurable dans les réglages |

---

## Score de risque

Le score global d’un fichier est une somme pondérée de 7 métriques normalisées de 0 à 100 :

| Métrique | Poids | Ce que cela mesure |
|---|---:|---|
| Complexité cyclomatique (blend max + moyenne) | 28 % | Nombre de chemins d’exécution indépendants |
| Complexité cognitive | 19 % | Difficulté à lire et suivre le code |
| Taille des fonctions (blend max + moyenne) | 14 % | Taille de la plus grande fonction et taille moyenne |
| Profondeur d’imbrication | 14 % | Profondeur maximale des blocs imbriqués |
| Churn (commits / 30 jours) | 12 % | Fréquence de modification du fichier |
| Nombre de paramètres | 8 % | Nombre maximal de paramètres d’une fonction |
| Fan-in | 5 % | Nombre de fichiers qui dépendent de celui-ci |

Plages de score : **< 20** sain · **20–49** sous pression · **≥ 50** critique

Le score doit être lu comme un signal de priorisation pour la revue, pas comme une vérité absolue sur la qualité du code.

---

## Couverture d'analyse

| Langage | Couverture |
|---|---|
| TypeScript / JavaScript | Analyse structurelle et graphe d'imports internes solides pour `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | Analyse structurelle via tree-sitter avec fallback ; imports internes résolus partiellement selon la structure du projet, sans résolution complète d'environnement Python |
| Swift | Analyse par parsing pragmatique ; graphe basé sur les références de types locales, sans résolution complète Xcode/SPM |

La couverture exacte dépend de la structure du dépôt, des imports résolus et des fichiers exclus.

---

## Sécurité

L'écran Sécurité combine deux types de signaux :

- **Patterns locaux** : secrets potentiels, clés privées, chaînes de connexion avec identifiants, injections, XSS, crypto faible, HTTP clair, vérification SSL désactivée et `debugger` oublié.
- **Audit des dépendances** : exécution de `npm audit` pour les projets Node.js détectés. Cet audit nécessite un lockfile compatible, un accès réseau au registre npm et peut être partiel si certains sous-projets échouent ou ne sont pas auditables.

Ces résultats sont des signaux de revue. Cortex ne remplace pas un audit sécurité complet, un outil spécialisé comme Snyk, ni une revue manuelle.

---

## Contexte de maintenance

Après chaque analyse effective, Cortex écrit `cortex-snapshot.json`. Ce fichier contient :

- un résumé du projet : nombre total de fichiers, fichiers critiques / sous pression / sains, score moyen ;
- les scores par fichier avec métriques brutes, langage et date du dernier scan ;
- l’historique de santé du projet ;
- la carte de couplage : fichiers qui changent souvent ensemble ;
- un résumé de couverture d’analyse : parties entièrement, partiellement ou non analysées.

Cortex est utile comme **contexte de maintenance structuré**. Le snapshot capture l’état du code analysé, les fichiers qui ressortent, les tendances et les zones où une revue humaine est la plus utile.

L'export produit un contexte Markdown/JSON pour relire les hotspots, les tendances et les limites d'analyse.

Le score concerne le code analysé. Il ne doit pas être interprété comme un jugement complet sur tous les fichiers du dépôt.

---

## Stack

| Composant | Technologie |
|---|---|
| Shell desktop | Electron 40 + electron-vite |
| UI | React 19 + TypeScript |
| Analyse TS/JS | ts-morph (AST) |
| Analyse Python | tree-sitter (AST) + fallback regex, graphe partiel d'imports internes |
| Analyse Swift | Parser pragmatique dédié + graphe local approximatif de références de types |
| Couverture d’analyse | Résumé par langage dans les snapshots et les logs de scan |
| Éditeur de code | CodeMirror 6 |
| Git / churn | simple-git |
| Base de données | better-sqlite3 (SQLite local, sur disque) |
| Surveillance fichiers | chokidar |
| Graphe de dépendances | Imports résolus + références de types Swift, rendu avec d3-force |

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/yugz29/cortex.git
cd cortex

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build de production
npm run build && npm start
```

Au premier lancement, cliquer sur **Add project** et sélectionner un dossier. Cortex commencera alors à surveiller et scorer le projet.

## Commandes de développement

```bash
# Lancer l'application en développement
npm run dev

# Lancer la build packagée en preview
npm run start

# Vérifier les types TypeScript
npm run typecheck

# Lancer les tests
npm test

# Lancer les tests en mode watch
npm run test:watch
```

### Linux — dépendances système

Electron nécessite plusieurs bibliothèques système qui ne sont pas toujours installées par défaut. Si l’application ne démarre pas, installez-les d’abord :

```bash
sudo apt-get update && sudo apt-get install -y \
  libnspr4 libnss3 \
  libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libgbm1 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libasound2t64
```

> Sur d’anciennes versions d’Ubuntu/Debian, remplacer `libasound2t64` par `libasound2`.

---

## Structure du projet

```txt
src/
├── app/
│   ├── main/          # Process principal Electron — IPC, orchestration des scans, génération de rapports
│   ├── preload/       # Context bridge
│   └── renderer/      # UI React — vues, composants, hooks
│       ├── components/
│       │   ├── shared/        # Sidebar, FilterBar, FileList, ActivityPanel, GraphView...
│       │   ├── CortexView     # Layout principal — sidebar + centre + panneau détail
│       │   ├── OverviewView   # Dashboard projet
│       │   ├── GraphView      # Graphe de dépendances (ALL LINKS / LAYERS)
│       │   ├── HistoryView    # Tendances de score dans le temps
│       │   └── Detail         # Détail fichier — métriques, fonctions, historique
│       ├── hooks/             # useFileFilters, useLocale, useLocalPref
│       ├── graphLayout.ts     # Algorithmes de layout du graphe, purs et testables
│       └── utils.ts           # Couleurs de score, classification de couches, statut de santé
├── cortex/
│   ├── analyzer/      # Parsers JS/TS/Python/Swift, helpers d’import/type graph, churn.ts
│   ├── coverage/      # Résumé de couverture d’analyse
│   ├── risk-score/    # riskScore.ts, referenceBaselines.ts, trend.ts
│   └── watcher/       # Watcher chokidar aligné avec les extensions scannées
└── database/
    ├── db.ts          # Requêtes SQLite
    └── migrations.ts  # Migrations de schéma versionnées
```

---

## Limites connues

- Cortex repose sur une analyse statique approximative : il aide à prioriser la revue, mais ne prouve pas qu'un fichier est correct, sûr ou bien conçu.
- Le graphe Python dépend des imports internes résolus et ne modélise pas complètement l'environnement Python.
- Le graphe Swift repose sur des références de types locales et ne fait pas de résolution complète Xcode/SPM.
- L'audit npm dépend des lockfiles, du réseau et du registre npm ; il peut être indisponible ou partiel selon les sous-projets.
- Cortex n'intègre pas d'IA, ne remplace pas SonarQube, Snyk, ni un audit manuel.
- Cortex ne collecte pas de télémétrie.

---

## Documentation complémentaire

- [Contrat du score](docs/FR/score_contract.md) : décrit ce que le score Cortex mesure, ce qu'il ne mesure pas et comment l'interpréter.
- [Contrat des patterns](docs/FR/pattern_contract.md) : décrit les contrats internes des patterns de maintenance et les limites de leur interprétation.

---

## Vie privée

- **Local-first** — l’analyse, le scoring, l’historique et les exports restent locaux. Seul l’audit npm optionnel peut nécessiter un accès réseau vers le registre npm.
- **Aucun compte** — pas de connexion, pas de télémétrie, pas d’analytics
- **Vos données** — stockées dans SQLite sur le disque, supprimables à tout moment
- **Pas d’IA intégrée** — Cortex n’appelle aucun modèle de langage

---

## Licence

Apache-2.0
