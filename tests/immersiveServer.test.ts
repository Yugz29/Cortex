import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startImmersiveServer, type ImmersiveServerHandle } from '../src/app/main/immersiveServer';

const handles: ImmersiveServerHandle[] = [];

function start(opts: Partial<Parameters<typeof startImmersiveServer>[0]> = {}, port = 4599): ImmersiveServerHandle {
  const h = startImmersiveServer({
    getScans: () => [{ filePath: 'a.ts', globalScore: 10 }],
    getEdges: () => [{ from: 'a.ts', to: 'b.ts' }],
    port,
    ...opts,
  });
  handles.push(h);
  return h;
}

function listening(h: ImmersiveServerHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    h.server.once('listening', resolve);
    h.server.once('error', reject);
  });
}

afterEach(async () => {
  while (handles.length) await handles.pop()!.close();
});

describe('immersiveServer', () => {
  it('serves /api/graph from the injected data functions', async () => {
    const h = start();
    await listening(h);
    const res  = await fetch('http://127.0.0.1:4599/api/graph');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scans).toEqual([{ filePath: 'a.ts', globalScore: 10 }]);
    expect(body.edges).toEqual([{ from: 'a.ts', to: 'b.ts' }]);
  });

  it('returns 404 with a hint when no static build is present', async () => {
    const h = start();
    await listening(h);
    const res = await fetch('http://127.0.0.1:4599/');
    expect(res.status).toBe(404);
  });

  it('serves static files and blocks path traversal', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cortex-immersive-'));
    writeFileSync(join(dir, 'index.html'), '<h1>ok</h1>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');

    const h = start({ staticDir: dir });
    await listening(h);

    const index = await fetch('http://127.0.0.1:4599/');
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('ok');

    const js = await fetch('http://127.0.0.1:4599/assets/app.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('text/javascript');

    const evil = await fetch('http://127.0.0.1:4599/..%2f..%2fetc%2fpasswd');
    expect([403, 404]).toContain(evil.status);
  });

  it('does not crash when the port is already in use', async () => {
    const h1 = start();
    await listening(h1);
    const h2 = start(); // même port → EADDRINUSE géré en interne
    await new Promise(r => setTimeout(r, 150));
    // Le premier serveur répond toujours ; le second s'est arrêté proprement.
    const res = await fetch('http://127.0.0.1:4599/api/graph');
    expect(res.status).toBe(200);
    expect(h2.server.listening).toBe(false);
  });
});
