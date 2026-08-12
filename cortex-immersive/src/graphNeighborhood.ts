/**
 * Voisinage de sélection dans le graphe.
 * Fonctions pures — aucune dépendance Three.js/DOM/WebXR.
 * Testables indépendamment du rendu (même modèle que graphLayout.ts).
 *
 * `filterDisplayEdges` est LE filtrage d'affichage (utilisé par graphScene
 * pour construire les lignes 3D) : arêtes dont les deux extrémités existent,
 * self-loops exclus — même logique que buildForceLayout côté Cortex.
 * `selectionNeighborhood` s'exprime sur cette même liste filtrée : les index
 * d'arêtes renvoyés correspondent donc exactement aux segments affichés.
 */

import type { Edge } from '@cortex/types';

/** Arêtes affichables : deux extrémités présentes, pas de self-loop.
 *  L'ordre d'entrée est préservé (les index restent stables). */
export function filterDisplayEdges(edges: Edge[], presentIds: ReadonlySet<string>): Edge[] {
  return edges.filter(e => e.from !== e.to && presentIds.has(e.from) && presentIds.has(e.to));
}

export interface Neighborhood {
  /** Le nœud sélectionné + ses voisins directs (fan-in et fan-out). */
  nodes: Set<string>;
  /** Index (dans la liste filtrée) des arêtes touchant le nœud sélectionné. */
  edges: Set<number>;
}

/**
 * Voisinage direct d'un nœud : toute arête dont `from` ou `to` est le nœud
 * sélectionné, et les nœuds à l'autre bout. Le nœud sélectionné est toujours
 * inclus dans `nodes` — un nœud isolé donne { nodes: {lui}, edges: ∅ }.
 */
export function selectionNeighborhood(displayEdges: Edge[], selectedId: string): Neighborhood {
  const nodes = new Set<string>([selectedId]);
  const edges = new Set<number>();
  displayEdges.forEach((e, i) => {
    if (e.from === selectedId) { nodes.add(e.to);   edges.add(i); }
    else if (e.to === selectedId) { nodes.add(e.from); edges.add(i); }
  });
  return { nodes, edges };
}
