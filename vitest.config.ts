import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
    // Alias utilisé par cortex-immersive pour importer le code renderer partagé
    // (mêmes cibles que dans cortex-immersive/vite.config.ts) — permet de tester
    // ses modules purs depuis la suite racine.
    resolve: {
        alias: { '@cortex': resolve(__dirname, 'src/app/renderer') },
    },
    test: {
        environment: 'node',
        include:     ['tests/**/*.test.ts'],
        globals:     true,
    },
});
