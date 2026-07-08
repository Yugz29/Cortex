import { beforeEach, describe, expect, it, vi } from 'vitest';

const gitState = vi.hoisted(() => ({
    heads:         new Map<string, string>(),
    roots:         new Map<string, string>(),
    logs:          new Map<string, string>(),
    failHead:      new Set<string>(),
    rawCalls:      [] as { projectPath: string; args: string[] }[],
    revparseCalls: [] as { projectPath: string; args: string[] }[],
}));

vi.mock('simple-git', () => ({
    simpleGit: (projectPath: string) => ({
        revparse: async (args: string[]) => {
            gitState.revparseCalls.push({ projectPath, args });
            if (args.includes('HEAD')) {
                if (gitState.failHead.has(projectPath)) throw new Error('HEAD unavailable');
                return gitState.heads.get(projectPath) ?? 'a'.repeat(40);
            }
            if (args.includes('--show-toplevel')) {
                return gitState.roots.get(projectPath) ?? projectPath;
            }
            return '';
        },
        raw: async (args: string[]) => {
            gitState.rawCalls.push({ projectPath, args });
            return gitState.logs.get(projectPath) ?? '';
        },
    }),
}));

const { buildCouplingMap } = await import('../src/cortex/analyzer/churn.js');

function logFor(...files: string[]): string {
    return ['a'.repeat(40), ...files].join('\n');
}

function headRevparseCalls(projectPath: string): number {
    return gitState.revparseCalls.filter(call => (
        call.projectPath === projectPath &&
        call.args.includes('HEAD')
    )).length;
}

beforeEach(() => {
    vi.useRealTimers();
    gitState.heads.clear();
    gitState.roots.clear();
    gitState.logs.clear();
    gitState.failHead.clear();
    gitState.rawCalls.length = 0;
    gitState.revparseCalls.length = 0;
});

describe('buildCouplingMap — cache par Git HEAD', () => {
    it('lit le HEAD et calcule les couplings au premier appel', async () => {
        const projectPath = '/repo/first';
        gitState.logs.set(projectPath, logFor('src/a.ts', 'src/b.ts'));

        const couplings = await buildCouplingMap(projectPath, 1);

        expect(couplings.size).toBe(2);
        expect(headRevparseCalls(projectPath)).toBe(1);
        expect(gitState.rawCalls).toHaveLength(1);
    });

    it('reutilise le HEAD et les couplings dans le TTL', async () => {
        const projectPath = '/repo/reuse';
        gitState.heads.set(projectPath, 'b'.repeat(40));
        gitState.logs.set(projectPath, logFor('src/a.ts', 'src/b.ts'));

        const first = await buildCouplingMap(projectPath, 1);
        const second = await buildCouplingMap(projectPath, 1);

        expect(second).toBe(first);
        expect(headRevparseCalls(projectPath)).toBe(1);
        expect(gitState.rawCalls).toHaveLength(1);
    });

    it('relit le HEAD apres expiration du TTL et recalcule si le HEAD change', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const projectPath = '/repo/head-change';
        gitState.heads.set(projectPath, 'c'.repeat(40));
        gitState.logs.set(projectPath, logFor('src/a.ts', 'src/b.ts'));

        await buildCouplingMap(projectPath, 1);
        vi.advanceTimersByTime(10_001);
        gitState.heads.set(projectPath, 'd'.repeat(40));
        gitState.logs.set(projectPath, logFor('src/a.ts', 'src/c.ts'));
        const next = await buildCouplingMap(projectPath, 1);

        expect(next.has('/repo/head-change/src/c.ts')).toBe(true);
        expect(headRevparseCalls(projectPath)).toBe(2);
        expect(gitState.rawCalls).toHaveLength(2);
    });

    it('reutilise le cache HEAD pour deux chemins equivalents normalises', async () => {
        const projectPath = '/repo/equivalent';
        const equivalentPath = '/repo/equivalent/.';
        gitState.heads.set(projectPath, 'f'.repeat(40));
        gitState.logs.set(projectPath, logFor('src/a.ts', 'src/b.ts'));

        const first = await buildCouplingMap(projectPath, 1);
        const second = await buildCouplingMap(equivalentPath, 1);

        expect(second).toBe(first);
        expect(headRevparseCalls(projectPath)).toBe(1);
        expect(headRevparseCalls(equivalentPath)).toBe(0);
        expect(gitState.rawCalls).toHaveLength(1);
    });

    it('isole le cache HEAD et couplings par projectPath', async () => {
        const projectA = '/repo/a';
        const projectB = '/repo/b';
        gitState.heads.set(projectA, 'e'.repeat(40));
        gitState.heads.set(projectB, 'e'.repeat(40));
        gitState.logs.set(projectA, logFor('src/a.ts', 'src/b.ts'));
        gitState.logs.set(projectB, logFor('src/c.ts', 'src/d.ts'));

        await buildCouplingMap(projectA, 1);
        await buildCouplingMap(projectB, 1);

        expect(headRevparseCalls(projectA)).toBe(1);
        expect(headRevparseCalls(projectB)).toBe(1);
        expect(gitState.rawCalls.map(call => call.projectPath)).toEqual([projectA, projectB]);
    });

    it('retourne une map vide si Git HEAD echoue', async () => {
        const projectPath = '/repo/fail-head';
        gitState.failHead.add(projectPath);

        const couplings = await buildCouplingMap(projectPath, 1);

        expect(couplings.size).toBe(0);
        expect(headRevparseCalls(projectPath)).toBe(1);
        expect(gitState.rawCalls).toHaveLength(0);
    });
});
