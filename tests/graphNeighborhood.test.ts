import { describe, it, expect } from 'vitest';
import { filterDisplayEdges, selectionNeighborhood } from '../cortex-immersive/src/graphNeighborhood';

type Edge = { from: string; to: string };

const e = (from: string, to: string): Edge => ({ from, to });

describe('filterDisplayEdges', () => {
  const present = new Set(['a.ts', 'b.ts', 'c.ts']);

  it('garde les arêtes dont les deux extrémités existent', () => {
    const edges = [e('a.ts', 'b.ts'), e('b.ts', 'c.ts')];
    expect(filterDisplayEdges(edges, present)).toEqual(edges);
  });

  it('exclut self-loops et extrémités absentes (même logique que buildForceLayout)', () => {
    const edges = [
      e('a.ts', 'a.ts'),        // self-loop
      e('a.ts', 'ghost.ts'),    // to absent
      e('ghost.ts', 'b.ts'),    // from absent
      e('c.ts', 'a.ts'),        // ok
    ];
    expect(filterDisplayEdges(edges, present)).toEqual([e('c.ts', 'a.ts')]);
  });

  it('préserve l’ordre d’entrée (index stables pour le rendu)', () => {
    const edges = [e('b.ts', 'a.ts'), e('x', 'y'), e('a.ts', 'c.ts')];
    expect(filterDisplayEdges(edges, present)).toEqual([e('b.ts', 'a.ts'), e('a.ts', 'c.ts')]);
  });

  it('liste vide → liste vide', () => {
    expect(filterDisplayEdges([], present)).toEqual([]);
  });
});

describe('selectionNeighborhood', () => {
  it('collecte fan-out et fan-in avec les index des arêtes', () => {
    const edges = [
      e('sel.ts', 'out1.ts'),   // 0 : fan-out
      e('x.ts', 'y.ts'),        // 1 : sans rapport
      e('in1.ts', 'sel.ts'),    // 2 : fan-in
      e('sel.ts', 'out2.ts'),   // 3 : fan-out
    ];
    const hood = selectionNeighborhood(edges, 'sel.ts');
    expect(hood.nodes).toEqual(new Set(['sel.ts', 'out1.ts', 'in1.ts', 'out2.ts']));
    expect(hood.edges).toEqual(new Set([0, 2, 3]));
  });

  it('nœud isolé : lui-même seul, aucune arête', () => {
    const edges = [e('x.ts', 'y.ts'), e('y.ts', 'z.ts')];
    const hood = selectionNeighborhood(edges, 'lonely.ts');
    expect(hood.nodes).toEqual(new Set(['lonely.ts']));
    expect(hood.edges.size).toBe(0);
  });

  it('graphe vide : lui-même seul', () => {
    const hood = selectionNeighborhood([], 'sel.ts');
    expect(hood.nodes).toEqual(new Set(['sel.ts']));
    expect(hood.edges.size).toBe(0);
  });

  it('paire bidirectionnelle : les deux arêtes sont retenues, le voisin une fois', () => {
    const edges = [e('sel.ts', 'peer.ts'), e('peer.ts', 'sel.ts')];
    const hood = selectionNeighborhood(edges, 'sel.ts');
    expect(hood.nodes).toEqual(new Set(['sel.ts', 'peer.ts']));
    expect(hood.edges).toEqual(new Set([0, 1]));
  });

  it('hub fortement connecté : tous les voisins, toutes ses arêtes, rien d’autre', () => {
    const edges: Edge[] = [];
    for (let i = 0; i < 50; i++) edges.push(e('hub.ts', `dep${i}.ts`));
    for (let i = 0; i < 30; i++) edges.push(e(`user${i}.ts`, 'hub.ts'));
    edges.push(e('a.ts', 'b.ts'));                     // index 80, sans rapport
    const hood = selectionNeighborhood(edges, 'hub.ts');
    expect(hood.nodes.size).toBe(81);                  // hub + 50 deps + 30 users
    expect(hood.edges.size).toBe(80);
    expect(hood.edges.has(80)).toBe(false);
  });

  it('se compose avec filterDisplayEdges : les index pointent dans la liste filtrée', () => {
    const present = new Set(['sel.ts', 'n.ts']);
    const raw = [
      e('sel.ts', 'ghost.ts'),  // éliminé au filtrage
      e('sel.ts', 'sel.ts'),    // éliminé (self-loop)
      e('sel.ts', 'n.ts'),      // seul retenu → index 0 après filtrage
    ];
    const filtered = filterDisplayEdges(raw, present);
    const hood = selectionNeighborhood(filtered, 'sel.ts');
    expect(hood.edges).toEqual(new Set([0]));
    expect(hood.nodes).toEqual(new Set(['sel.ts', 'n.ts']));
  });
});
