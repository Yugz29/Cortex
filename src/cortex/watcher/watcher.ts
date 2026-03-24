import chokidar, { type FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';

const SUPPORTED = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py'];

export interface WatcherOptions {
    projectPath: string;
    ignore:      string[];
}

export function startWatcher(options: WatcherOptions) {
    const emitter = new EventEmitter();

    let currentPath   = options.projectPath;
    let currentIgnore = options.ignore;
    let watcher: FSWatcher | null = null;

    function attachListeners(w: FSWatcher) {
        w.on('add',    (path) => { if (SUPPORTED.some(ext => path.endsWith(ext))) emitter.emit('file:added',   path); });
        w.on('change', (path) => { if (SUPPORTED.some(ext => path.endsWith(ext))) emitter.emit('file:changed', path); });
        w.on('unlink', (path) => emitter.emit('file:deleted', path));
        w.on('error',  (err)  => emitter.emit('error', err));
    }

    function createWatcher(projectPath: string, ignore: string[]): FSWatcher {
        return chokidar.watch(projectPath, {
            ignored: (filePath: string) => {
                const parts = filePath.split('/');
                return parts.some(part => ignore.includes(part));
            },
            ignoreInitial: true,
        });
    }

    watcher = createWatcher(currentPath, currentIgnore);
    attachListeners(watcher);

    async function restart(newPath: string, newIgnore?: string[]): Promise<void> {
        if (watcher) {
            await watcher.close();
            watcher = null;
        }
        currentPath   = newPath;
        currentIgnore = newIgnore ?? currentIgnore;
        watcher = createWatcher(currentPath, currentIgnore);
        attachListeners(watcher);
        emitter.emit('watcher:restarted', newPath);
    }

    return {
        emitter,
        restart,
        getCurrentPath: () => currentPath,
        close: async () => { if (watcher) await watcher.close(); },
    };
}
