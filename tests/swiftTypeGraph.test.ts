import { describe, expect, it } from 'vitest';
import { buildSwiftTypeGraph } from '../src/app/main/swiftTypeGraph.js';

const root = '/project';

function swiftFile(name: string): string {
    return `${root}/${name}.swift`;
}

function graph(sources: Record<string, string>) {
    const files = Object.keys(sources).map(swiftFile);
    const fileSources = new Map(files.map(file => {
        const name = file.slice(root.length + 1, -'.swift'.length);
        return [file, sources[name]!] as const;
    }));
    return buildSwiftTypeGraph(files, fileSources);
}

describe('Swift type-reference graph', () => {
    it('cree un edge quand un struct local est reference depuis un autre fichier', () => {
        expect(graph({
            DashboardView: 'struct DashboardView: View { var body: some View { Text("Dashboard") } }',
            App:           'struct AppRoot: View { var body: some View { DashboardView() } }',
        })).toEqual([
            { from: swiftFile('App'), to: swiftFile('DashboardView') },
        ]);
    });

    it('cree un edge pour une classe utilisee via constructeur', () => {
        expect(graph({
            BLEManager: 'class BLEManager {}',
            App:        'final class AppModel { let manager = BLEManager() }',
        })).toEqual([
            { from: swiftFile('App'), to: swiftFile('BLEManager') },
        ]);
    });

    it('cree un edge pour une annotation de type', () => {
        expect(graph({
            BLEFrameParser: 'enum BLEFrameParser {}',
            BLEManager:     'final class BLEManager { let parser: BLEFrameParser }',
        })).toEqual([
            { from: swiftFile('BLEManager'), to: swiftFile('BLEFrameParser') },
        ]);
    });

    it('cree un edge pour un appel statique', () => {
        expect(graph({
            BLEFrameParser: 'enum BLEFrameParser { static func parse() {} }',
            BLEManager:     'final class BLEManager { func read() { BLEFrameParser.parse() } }',
        })).toEqual([
            { from: swiftFile('BLEManager'), to: swiftFile('BLEFrameParser') },
        ]);
    });

    it('cree un edge pour une conformance vers un protocole local', () => {
        expect(graph({
            LocalProtocol: 'protocol LocalProtocol {}',
            FeatureView:   'struct FeatureView: LocalProtocol {}',
        })).toEqual([
            { from: swiftFile('FeatureView'), to: swiftFile('LocalProtocol') },
        ]);
    });

    it('ignore les types systeme SwiftUI et Foundation', () => {
        expect(graph({
            App: 'struct AppRoot: View { let name: String; let data: Data; let task: Task<Void, Error>?; let url: URL }',
        })).toEqual([]);
    });

    it('ignore les references dans les commentaires', () => {
        expect(graph({
            BLEManager: 'class BLEManager {}',
            App:        'struct AppRoot { // BLEManager should not count\n }',
        })).toEqual([]);
    });

    it('ignore les references dans les strings', () => {
        expect(graph({
            BLEManager: 'class BLEManager {}',
            App:        'struct AppRoot { let label = "BLEManager" }',
        })).toEqual([]);
    });

    it('ne cree pas d edge pour un type defini et utilise dans le meme fichier', () => {
        expect(graph({
            BLEManager: 'class BLEManager { func make() -> BLEManager { BLEManager() } }',
        })).toEqual([]);
    });

    it('ignore les types ambigus definis dans plusieurs fichiers', () => {
        expect(graph({
            FeatureA: 'struct SharedModel {}',
            FeatureB: 'struct SharedModel {}',
            App:      'struct AppRoot { let model: SharedModel }',
        })).toEqual([]);
    });

    it('dedoublonne les references multiples au meme type', () => {
        expect(graph({
            BLEManager: 'class BLEManager {}',
            App:        'struct AppRoot { let a = BLEManager(); let b: BLEManager }',
        })).toEqual([
            { from: swiftFile('App'), to: swiftFile('BLEManager') },
        ]);
    });

    it('ne matche pas les noms partiels', () => {
        expect(graph({
            BLEManager: 'class BLEManager {}',
            App:        'struct AppRoot { let mock = BLEManagerMock() }',
        })).toEqual([]);
    });
});
