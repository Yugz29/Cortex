import path from 'node:path';
import { sanitizeSwiftSource } from '../../cortex/analyzer/swiftParser.js';
import type { FileEdge } from './scanner.js';

const TYPE_DEFINITION_RE = /\b(class|struct|enum|protocol|actor)\s+([A-Za-z_]\w*)\b/g;
const MIN_TYPE_NAME_LENGTH = 3;

const IGNORED_SWIFT_TYPES = new Set([
    'View',
    'String',
    'Int',
    'Double',
    'Float',
    'Bool',
    'Data',
    'Result',
    'Error',
    'URL',
    'UUID',
    'Date',
    'Task',
    'Any',
    'AnyObject',
    'AnyView',
    'Array',
    'Dictionary',
    'Set',
    'Optional',
    'Binding',
    'State',
    'ObservedObject',
    'StateObject',
    'EnvironmentObject',
    'Published',
    'Color',
    'Text',
    'Image',
    'Button',
    'VStack',
    'HStack',
    'ZStack',
    'List',
    'NavigationStack',
]);

function isSwiftFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.swift';
}

function isCandidateTypeName(typeName: string): boolean {
    return typeName.length >= MIN_TYPE_NAME_LENGTH && !IGNORED_SWIFT_TYPES.has(typeName);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTypeReference(source: string, typeName: string): boolean {
    const re = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(typeName)}(?![A-Za-z0-9_])`);
    return re.test(source);
}

export function buildSwiftTypeGraph(files: string[], fileSources: Map<string, string>): FileEdge[] {
    const swiftFiles = files.filter(isSwiftFile);
    if (swiftFiles.length === 0) return [];

    const sanitizedSources = new Map<string, string>();
    const definitionFilesByType = new Map<string, Set<string>>();

    for (const file of swiftFiles) {
        const source = fileSources.get(file);
        if (!source) continue;

        const sanitized = sanitizeSwiftSource(source);
        sanitizedSources.set(file, sanitized);

        TYPE_DEFINITION_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TYPE_DEFINITION_RE.exec(sanitized)) !== null) {
            const typeName = match[2]!;
            if (!isCandidateTypeName(typeName)) continue;

            const definingFiles = definitionFilesByType.get(typeName);
            if (definingFiles) definingFiles.add(file);
            else definitionFilesByType.set(typeName, new Set([file]));
        }
    }

    const definitions = [...definitionFilesByType.entries()]
        .filter(([, definingFiles]) => definingFiles.size === 1)
        .map(([typeName, definingFiles]) => ({
            typeName,
            definingFile: [...definingFiles][0]!,
        }));

    const edges: FileEdge[] = [];
    const seenEdges = new Set<string>();
    for (const file of swiftFiles) {
        const source = sanitizedSources.get(file);
        if (!source) continue;

        for (const { typeName, definingFile } of definitions) {
            if (file === definingFile) continue;
            if (!hasTypeReference(source, typeName)) continue;

            const edgeKey = `${file}\0${definingFile}`;
            if (seenEdges.has(edgeKey)) continue;
            seenEdges.add(edgeKey);
            edges.push({ from: file, to: definingFile });
        }
    }

    return edges;
}
