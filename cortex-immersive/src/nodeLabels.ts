/**
 * Logique des étiquettes de nœuds.
 * Fonctions pures — aucune dépendance Three.js/DOM/WebXR.
 * Testables indépendamment du rendu (même modèle que graphLayout.ts).
 *
 * Les nœuds à étiqueter à la sélection sont exactement `nodes` du
 * selectionNeighborhood existant (nœud sélectionné + voisins directs) —
 * pas de logique parallèle ici, seulement le texte affiché.
 */

/** Nom de fichier seul (sans le chemin) — le chemin complet reste dans le
 *  panneau de métriques. Robuste aux slashes de fin. */
export function fileBasename(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}
