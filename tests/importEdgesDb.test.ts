import { describe, expect, it, vi } from 'vitest';
import { CURRENT_VERSION, MIGRATIONS } from '../src/database/migrations.js';

type StoredEdge = {
    project_path: string;
    from_file: string;
    to_file: string;
    scanned_at: string;
};

const fakeDb = vi.hoisted(() => {
    class FakeDatabase {
        importEdges: StoredEdge[] = [];

        exec(): void {
            // Schema creation is covered by the migration assertions below.
        }

        prepare(sql: string) {
            const db = this;
            return {
                run(...args: any[]) {
                    if (sql.includes('DELETE FROM import_edges WHERE project_path = ?')) {
                        const [projectPath] = args;
                        db.importEdges = db.importEdges.filter(edge => edge.project_path !== projectPath);
                        return;
                    }
                    if (sql.includes('INSERT OR IGNORE INTO import_edges')) {
                        const [projectPath, fromFile, toFile, scannedAt] = args;
                        const exists = db.importEdges.some(edge =>
                            edge.project_path === projectPath &&
                            edge.from_file === fromFile &&
                            edge.to_file === toFile
                        );
                        if (!exists) {
                            db.importEdges.push({
                                project_path: projectPath,
                                from_file:    fromFile,
                                to_file:      toFile,
                                scanned_at:   scannedAt,
                            });
                        }
                    }
                },
                get() {
                    return undefined;
                },
                all(...args: any[]) {
                    if (sql.includes('FROM import_edges')) {
                        const [projectPath] = args;
                        return db.importEdges
                            .filter(edge => edge.project_path === projectPath)
                            .map(edge => ({ from_file: edge.from_file, to_file: edge.to_file }));
                    }
                    return [];
                },
            };
        }

        transaction(fn: () => void) {
            return () => fn();
        }
    }

    return { FakeDatabase };
});

vi.mock('better-sqlite3', () => ({
    default: fakeDb.FakeDatabase,
}));

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/cortex-import-edge-tests',
    },
}));

const { getImportEdges, saveImportEdges } = await import('../src/database/db.js');

describe('import_edges migration', () => {
    it('ajoute une migration v9 pour persister les edges imports', () => {
        const migration = MIGRATIONS.find(m => m.version === 9);
        const execs: string[] = [];

        migration?.up({
            exec: (sql: string) => { execs.push(sql); },
            prepare: () => ({ run: () => undefined, get: () => undefined }),
            transaction: (fn: () => void) => () => fn(),
        });

        expect(CURRENT_VERSION).toBeGreaterThanOrEqual(9);
        expect(migration?.description).toContain('import graph edges');
        expect(execs.join('\n')).toContain('CREATE TABLE IF NOT EXISTS import_edges');
        expect(execs.join('\n')).toContain('idx_import_edges_unique');
        expect(execs.join('\n')).toContain('idx_import_edges_project');
        expect(execs.join('\n')).toContain('idx_import_edges_from');
        expect(execs.join('\n')).toContain('idx_import_edges_to');
    });
});

describe('import_edges persistence', () => {
    it('saveImportEdges puis getImportEdges retourne les edges attendus', () => {
        const projectPath = '/project/basic';
        const edges = [
            { from: '/project/basic/src/a.ts', to: '/project/basic/src/b.ts' },
            { from: '/project/basic/src/b.ts', to: '/project/basic/src/c.ts' },
        ];

        saveImportEdges(projectPath, edges);

        expect(getImportEdges(projectPath)).toEqual(edges);
    });

    it('sauvegarder deux fois le meme projet remplace les anciens edges', () => {
        const projectPath = '/project/replace';
        saveImportEdges(projectPath, [
            { from: '/project/replace/src/a.ts', to: '/project/replace/src/b.ts' },
        ]);
        const replacement = [
            { from: '/project/replace/src/c.ts', to: '/project/replace/src/d.ts' },
        ];

        saveImportEdges(projectPath, replacement);

        expect(getImportEdges(projectPath)).toEqual(replacement);
    });

    it("sauvegarder un projet A ne supprime pas les edges d'un projet B", () => {
        const projectA = '/project/a';
        const projectB = '/project/b';
        const edgesA = [
            { from: '/project/a/src/a.ts', to: '/project/a/src/b.ts' },
        ];
        const edgesB = [
            { from: '/project/b/src/a.ts', to: '/project/b/src/b.ts' },
        ];

        saveImportEdges(projectA, edgesA);
        saveImportEdges(projectB, edgesB);
        saveImportEdges(projectA, [
            { from: '/project/a/src/c.ts', to: '/project/a/src/d.ts' },
        ]);

        expect(getImportEdges(projectB)).toEqual(edgesB);
    });

    it('les doublons ne cassent pas la sauvegarde', () => {
        const projectPath = '/project/duplicates';
        const edge = { from: '/project/duplicates/src/a.ts', to: '/project/duplicates/src/b.ts' };

        saveImportEdges(projectPath, [edge, edge]);

        expect(getImportEdges(projectPath)).toEqual([edge]);
    });

    it('getImportEdges retourne [] si aucun edge', () => {
        expect(getImportEdges('/project/empty')).toEqual([]);
    });
});
