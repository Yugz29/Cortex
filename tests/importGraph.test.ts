import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildEdges, buildImportGraph, createImportResolveContext, extractImports, resolveImport } from '../src/app/main/scanner.js';

const root = path.resolve('/project');

function p(...parts: string[]): string {
    return path.join(root, ...parts);
}

function tempProject(configName: 'tsconfig.json' | 'jsconfig.json', configBody: unknown): string {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-import-paths-'));
    fs.writeFileSync(path.join(projectPath, configName), JSON.stringify(configBody), 'utf-8');
    return projectPath;
}

function pt(projectPath: string, ...parts: string[]): string {
    return path.join(projectPath, ...parts);
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

    it('resout un import relatif JS avec extension .js deja presente', () => {
        const manager = p('src', 'managers', 'base.ts');
        const target = p('src', 'utils', 'baseManager.js');
        const files = [manager, target];
        const sources = new Map([
            [manager, 'import { BaseManager } from "../utils/baseManager.js";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: manager, to: target },
        ]);
    });

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

    it('produit un diagnostic des imports extraits, ignores, resolus et non resolus', () => {
        const foo = p('src', 'foo.ts');
        const aliased = p('src', 'components', 'Button.tsx');
        const files = [fromFile, foo, aliased];
        const sources = new Map([
            [fromFile, [
                'import foo from "./foo";',
                'import Button from "@/components/Button";',
                'import Missing from "./missing";',
                'import AliasMissing from "~/missing";',
                'import React from "react";',
            ].join('\n')],
            [foo, ''],
            [aliased, ''],
        ]);

        const graph = buildImportGraph(files, sources, context);

        expect(graph.edges).toEqual([
            { from: fromFile, to: foo },
            { from: fromFile, to: aliased },
        ]);
        expect(graph.diagnostics).toMatchObject({
            totalImports:       5,
            relativeImports:    2,
            simpleAliasImports: 2,
            externalIgnored:    1,
            unresolvedImports:  2,
            edgesCreated:       2,
        });
        expect(graph.diagnostics.unresolvedExamples).toEqual([
            { filePath: fromFile, importPath: './missing', reason: 'target-not-scanned-or-excluded' },
            { filePath: fromFile, importPath: '~/missing', reason: 'target-not-scanned-or-excluded' },
        ]);
    });

    it('diagnostique un alias simple sans contexte', () => {
        const files = [fromFile];
        const sources = new Map([
            [fromFile, 'import Button from "@/components/Button";'],
        ]);

        const graph = buildImportGraph(files, sources);

        expect(graph.edges).toEqual([]);
        expect(graph.diagnostics).toMatchObject({
            totalImports:       1,
            relativeImports:    0,
            simpleAliasImports: 1,
            externalIgnored:    0,
            unresolvedImports:  1,
            edgesCreated:       0,
        });
        expect(graph.diagnostics.unresolvedExamples).toEqual([
            { filePath: fromFile, importPath: '@/components/Button', reason: 'alias-context-missing' },
        ]);
    });
});

describe('import graph — aliases tsconfig/jsconfig paths', () => {
    it('resout un paths simple @app/* vers src/app/*', () => {
        const projectPath = tempProject('tsconfig.json', {
            compilerOptions: {
                baseUrl: '.',
                paths: { '@app/*': ['src/app/*'] },
            },
        });
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const target = pt(projectPath, 'src', 'app', 'main.ts');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import { main } from "@app/main";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('resout un paths vers une cible .tsx', () => {
        const projectPath = tempProject('tsconfig.json', {
            compilerOptions: {
                baseUrl: '.',
                paths: { '@components/*': ['src/components/*'] },
            },
        });
        const fromFile = pt(projectPath, 'src', 'index.tsx');
        const target = pt(projectPath, 'src', 'components', 'Button.tsx');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import Button from "@components/Button";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('resout un paths avec baseUrl src', () => {
        const projectPath = tempProject('jsconfig.json', {
            compilerOptions: {
                baseUrl: 'src',
                paths: { '@core/*': ['core/*'] },
            },
        });
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const target = pt(projectPath, 'src', 'core', 'logger.ts');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import { logger } from "@core/logger";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('essaie les targets multiples et prend celle qui existe dans allFiles', () => {
        const projectPath = tempProject('tsconfig.json', {
            compilerOptions: {
                baseUrl: '.',
                paths: { '@shared/*': ['missing/*', 'src/shared/*'] },
            },
        });
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const target = pt(projectPath, 'src', 'shared', 'format.ts');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import { format } from "@shared/format";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('ignore un paths non resolu', () => {
        const projectPath = tempProject('tsconfig.json', {
            compilerOptions: {
                baseUrl: '.',
                paths: { '@app/*': ['src/app/*'] },
            },
        });
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const files = [fromFile];
        const sources = new Map([
            [fromFile, 'import Missing from "@app/missing";'],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([]);
    });

    it.each(['react', 'lodash', '@tanstack/react-query'])(
        'garde le package externe %s ignore avec paths',
        specifier => {
            const projectPath = tempProject('tsconfig.json', {
                compilerOptions: {
                    baseUrl: '.',
                    paths: { '@app/*': ['src/app/*'] },
                },
            });
            const fromFile = pt(projectPath, 'src', 'index.ts');
            const files = [fromFile];
            const sources = new Map([
                [fromFile, `import value from "${specifier}";`],
            ]);

            expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([]);
        },
    );

    it('continue sans erreur avec une config invalide et garde les aliases simples', () => {
        const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-import-paths-invalid-'));
        fs.writeFileSync(path.join(projectPath, 'tsconfig.json'), '{ invalid json', 'utf-8');
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const target = pt(projectPath, 'src', 'components', 'Button.tsx');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import Button from "@/components/Button";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });

    it('continue sans erreur sans config et garde les aliases simples', () => {
        const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-import-paths-absent-'));
        const fromFile = pt(projectPath, 'src', 'index.ts');
        const target = pt(projectPath, 'src', 'components', 'Button.tsx');
        const files = [fromFile, target];
        const sources = new Map([
            [fromFile, 'import Button from "@/components/Button";'],
            [target, ''],
        ]);

        expect(buildEdges(files, sources, createImportResolveContext(projectPath))).toEqual([
            { from: fromFile, to: target },
        ]);
    });
});

describe('import graph — imports relatifs Python', () => {
    const context = { projectPath: root };

    it('resout .routes depuis daemon_v2/main.py vers routes.py', () => {
        const fromFile = p('daemon_v2', 'main.py');
        const routes = p('daemon_v2', 'routes.py');
        const files = [fromFile, routes];
        const sources = new Map([
            [fromFile, 'from .routes import router'],
            [routes, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: routes },
        ]);
    });

    it('resout .analysis.projects vers analysis/projects.py', () => {
        const fromFile = p('daemon_v2', 'daily_trace.py');
        const projects = p('daemon_v2', 'analysis', 'projects.py');
        const files = [fromFile, projects];
        const sources = new Map([
            [fromFile, 'from .analysis.projects import build_project_trace'],
            [projects, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: projects },
        ]);
    });

    it('resout .event_bus dans un sous-package Python', () => {
        const fromFile = p('daemon', 'core', 'signal_scorer.py');
        const eventBus = p('daemon', 'core', 'event_bus.py');
        const files = [fromFile, eventBus];
        const sources = new Map([
            [fromFile, 'from .event_bus import publish'],
            [eventBus, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: eventBus },
        ]);
    });

    it('resout from . import models vers models.py', () => {
        const fromFile = p('backend', 'accounts', 'views.py');
        const models = p('backend', 'accounts', 'models.py');
        const files = [fromFile, models];
        const sources = new Map([
            [fromFile, 'from . import models'],
            [models, ''],
        ]);

        expect(extractImports(fromFile, sources.get(fromFile)!)).toEqual(['.models']);
        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: models },
        ]);
    });

    it('resout un import relatif Python qui remonte avec ..', () => {
        const fromFile = p('daemon', 'core', 'signal_scorer.py');
        const models = p('daemon', 'models.py');
        const files = [fromFile, models];
        const sources = new Map([
            [fromFile, 'from ..models import Signal'],
            [models, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: models },
        ]);
    });

    it('resout un package Python vers __init__.py', () => {
        const fromFile = p('daemon_v2', 'daily_trace.py');
        const init = p('daemon_v2', 'analysis', '__init__.py');
        const files = [fromFile, init];
        const sources = new Map([
            [fromFile, 'from .analysis import helpers'],
            [init, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: init },
        ]);
    });

    it('ignore un import relatif Python non resolu', () => {
        const fromFile = p('daemon_v2', 'main.py');
        const files = [fromFile];
        const sources = new Map([
            [fromFile, 'from .missing import router'],
        ]);

        const graph = buildImportGraph(files, sources, context);

        expect(graph.edges).toEqual([]);
        expect(graph.diagnostics).toMatchObject({
            totalImports:      1,
            relativeImports:   1,
            unresolvedImports: 1,
            edgesCreated:      0,
        });
        expect(graph.diagnostics.unresolvedExamples).toEqual([
            { filePath: fromFile, importPath: '.missing', reason: 'target-not-scanned-or-excluded' },
        ]);
    });
});

describe('import graph — imports absolus Python internes', () => {
    const context = { projectPath: root };

    it('resout from daemon.core.event_bus import X vers daemon/core/event_bus.py', () => {
        const fromFile = p('daemon', 'main.py');
        const eventBus = p('daemon', 'core', 'event_bus.py');
        const files = [fromFile, eventBus];
        const sources = new Map([
            [fromFile, 'from daemon.core.event_bus import EventBus'],
            [eventBus, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: eventBus },
        ]);
    });

    it('resout import daemon.core.event_bus vers daemon/core/event_bus.py', () => {
        const fromFile = p('daemon', 'main.py');
        const eventBus = p('daemon', 'core', 'event_bus.py');
        const files = [fromFile, eventBus];
        const sources = new Map([
            [fromFile, 'import daemon.core.event_bus'],
            [eventBus, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: eventBus },
        ]);
    });

    it('resout from core.event_bus import X vers core/event_bus.py si ce fichier existe', () => {
        const fromFile = p('app', 'main.py');
        const eventBus = p('core', 'event_bus.py');
        const files = [fromFile, eventBus];
        const sources = new Map([
            [fromFile, 'from core.event_bus import publish'],
            [eventBus, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: eventBus },
        ]);
    });

    it('resout from routes import router vers routes.py pres du fichier source', () => {
        const fromFile = p('daemon_v2', 'main.py');
        const routes = p('daemon_v2', 'routes.py');
        const files = [fromFile, routes];
        const sources = new Map([
            [fromFile, 'from routes import router'],
            [routes, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: routes },
        ]);
    });

    it('resout from models import User vers models.py pres du fichier source', () => {
        const fromFile = p('backend', 'accounts', 'views.py');
        const models = p('backend', 'accounts', 'models.py');
        const files = [fromFile, models];
        const sources = new Map([
            [fromFile, 'from models import User'],
            [models, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: models },
        ]);
    });

    it('resout un package Python absolu vers __init__.py', () => {
        const fromFile = p('daemon', 'main.py');
        const init = p('daemon', 'core', '__init__.py');
        const files = [fromFile, init];
        const sources = new Map([
            [fromFile, 'from daemon.core import EventBus'],
            [init, ''],
        ]);

        expect(buildEdges(files, sources, context)).toEqual([
            { from: fromFile, to: init },
        ]);
    });

    it.each(['fastapi', 'django', 'pydantic', 'requests'])(
        'garde le package externe %s ignore',
        specifier => {
            const fromFile = p('backend', 'main.py');
            const files = [fromFile];
            const sources = new Map([
                [fromFile, `from ${specifier} import value`],
            ]);

            const graph = buildImportGraph(files, sources, context);

            expect(graph.edges).toEqual([]);
            expect(graph.diagnostics).toMatchObject({
                totalImports:          1,
                pythonAbsoluteImports: 0,
                externalIgnored:       1,
                unresolvedImports:     0,
                edgesCreated:          0,
            });
        },
    );

    it('ignore un import absolu Python non resolu', () => {
        const fromFile = p('backend', 'main.py');
        const files = [fromFile];
        const sources = new Map([
            [fromFile, 'from missing_internal.module import value'],
        ]);

        const graph = buildImportGraph(files, sources, context);

        expect(graph.edges).toEqual([]);
        expect(graph.diagnostics).toMatchObject({
            totalImports:          1,
            pythonAbsoluteImports: 0,
            externalIgnored:       1,
            unresolvedImports:     0,
            edgesCreated:          0,
        });
    });

    it('diagnostique les imports absolus Python resolus comme internes', () => {
        const fromFile = p('daemon', 'main.py');
        const eventBus = p('daemon', 'core', 'event_bus.py');
        const files = [fromFile, eventBus];
        const sources = new Map([
            [fromFile, 'from daemon.core.event_bus import EventBus\nfrom fastapi import FastAPI'],
            [eventBus, ''],
        ]);

        const graph = buildImportGraph(files, sources, context);

        expect(graph.edges).toEqual([
            { from: fromFile, to: eventBus },
        ]);
        expect(graph.diagnostics).toMatchObject({
            totalImports:          2,
            pythonAbsoluteImports: 1,
            externalIgnored:       1,
            unresolvedImports:     0,
            edgesCreated:          1,
        });
    });
});
