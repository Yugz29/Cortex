import { describe, expect, it, vi } from 'vitest';
import type { FunctionMetrics } from '../src/cortex/analyzer/parser.js';

type StoredFunction = {
    file_path: string;
    name: string;
    start_line: number;
    line_count: number;
    cyclomatic_complexity: number;
    cognitive_complexity: number;
    parameter_count: number;
    max_depth: number;
    project_path: string;
    scanned_at: string;
};

const fakeDb = vi.hoisted(() => {
    class FakeDatabase {
        functions: StoredFunction[] = [];
        transactionRuns = 0;

        prepare(sql: string) {
            const db = this;
            return {
                run(...args: any[]) {
                    if (sql.includes('DELETE FROM functions WHERE file_path = ?')) {
                        const [filePath] = args;
                        db.functions = db.functions.filter(fn => fn.file_path !== filePath);
                        return;
                    }

                    if (sql.includes('INSERT INTO functions')) {
                        const [
                            filePath, name, startLine, lineCount, cyclomaticComplexity,
                            cognitiveComplexity, parameterCount, maxDepth, projectPath, scannedAt,
                        ] = args;
                        db.functions.push({
                            file_path: filePath,
                            name,
                            start_line: startLine,
                            line_count: lineCount,
                            cyclomatic_complexity: cyclomaticComplexity,
                            cognitive_complexity: cognitiveComplexity,
                            parameter_count: parameterCount,
                            max_depth: maxDepth,
                            project_path: projectPath,
                            scanned_at: scannedAt,
                        });
                    }
                },
                get() {
                    return undefined;
                },
                all(...args: any[]) {
                    if (sql.includes('FROM functions WHERE file_path = ?')) {
                        const [filePath] = args;
                        return db.functions
                            .filter(fn => fn.file_path === filePath)
                            .sort((a, b) => b.cyclomatic_complexity - a.cyclomatic_complexity)
                            .map(fn => ({
                                name: fn.name,
                                start_line: fn.start_line,
                                line_count: fn.line_count,
                                cyclomatic_complexity: fn.cyclomatic_complexity,
                                cognitive_complexity: fn.cognitive_complexity,
                                parameter_count: fn.parameter_count,
                                max_depth: fn.max_depth,
                            }));
                    }
                    return [];
                },
            };
        }

        transaction(fn: () => void) {
            return () => {
                this.transactionRuns++;
                fn();
            };
        }
    }

    return { FakeDatabase };
});

vi.mock('better-sqlite3', () => ({
    default: fakeDb.FakeDatabase,
}));

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/cortex-functions-tests',
    },
}));

const { getFunctions, saveFunctions } = await import('../src/database/db.js');

function fn(name: string, complexity: number): FunctionMetrics {
    return {
        name,
        startLine: 1,
        lineCount: 10,
        cyclomaticComplexity: complexity,
        cognitiveComplexity: complexity,
        parameterCount: 0,
        maxDepth: 1,
    };
}

describe('functions persistence', () => {
    it('saveFunctions remplace les anciennes fonctions du meme fichier', () => {
        const filePath = '/project/src/a.ts';
        saveFunctions(filePath, [fn('oldFn', 1)], '/project');

        saveFunctions(filePath, [fn('newFn', 4)], '/project');

        expect(getFunctions(filePath).map(f => f.name)).toEqual(['newFn']);
    });

    it("saveFunctions ne supprime pas les fonctions d'autres fichiers", () => {
        saveFunctions('/project/src/a.ts', [fn('fromA', 2)], '/project');
        saveFunctions('/project/src/b.ts', [fn('fromB', 3)], '/project');

        saveFunctions('/project/src/a.ts', [fn('fromANext', 4)], '/project');

        expect(getFunctions('/project/src/a.ts').map(f => f.name)).toEqual(['fromANext']);
        expect(getFunctions('/project/src/b.ts').map(f => f.name)).toEqual(['fromB']);
    });

    it("saveFunctions ne supprime pas les fonctions d'un autre projet", () => {
        saveFunctions('/project-a/src/a.ts', [fn('fromProjectA', 2)], '/project-a');
        saveFunctions('/project-b/src/a.ts', [fn('fromProjectB', 3)], '/project-b');

        saveFunctions('/project-a/src/a.ts', [fn('fromProjectANext', 4)], '/project-a');

        expect(getFunctions('/project-a/src/a.ts').map(f => f.name)).toEqual(['fromProjectANext']);
        expect(getFunctions('/project-b/src/a.ts').map(f => f.name)).toEqual(['fromProjectB']);
    });

    it('les doublons ne cassent pas saveFunctions', () => {
        const filePath = '/project/src/duplicates.ts';

        saveFunctions(filePath, [fn('sameName', 2), fn('sameName', 5)], '/project');

        expect(getFunctions(filePath).map(f => f.name)).toEqual(['sameName', 'sameName']);
    });
});
