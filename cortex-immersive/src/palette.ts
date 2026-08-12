/**
 * Palette de statut du client immersif.
 * Fonctions pures — aucune dépendance Three.js/DOM/WebXR.
 *
 * Réutilise les SEUILS de scoreColorHex (Cortex) tels quels : la catégorie
 * est déterminée par la fonction existante, seule la couleur de sortie est
 * remappée vers une palette adoucie pour fond sombre (lisibilité prolongée,
 * accessibilité daltonisme). Cortex Desktop n'est pas affecté — utils.ts
 * reste intouché.
 */

import { scoreColorHex } from '@cortex/utils';

/** Sortie scoreColorHex → palette immersive. Un palier = une entrée. */
export const STATUS_COLOR_REMAP: Readonly<Record<string, string>> = {
  '#34c759': '#0ca30c',   // sain
  '#ff9f0a': '#fab219',   // dégradé / attention
  '#ff453a': '#d03b3b',   // critique
};

/** Couleur de statut d'un score — mêmes seuils que scoreColorHex. */
export function statusColorHex(score: number): string {
  const base = scoreColorHex(score);
  return STATUS_COLOR_REMAP[base] ?? base;
}

/** Arêtes hors mise en évidence : gris-bleu sombre neutre — la couleur reste
 *  l'information des nœuds, pas du maillage. */
export const EDGE_NEUTRAL_HEX = '#465064';
