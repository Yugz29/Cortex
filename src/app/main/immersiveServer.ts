/**
 * Serveur HTTP local pour le client immersif (WebXR / Meta Quest).
 *
 * Second point d'accès aux données Cortex, à côté de l'IPC Electron :
 *
 *   Cortex Core ──── Electron IPC ───▶ Cortex Desktop
 *        │
 *        └───────── HTTP API ────────▶ Cortex Immersive (WebXR)
 *
 * - GET /api/graph  → { scans, edges } via les MÊMES fonctions que les handlers IPC
 *                     (injectées par index.ts — aucune logique métier dupliquée ici).
 * - Fichiers statiques → build du client immersif (cortex-immersive/dist),
 *   servi depuis la même origine que l'API pour éviter tout CORS.
 *
 * Non-bloquant : si le port est occupé ou qu'une erreur survient, on loggue et on
 * arrête proprement ce serveur seul — Cortex Desktop démarre normalement.
 *
 * Aucune dépendance Electron : module testable en Node pur.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const IMMERSIVE_PORT = 4517;

export interface ImmersiveServerOptions {
  getScans:   () => unknown;
  getEdges:   () => unknown;
  staticDir?: string;       // dossier du build client (optionnel — API seule sinon)
  port?:      number;
  host?:      string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function serveStatic(res: http.ServerResponse, staticDir: string, urlPath: string): void {
  // Résolution sécurisée : jamais en dehors de staticDir
  const rel      = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(staticDir, rel);
  if (!resolved.startsWith(path.resolve(staticDir) + path.sep) && resolved !== path.resolve(staticDir)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    sendJson(res, 404, { error: 'not_found', hint: 'Build the immersive client first: cd cortex-immersive && npm run build' });
    return;
  }
  const mime = MIME[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(resolved).pipe(res);
}

export interface ImmersiveServerHandle {
  server: http.Server;
  close:  () => Promise<void>;
}

export function startImmersiveServer(opts: ImmersiveServerOptions): ImmersiveServerHandle {
  const port = opts.port ?? IMMERSIVE_PORT;
  const host = opts.host ?? '127.0.0.1';

  const server = http.createServer((req, res) => {
    try {
      const urlPath = (req.url ?? '/').split('?')[0]!;

      if (urlPath === '/api/graph') {
        sendJson(res, 200, { scans: opts.getScans(), edges: opts.getEdges() });
        return;
      }
      if (urlPath.startsWith('/api/')) {
        sendJson(res, 404, { error: 'unknown_endpoint' });
        return;
      }
      if (opts.staticDir) {
        serveStatic(res, opts.staticDir, urlPath);
        return;
      }
      sendJson(res, 404, { error: 'no_static_build', hint: 'Only /api/graph is available. Build cortex-immersive to serve the WebXR client.' });
    } catch (err) {
      console.error('[Cortex Immersive] Request error:', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
      else res.end();
    }
  });

  // Port occupé ou autre erreur serveur : log clair + arrêt propre du serveur seul.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Cortex Immersive] Port ${port} already in use — immersive server disabled. Cortex Desktop is unaffected.`);
    } else {
      console.warn('[Cortex Immersive] HTTP server error — immersive server disabled:', err.message);
    }
    server.close();
  });

  server.listen(port, host, () => {
    console.log(`[Cortex Immersive] Serving on http://${host}:${port} (API: /api/graph)`);
  });

  return {
    server,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
