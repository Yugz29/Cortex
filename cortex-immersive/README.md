# Cortex Immersive

Client WebXR (Meta Quest 3) affichant le **vrai graphe Cortex** en 3D.
Second client des données Cortex, à côté de Cortex Desktop :

```text
Cortex Core
    |
    +---- Electron IPC ----> Cortex Desktop
    |
    +---- HTTP API --------> Cortex Immersive / WebXR  (port 4517)
```

## Réutilisation (aucune logique dupliquée)

Le code Cortex existant est importé tel quel via l'alias `@cortex` → `../src/app/renderer` :

| Réutilisé                        | Rôle ici                                        |
|----------------------------------|--------------------------------------------------|
| `types.ts` (`Scan`, `Edge`)      | Contrat de données de `/api/graph`               |
| `graphLayout.ts` (`buildLayerLayout`) | Coordonnées X/Y + rayon des nœuds (identiques à GraphView) |
| `utils.ts` (`classifyLayer`)     | Couche architecturale → axe **Z**                |
| `utils.ts` (`scoreColorHex`)     | Couleur des nœuds selon le score existant        |

Les données viennent de `GET /api/graph`, servi par le main process Electron via
les **mêmes fonctions** que les handlers IPC `get-scans` / `get-edges`.

Projet volontairement **hors workspace racine** (son propre `package.json`) pour ne pas
interférer avec les dépendances natives d'Electron (`better-sqlite3`, `tree-sitter`).

## Build & lancement

```bash
cd cortex-immersive
npm install
npm run build        # → dist/, servi automatiquement par Cortex sur http://localhost:4517
```

Lancer ensuite Cortex Desktop normalement : le main process sert `dist/` et l'API
sur le port **4517** (même origine → pas de CORS). Si le port est occupé, le serveur
immersif se désactive proprement sans affecter Cortex Desktop.

### Itération sans casque (préviz desktop)

```bash
npm run dev          # Vite + proxy /api → localhost:4517 (Cortex doit tourner)
```

Souris : glisser = orbite, molette = zoom, clic sur un nœud = sélection + métriques.

## Meta Quest 3

WebXR exige un contexte sécurisé (HTTPS ou `localhost`). On passe donc par
`adb reverse` (mode développeur requis sur le casque) plutôt que par l'IP locale :

```bash
adb reverse tcp:4517 tcp:4517
```

Puis dans le navigateur du Quest : **http://localhost:4517** → bouton
**START AR** (passthrough / mixed reality) ou **ENTER VR** en fallback selon le support.

- Le graphe apparaît à hauteur des yeux, ~1,6 m devant soi — on peut marcher autour.

### Contrôles

| Geste                        | Effet                                                        |
|------------------------------|--------------------------------------------------------------|
| **Gâchette** (trigger)       | Raycast → sélection d'un nœud, surbrillance, panneau de métriques (score, complexité, cognitive, taille, churn, depth, params, fan in/out, hotspot). Le panneau apparaît en « pupitre » : ~0,55 m devant soi, sous la ligne de regard, face à l'utilisateur — posé à la sélection puis **fixe dans l'espace** (il ne suit ni le graphe ni la tête ; re-sélectionner un nœud le repose devant soi) |
| **Grip une main** (squeeze maintenu) | Attrape le graphe : il suit la position **et** l'orientation du contrôleur ; reste où on le lâche |
| **Grip deux mains** (squeeze des deux côtés) | Écarter/rapprocher = zoom (ratio des distances, borné [0.05×, 20×]) ; tourner les mains = rotation ; ancrage au milieu des deux mains (pas de dérive) |
| **A / X**                    | Recentre le graphe (position, orientation et échelle par défaut) |

La bascule une main ↔ deux mains en cours de geste se fait sans saut visuel
(la baseline est recapturée à chaque changement du nombre de mains tenues).
Les calculs de transformation sont dans `src/graphManipulation.ts` — fonctions
pures sans dépendance Three.js/WebXR, testées dans `tests/graphManipulation.test.ts`
(racine du repo).

## Mapping 3D (V0)

- **X/Y** : layout Cortex existant (`buildLayerLayout`, mode « layers » de GraphView), 1 px ≈ 1/150 m ;
- **Z** : couche architecturale (`classifyLayer`) — UI, API, CORE, DATABASE, CONFIG espacées de 0,7 m ;
- taille de nœud : `NodeLayout.r` existant ; couleur : `scoreColorHex` existant ;
- edges : filtrés comme dans `buildForceLayout` (endpoints présents dans les scans, pas de self-loop).

Pas de moteur force-directed 3D dans cette V0 — délibéré.
