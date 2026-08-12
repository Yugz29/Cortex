import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Client immersif Cortex — projet Vite indépendant du workspace racine.
// L'alias @cortex pointe vers le code renderer existant : types, layout,
// classification de layers et couleurs sont RÉUTILISÉS, pas dupliqués.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@cortex': fileURLToPath(new URL('../src/app/renderer', import.meta.url)),
    },
  },
  server: {
    // Autorise l'import de fichiers hors du root Vite (le code Cortex partagé)
    fs: { allow: ['..'] },
    // En dev, /api est proxifié vers le serveur HTTP du main process Cortex
    proxy: { '/api': 'http://127.0.0.1:4517' },
  },
});
