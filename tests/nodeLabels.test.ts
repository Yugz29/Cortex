import { describe, it, expect } from 'vitest';
import { fileBasename } from '../cortex-immersive/src/nodeLabels';

describe('fileBasename', () => {
  it('extrait le nom de fichier d’un chemin absolu', () => {
    expect(fileBasename('/Users/x/Projets/Cortex/src/app/renderer/utils.ts')).toBe('utils.ts');
  });

  it('renvoie tel quel un nom sans chemin', () => {
    expect(fileBasename('utils.ts')).toBe('utils.ts');
  });

  it('ignore un slash final', () => {
    expect(fileBasename('src/app/')).toBe('app');
  });

  it('chaîne vide → chaîne vide', () => {
    expect(fileBasename('')).toBe('');
  });
});
