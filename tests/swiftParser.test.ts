import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeSwiftFile } from '../src/cortex/analyzer/swiftParser.js';
import { analyzeFileSync } from '../src/cortex/analyzer/parser.js';
import { getFiles } from '../src/app/main/scanner.js';

let tmpDir: string;

function fixture(name: string, code: string): string {
    const filePath = path.join(tmpDir, name + '.swift');
    fs.writeFileSync(filePath, code, 'utf-8');
    return filePath;
}

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-swift-test-'));
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('analyzeSwiftFile — Swift', () => {
    it('detecte une fonction simple', () => {
        const metrics = analyzeSwiftFile(fixture('simple', `\
func parse(_ frame: BLEFrame) -> ParsedBLEFrame {
    return ParsedBLEFrame(frame: frame)
}
`));

        expect(metrics.language).toBe('swift');
        expect(metrics.totalFunctions).toBe(1);
        expect(metrics.functions[0]).toMatchObject({
            name: 'parse',
            parameterCount: 1,
            cyclomaticComplexity: 1,
            cognitiveComplexity: 0,
            maxDepth: 0,
        });
    });

    it('detecte private func, static func et override func', () => {
        const metrics = analyzeSwiftFile(fixture('modifiers', `\
class Controller {
    private func resetState() {
        logs.removeAll()
    }

    static func makeDefault() -> Controller {
        Controller()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
    }
}
`));

        expect(metrics.functions.map(f => f.name)).toEqual(['resetState', 'makeDefault', 'viewDidLoad']);
    });

    it('detecte init et override init', () => {
        const metrics = analyzeSwiftFile(fixture('initializers', `\
class Base {}

class Child: Base {
    init(name: String, age: Int) {
        self.name = name
    }

    override init() {
        super.init()
    }
}
`));

        expect(metrics.functions.map(f => f.name)).toEqual(['init', 'init']);
        expect(metrics.functions[0]?.parameterCount).toBe(2);
        expect(metrics.functions[1]?.parameterCount).toBe(0);
    });

    it('detecte une methode dans struct SomeView: View', () => {
        const metrics = analyzeSwiftFile(fixture('view_struct', `\
import SwiftUI

struct SomeView: View {
    var body: some View {
        Text(title())
    }

    private func title() -> String {
        "Hello"
    }
}
`));

        expect(metrics.functions.map(f => f.name)).toEqual(['title']);
    });

    it('detecte des methodes dans class, enum et extension', () => {
        const metrics = analyzeSwiftFile(fixture('containers', `\
class Service {
    func load() {}
}

enum Parser {
    static func parse() {}
}

extension Service {
    func refresh() {}
}
`));

        expect(metrics.functions.map(f => f.name)).toEqual(['load', 'parse', 'refresh']);
    });

    it('compte les parametres multiples', () => {
        const metrics = analyzeSwiftFile(fixture('params', `\
func connect(to peripheral: CBPeripheral, name: String, rssi: Int?) {
    print(name)
}
`));

        expect(metrics.functions[0]?.parameterCount).toBe(3);
    });

    it('calcule profondeur et complexite via accolades et ruptures de flux', () => {
        const metrics = analyzeSwiftFile(fixture('complexity', `\
func classify(_ value: Int) -> String {
    guard value > 0 else {
        return "empty"
    }

    if value > 10 && value < 20 {
        for item in 0..<value {
            if item == 3 {
                return "three"
            }
        }
    }

    switch value {
    case 1:
        return "one"
    case 2:
        return "two"
    default:
        return "other"
    }
}
`));

        const fn = metrics.functions[0]!;
        expect(fn.cyclomaticComplexity).toBeGreaterThanOrEqual(9);
        expect(fn.cognitiveComplexity).toBeGreaterThan(fn.cyclomaticComplexity);
        expect(fn.maxDepth).toBeGreaterThanOrEqual(3);
    });

    it('compte catch dans la complexite', () => {
        const metrics = analyzeSwiftFile(fixture('catching', `\
func load() {
    do {
        try fetch()
    } catch {
        print(error)
    }
}
`));

        expect(metrics.functions[0]?.cyclomaticComplexity).toBe(2);
    });

    it("ne compte pas une closure anonyme comme fonction nommee", () => {
        const metrics = analyzeSwiftFile(fixture('closure', `\
func load() {
    items.map { item in
        item.name
    }
}
`));

        expect(metrics.functions.map(f => f.name)).toEqual(['load']);
    });

    it('branche le parser Swift depuis analyzeFileSync', () => {
        const metrics = analyzeFileSync(fixture('entry', `\
func start() {
    print("ok")
}
`));

        expect(metrics.language).toBe('swift');
        expect(metrics.functions[0]?.name).toBe('start');
    });

    it('inclut les fichiers .swift dans getFiles', () => {
        const filePath = fixture('scannable', 'func run() {}\n');

        expect(getFiles(tmpDir, [])).toContain(filePath);
    });
});
