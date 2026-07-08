import { describe, expect, it, vi } from 'vitest';
import { CURRENT_VERSION, MIGRATIONS } from '../src/database/migrations.js';

type StoredFingerprint = {
    project_path: string;
    fingerprint: string;
    scanner_version: string;
    created_at: string;
};

const fakeDb = vi.hoisted(() => {
    class FakeDatabase {
        projectFingerprints: StoredFingerprint[] = [];

        exec(): void {
            // Schema creation is covered by migration assertions.
        }

        prepare(sql: string) {
            const db = this;
            return {
                run(...args: any[]) {
                    if (sql.includes('INSERT INTO project_fingerprints')) {
                        const [projectPath, fingerprint, scannerVersion, createdAt] = args;
                        const existing = db.projectFingerprints.find(row => row.project_path === projectPath);
                        if (existing) {
                            existing.fingerprint = fingerprint;
                            existing.scanner_version = scannerVersion;
                            existing.created_at = createdAt;
                        } else {
                            db.projectFingerprints.push({
                                project_path: projectPath,
                                fingerprint,
                                scanner_version: scannerVersion,
                                created_at: createdAt,
                            });
                        }
                    }
                },
                get(...args: any[]) {
                    if (sql.includes('FROM project_fingerprints')) {
                        const [projectPath] = args;
                        return db.projectFingerprints.find(row => row.project_path === projectPath);
                    }
                    return undefined;
                },
                all() {
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
        getPath: () => '/tmp/cortex-project-fingerprint-tests',
    },
}));

const { getProjectFingerprint, saveProjectFingerprint } = await import('../src/database/db.js');

describe('project_fingerprints migration', () => {
    it('ajoute une migration v10 pour persister les fingerprints projet', () => {
        const migration = MIGRATIONS.find(m => m.version === 10);
        const execs: string[] = [];

        migration?.up({
            exec: (sql: string) => { execs.push(sql); },
            prepare: () => ({ run: () => undefined, get: () => undefined }),
            transaction: (fn: () => void) => () => fn(),
        });

        expect(CURRENT_VERSION).toBeGreaterThanOrEqual(10);
        expect(migration?.description).toContain('project scan fingerprints');
        expect(execs.join('\n')).toContain('CREATE TABLE IF NOT EXISTS project_fingerprints');
        expect(execs.join('\n')).toContain('project_path');
        expect(execs.join('\n')).toContain('fingerprint');
        expect(execs.join('\n')).toContain('scanner_version');
    });
});

describe('project fingerprint persistence', () => {
    it('retourne null si aucun fingerprint existe', () => {
        expect(getProjectFingerprint('/project/empty')).toBeNull();
    });

    it('saveProjectFingerprint puis getProjectFingerprint retourne le fingerprint attendu', () => {
        saveProjectFingerprint('/project/basic', 'fp-1', 'scanner-v1');

        expect(getProjectFingerprint('/project/basic')).toMatchObject({
            fingerprint: 'fp-1',
            scannerVersion: 'scanner-v1',
        });
    });

    it('sauvegarder deux fois le meme projet remplace le fingerprint', () => {
        saveProjectFingerprint('/project/replace', 'fp-old', 'scanner-v1');
        saveProjectFingerprint('/project/replace', 'fp-new', 'scanner-v1');

        expect(getProjectFingerprint('/project/replace')).toMatchObject({
            fingerprint: 'fp-new',
            scannerVersion: 'scanner-v1',
        });
    });

    it("sauvegarder un projet A ne modifie pas le fingerprint d'un projet B", () => {
        saveProjectFingerprint('/project/a', 'fp-a', 'scanner-v1');
        saveProjectFingerprint('/project/b', 'fp-b', 'scanner-v1');
        saveProjectFingerprint('/project/a', 'fp-a-next', 'scanner-v1');

        expect(getProjectFingerprint('/project/a')).toMatchObject({ fingerprint: 'fp-a-next' });
        expect(getProjectFingerprint('/project/b')).toMatchObject({ fingerprint: 'fp-b' });
    });
});
