import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildEdges, extractImports, resolveImport } from '../src/app/main/scanner.js';

const root = path.resolve('/project');

function p(...parts: string[]): string {
    return path.join(root, ...parts);
}

describe('import graph — imports relatifs JS/TS', () => {
    const fromFile = p('src', 'main.ts');
    const context = { projectPath: root };

    it('detecte les syntaxes relatives principales', () => {
        const source = `
import foo from "./foo";
const bar = require("./bar");
const baz = await import("./baz");
import "./setup";
export { qux } from "./qux";
export * from "./wildcard";
import external from "@/external";
`;

        expect(extractImports(fromFile, source)).toEqual([
            './foo',
            '@/external',
            './setup',
            './qux',
            './wildcard',
            './bar',
            './baz',
        ]);
    });

    it('construit des edges pour import classique, require et import dynamique', () => {
        const foo = p('src', 'foo.ts');
        const bar = p('src', 'bar.ts');
        const baz = p('src', 'baz.ts');
        const files = [fromFile, foo, bar, baz];
        const sources = new Map([
            [fromFile, 'import foo from "./foo";\nconst bar = require("./bar");\nconst baz = import("./baz");'],
            [foo, ''],
            [bar, ''],
            [baz, ''],
        ]);

        expect(buildEdges(files, sources)).toEqual([
            { from: fromFile, to: foo },
            { from: fromFile, to: bar },
            { from: fromFile, to: baz },
        ]);
    });

    it('construit des edges pour import side-effect et re-exports', () => {
        const setup = p('src', 'setup.ts');
        const named = p('src', 'named.ts');
        const wildcard = p('src', 'wildcard.ts');
        const files = [fromFile, setup, named, wildcard];
        const sources = new Map([
            [fromFile, 'import "./setup";\nexport { named } from "./named";\nexport * from "./wildcard";'],
            [setup, ''],
            [named, ''],
            [wildcard, ''],
        ]);

        expect(buildEdges(files, sources)).toEqual([
            { from: fromFile, to: setup },
            { from: fromFile, to: named },
            { from: fromFile, to: wildcard },
        ]);
    });

    it('ignore les imports non relatifs', () => {
        const files = [fromFile, p('src', 'foo.ts')];
        const sources = new Map([
            [fromFile, 'import x from "@/foo";\nconst react = require("react");\nimport("./foo");'],
            [p('src', 'foo.ts'), ''],
        ]);

        expect(buildEdges(files, sources)).toEqual([
            { from: fromFile, to: p('src', 'foo.ts') },
        ]);
    });

    it('resout alias @/ vers le dossier src du projet', () => {
        const target = p('src', 'components', 'Button.tsx');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import Button from "@/components/Button";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('resout alias ~/ vers le dossier src du projet', () => {
        const target = p('src', 'lib', 'utils.ts');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import { format } from "~/lib/utils";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('resout alias src/ vers le dossier src du projet', () => {
        const target = p('src', 'domain', 'foo.ts');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import { foo } from "src/domain/foo";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('ignore un alias non resolu', () => {
        const files = [fromFile];
        const sources = new Map([
            [fromFile, 'import Missing from "@/missing/File";'],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([]);
    });

    it.each(['react', 'lodash', '@tanstack/react-query', '@scope/pkg'])(
        'ignore import externe %s',
        specifier => {
            const files = [fromFile];
            const sources = new Map([
                [fromFile, `import value from "${specifier}";`],
            ]);

            expect(buildEdges(files, sources, context)).toEqual([]);
        },
    );

    it('ne resout pas hors du projectPath', () => {
        const outside = path.resolve('/outside/secret.ts');
        const files = [fromFile, outside];
        const sources = new Map([
            [fromFile, 'import secret from "../../outside/secret";'],
            [outside, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([]);
    });

    it.each(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])(
        'resout une extension implicite %s',
        ext => {
            const target = p('src', `foo${ext}`);
            expect(resolveImport(fromFile, './foo', new Set([fromFile, target]))).toBe(target);
        },
    );

    it.each(['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'])(
        'resout un fichier index %s',
        indexFile => {
            const target = p('src', 'foo', indexFile);
            expect(resolveImport(fromFile, './foo', new Set([fromFile, target]))).toBe(target);
        },
    );

    it('dedoublonne les edges identiques', () => {
        const foo = p('src', 'foo.ts');
        const files = [fromFile, foo];
        const sources = new Map([
            [fromFile, 'import foo from "./foo";\nexport { foo } from "./foo";\nconst again = require("./foo");'],
            [foo, ''],
        ]);

        expect(buildEdges(files, sources)).toEqual([{ from: fromFile, to: foo }]);
    });
});
