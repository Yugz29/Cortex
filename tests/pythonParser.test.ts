import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeWithTreeSitter } from '../src/cortex/analyzer/pythonParser.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

function fixture(name: string, code: string): string {
    const filePath = path.join(tmpDir, name + '.py');
    fs.writeFileSync(filePath, code, 'utf-8');
    return filePath;
}

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-py-test-'));
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('analyzeWithTreeSitter — Python', () => {

    it('classe avec méthodes (dont une inner class) : délimitation et filtrage self/cls', () => {
        const code = `\
class Animal:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def describe(self):
        if self.age > 10:
            return 'old'
        else:
            return 'young'

    class Inner:
        def inner_method(cls, x):
            for i in range(x):
                pass
`;
        const metrics = analyzeWithTreeSitter(fixture('nested_class', code));

        expect(metrics.language).toBe('python');
        expect(metrics.totalFunctions).toBe(3);

        const init = metrics.functions.find(f => f.name === '__init__')!;
        expect(init).toBeDefined();
        expect(init.parameterCount).toBe(2);   // name + age, self filtré
        expect(init.cyclomaticComplexity).toBe(1);
        expect(init.cognitiveComplexity).toBe(0);

        const describe_ = metrics.functions.find(f => f.name === 'describe')!;
        expect(describe_).toBeDefined();
        expect(describe_.parameterCount).toBe(0);  // self filtré
        expect(describe_.cyclomaticComplexity).toBe(2);  // base + if
        expect(describe_.cognitiveComplexity).toBe(3);   // if(+1) + else(+1) + nested block penalty

        const innerMethod = metrics.functions.find(f => f.name === 'inner_method')!;
        expect(innerMethod).toBeDefined();
        expect(innerMethod.parameterCount).toBe(1);  // cls filtré, x compte
        expect(innerMethod.cyclomaticComplexity).toBe(2);
        expect(innerMethod.maxDepth).toBe(2);
    });

    it('type hints génériques (dict[str, int]) : parameterCount correct', () => {
        const code = `\
def process(data: dict[str, list[int]], callback: callable) -> dict[str, int]:
    result: dict[str, int] = {}
    for key, values in data.items():
        result[key] = sum(values)
    return result
`;
        const metrics = analyzeWithTreeSitter(fixture('generic_hints', code));

        expect(metrics.totalFunctions).toBe(1);
        const fn = metrics.functions[0]!;
        expect(fn.name).toBe('process');
        // dict[str, list[int]] est un seul paramètre — pas de faux split sur la virgule
        expect(fn.parameterCount).toBe(2);   // data + callback
        expect(fn.cyclomaticComplexity).toBe(2); // base + for
        expect(fn.cognitiveComplexity).toBe(2);  // for(+1) en depth=1
        expect(fn.maxDepth).toBe(2);
    });

    it('fonction async : reconnue comme function_definition', () => {
        const code = `\
async def fetch_data(url: str, timeout: int = 30):
    if not url:
        raise ValueError('empty url')
    return await make_request(url, timeout)
`;
        const metrics = analyzeWithTreeSitter(fixture('async_fn', code));

        expect(metrics.totalFunctions).toBe(1);
        const fn = metrics.functions[0]!;
        expect(fn.name).toBe('fetch_data');
        expect(fn.parameterCount).toBe(2);          // url + timeout
        expect(fn.cyclomaticComplexity).toBe(2);    // base + if
        expect(fn.startLine).toBe(1);
        expect(fn.lineCount).toBe(4);
    });

    it('décorateur : function_definition commence à def, pas au décorateur', () => {
        const code = `\
@staticmethod
def compute(x: int, y: int) -> int:
    if x > y:
        return x - y
    return y - x
`;
        const metrics = analyzeWithTreeSitter(fixture('decorator', code));

        expect(metrics.totalFunctions).toBe(1);
        const fn = metrics.functions[0]!;
        expect(fn.name).toBe('compute');
        expect(fn.parameterCount).toBe(2);        // x + y
        expect(fn.cyclomaticComplexity).toBe(2);  // base + if
        expect(fn.cognitiveComplexity).toBe(2);   // if(+1) at depth=1
        expect(fn.startLine).toBe(2);             // def est à la ligne 2
    });

    it('fonction locale dans une fonction : métriques indépendantes, pas de double comptage', () => {
        const code = `\
def outer(a: int, b: int) -> int:
    def inner(x):
        if x > 0:
            return x
        return 0
    total = inner(a) + inner(b)
    if a and b:
        return total
    return 0
`;
        const metrics = analyzeWithTreeSitter(fixture('nested_fn', code));

        expect(metrics.totalFunctions).toBe(2);

        const outer = metrics.functions.find(f => f.name === 'outer')!;
        expect(outer).toBeDefined();
        expect(outer.parameterCount).toBe(2);
        // outer: if + boolean_operator(and) = 2 branches, base=1 → cyc=3
        expect(outer.cyclomaticComplexity).toBe(3);
        // inner n'est PAS comptée dans la complexité de outer
        expect(outer.cognitiveComplexity).toBe(4);

        const inner = metrics.functions.find(f => f.name === 'inner')!;
        expect(inner).toBeDefined();
        expect(inner.parameterCount).toBe(1);
        expect(inner.cyclomaticComplexity).toBe(2);  // base + if
        expect(inner.cognitiveComplexity).toBe(2);   // if(+1) at depth=1
    });

    it('totalLines correspond au nombre de lignes du fichier', () => {
        const code = 'def foo():\n    pass\n\ndef bar():\n    pass\n';
        const metrics = analyzeWithTreeSitter(fixture('two_fns', code));
        expect(metrics.totalLines).toBe(6); // 5 lignes + 1 ligne vide finale
        expect(metrics.totalFunctions).toBe(2);
    });

    it('paramètres *args et **kwargs comptés, self/cls filtrés', () => {
        const code = `\
def variadic(self, *args, **kwargs):
    pass
`;
        const metrics = analyzeWithTreeSitter(fixture('variadic', code));
        const fn = metrics.functions[0]!;
        expect(fn.parameterCount).toBe(2);  // args + kwargs, self filtré
    });

});
