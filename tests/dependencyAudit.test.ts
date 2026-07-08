import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findNodeProjects, runNpmAuditIn, type ExecFileLike } from '../src/app/main/dependencyAudit.js';

const tmpRoots: string[] = [];

function makeProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-dep-audit-'));
    tmpRoots.push(dir);
    return dir;
}

function writeFile(projectPath: string, relativePath: string, content = ''): void {
    const filePath = path.join(projectPath, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
}

function execWith(stdout: string, stderr = '', error: Error | null = null): ExecFileLike {
    return (_file, _args, _options, callback) => {
        callback(error as any, stdout, stderr);
    };
}

afterEach(() => {
    for (const dir of tmpRoots.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('dependency audit discovery', () => {
    it('detecte package.json + package-lock.json', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'package.json', '{}');
        writeFile(projectPath, 'package-lock.json', '{}');

        expect(findNodeProjects(projectPath)).toEqual([
            { dir: projectPath, lockfiles: ['package-lock.json'] },
        ]);
    });

    it('detecte package.json + npm-shrinkwrap.json', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'package.json', '{}');
        writeFile(projectPath, 'npm-shrinkwrap.json', '{}');

        expect(findNodeProjects(projectPath)).toEqual([
            { dir: projectPath, lockfiles: ['npm-shrinkwrap.json'] },
        ]);
    });

    it('ne considere pas package.json sans lockfile comme auditable', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'package.json', '{}');

        expect(findNodeProjects(projectPath)).toEqual([]);
    });
});

describe('npm audit execution', () => {
    it('parse un JSON npm valide meme avec un code de sortie non-zero', async () => {
        const projectPath = makeProject();
        const err = Object.assign(new Error('Command failed: npm audit --json'), { code: 1 });
        const stdout = JSON.stringify({
            vulnerabilities: {
                lodash: { name: 'lodash', severity: 'high', via: ['lodash'], range: '<4.17.21', fixAvailable: true },
            },
            metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, info: 0, total: 1 } },
        });

        const result = await runNpmAuditIn(projectPath, execWith(stdout, '', err));

        expect(result.error).toBeUndefined();
        expect(result.counts.total).toBe(1);
        expect(result.vulns).toHaveLength(1);
    });

    it('remonte une erreur si stdout est vide et npm echoue', async () => {
        const projectPath = makeProject();
        const err = Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' });

        const result = await runNpmAuditIn(projectPath, execWith('', '', err));

        expect(result.counts.total).toBe(0);
        expect(result.vulns).toEqual([]);
        expect(result.error).toContain('ENOENT');
    });

    it('remonte une erreur si le JSON npm est invalide', async () => {
        const projectPath = makeProject();

        const result = await runNpmAuditIn(projectPath, execWith('{not-json'));

        expect(result.counts.total).toBe(0);
        expect(result.vulns).toEqual([]);
        expect(result.error).toContain('Invalid npm audit JSON');
    });

    it('execute npm audit a chaque appel', async () => {
        const projectPath = makeProject();
        let calls = 0;
        const execFile: ExecFileLike = (_file, _args, _options, callback) => {
            calls += 1;
            callback(null, JSON.stringify({
                vulnerabilities: {},
                metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 } },
            }), '');
        };

        await runNpmAuditIn(projectPath, execFile);
        await runNpmAuditIn(projectPath, execFile);

        expect(calls).toBe(2);
    });
});
