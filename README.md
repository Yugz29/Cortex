# Cortex

> Un moniteur local-first de qualité de code qui tourne discrètement en arrière-plan et indique où concentrer la revue avant que la dette ne devienne un problème.

---

## Présentation

Cortex est une application desktop qui surveille un dépôt de code en temps réel. Elle observe les fichiers, analyse la complexité du code et l’activité Git, puis fait ressortir les fichiers qui méritent une revue en priorité.

---

## Ce que fait Cortex

**Surveillance continue du projet**

Cortex tourne en arrière-plan et détecte les changements de fichiers. À chaque sauvegarde, il peut relancer une analyse : complexité, taille des fonctions, profondeur d’imbrication, churn, couplage et dépendances.

**Score par fichier de 0 à 100**

Chaque fichier reçoit un score de risque de maintenance basé sur 7 métriques pondérées. Les fichiers sont classés et colorés : 🟢 sain · 🟡 sous pression · 🔴 critique.

**Adaptation au codebase**

Les seuils sont calibrés par type de fichier : un composant React n’est pas évalué comme un parser, et un fichier de configuration n’est pas évalué comme un service. Cortex utilise aussi les distributions propres au projet pour s’adapter à ce qui est normal dans ce codebase.

**Historique des scores**

Chaque scan est stocké. Il est possible de voir si un fichier s’améliore ou se dégrade dans le temps, et de suivre l’évolution globale de la santé du projet par scan ou par jour.

**Snapshots structurés du projet**

Après chaque scan, Cortex écrit un snapshot JSON structuré du projet : scores, historique, couplages, tendances et couverture d’analyse. Ce snapshot sert de contexte de maintenance pour relire les parties analysées du codebase.

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
| **Scan sécurité** | Détection par patterns de secrets/injections + vérification des vulnérabilités via `npm audit` |
| **Fichiers ignorés** | Exclusion de fichiers du scoring depuis la sidebar, ou exclusion complète du scan depuis les réglages |
| **Préférences UI** | Largeur de la sidebar, hauteur du panneau d’activité, mode de graphe et granularité persistés entre les sessions |
| **Snapshot projet** | `cortex-snapshot.json` écrit après chaque scan — contexte de maintenance structuré avec couverture d’analyse |
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

## Contexte de maintenance

Après chaque scan, Cortex écrit `cortex-snapshot.json`. Ce fichier contient :

- un résumé du projet : nombre total de fichiers, fichiers critiques / sous pression / sains, score moyen ;
- les scores par fichier avec métriques brutes, langage et date du dernier scan ;
- l’historique de santé du projet ;
- la carte de couplage : fichiers qui changent souvent ensemble ;
- un résumé de couverture d’analyse : parties entièrement, partiellement ou non analysées.

Cortex est utile comme **générateur de contexte de maintenance**. Le snapshot capture l’état du code analysé, les fichiers qui ressortent, les tendances et les zones où une revue humaine est la plus utile.

Le score concerne le code analysé. Il ne doit pas être interprété comme un jugement complet sur tous les fichiers du dépôt.

---

## Stack

| Composant | Technologie |
|---|---|
| Shell desktop | Electron 40 + electron-vite |
| UI | React 19 + TypeScript |
| Analyse TS/JS | ts-morph (AST) |
| Analyse Python | tree-sitter (AST) + fallback regex |
| Analyse Swift | Parser pragmatique dédié + graphe local de références de types |
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

## Vie privée

- **100 % local** — aucune donnée ne quitte la machine
- **Aucun compte** — pas de connexion, pas de télémétrie, pas d’analytics
- **Vos données** — stockées dans SQLite sur le disque, supprimables à tout moment
- **Pas d’IA intégrée** — Cortex n’appelle aucun modèle de langage

---

## Licence

Apache-2.0