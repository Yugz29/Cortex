import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    buildProjectFingerprint,
    isProjectFingerprintCurrent,
    SCANNER_FINGERPRINT_VERSION,
} from '../src/app/main/scanner.js';

const tmpRoots: string[] = [];

function makeProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fingerprint-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    return dir;
}

function writeFile(projectPath: string, relativePath: string, content: string): void {
    const filePath = path.join(projectPath, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
}

afterEach(() => {
    for (const dir of tmpRoots.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('project fingerprint', () => {
    it('reste identique si aucun fichier scannable ne change', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');

        const first = buildProjectFingerprint(projectPath);
        const second = buildProjectFingerprint(projectPath);

        expect(second).toEqual(first);
        expect(isProjectFingerprintCurrent(first, {
            fingerprint: first.fingerprint,
            scannerVersion: SCANNER_FINGERPRINT_VERSION,
        })).toBe(true);
    });

    it('change si la taille fichier change', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');
        const first = buildProjectFingerprint(projectPath);

        writeFile(projectPath, 'src/a.ts', 'export const a = 123;\n');
        const second = buildProjectFingerprint(projectPath);

        expect(second.fingerprint).not.toBe(first.fingerprint);
        expect(isProjectFingerprintCurrent(second, {
            fingerprint: first.fingerprint,
            scannerVersion: SCANNER_FINGERPRINT_VERSION,
        })).toBe(false);
    });

    it('change si le mtime fichier change', () => {
        const projectPath = makeProject();
        const filePath = path.join(projectPath, 'src/a.ts');
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');
        const first = buildProjectFingerprint(projectPath);

        const nextTime = new Date(Date.now() + 60_000);
        fs.utimesSync(filePath, nextTime, nextTime);
        const second = buildProjectFingerprint(projectPath);

        expect(second.fingerprint).not.toBe(first.fingerprint);
    });

    it('change si un fichier scannable est ajoute', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');
        const first = buildProjectFingerprint(projectPath);

        writeFile(projectPath, 'src/b.ts', 'export const b = 2;\n');
        const second = buildProjectFingerprint(projectPath);

        expect(second.fileCount).toBe(first.fileCount + 1);
        expect(second.fingerprint).not.toBe(first.fingerprint);
    });

    it('change si un fichier scannable est supprime', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');
        writeFile(projectPath, 'src/b.ts', 'export const b = 2;\n');
        const first = buildProjectFingerprint(projectPath);

        fs.unlinkSync(path.join(projectPath, 'src/b.ts'));
        const second = buildProjectFingerprint(projectPath);

        expect(second.fileCount).toBe(first.fileCount - 1);
        expect(second.fingerprint).not.toBe(first.fingerprint);
    });

    it('ne considere pas un fingerprint absent ou une autre version scanner comme courant', () => {
        const projectPath = makeProject();
        writeFile(projectPath, 'src/a.ts', 'export const a = 1;\n');
        const current = buildProjectFingerprint(projectPath);

        expect(isProjectFingerprintCurrent(current, null)).toBe(false);
        expect(isProjectFingerprintCurrent(current, {
            fingerprint: current.fingerprint,
            scannerVersion: 'scanner-v0',
        })).toBe(false);
    });
});
