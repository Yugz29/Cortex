import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import type { FileMetrics, FunctionMetrics } from './parser.js';

const _require = createRequire(import.meta.url);

// ── TYPES LOCAUX TREE-SITTER ─────────────────────────────────────────────────
// Définis localement pour éviter une dépendance de type sur le module CJS.

interface Point { row: number; column: number; }

interface SyntaxNode {
    type:                  string;
    text:                  string;
    isNamed:               boolean;
    startPosition:         Point;
    endPosition:           Point;
    children:              SyntaxNode[];
    namedChildren:         SyntaxNode[];
    childForFieldName(fieldName: string): SyntaxNode | null;
    parent:                SyntaxNode | null;
}

interface Tree { rootNode: SyntaxNode; }

interface TSParser {
    setLanguage(language: object): void;
    parse(source: string): Tree;
}

// ── CHARGEMENT CJS VIA createRequire (ESM → CJS interop) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const _rawParser = _require('tree-sitter');
// tree-sitter exports the Parser constructor directly via module.exports
const TSParserCtor = (_rawParser?.default ?? _rawParser) as { new(): TSParser };

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const _rawPython = _require('tree-sitter-python');
const PythonLanguage = (_rawPython?.default ?? _rawPython) as object;

const _sharedParser = new TSParserCtor();
_sharedParser.setLanguage(PythonLanguage);

// ── MÉTRIQUES DE COMPLEXITÉ ───────────────────────────────────────────────────

// Contribuent à la complexité cyclomatique (+1 chacun, sauf base déjà à 1).
const CYCLOMATIC_TYPES = new Set([
    'if_statement',
    'elif_clause',
    'for_statement',
    'while_statement',
    'except_clause',
    'boolean_operator',       // and / or
    'conditional_expression', // x if c else y
]);

// Ruptures de flux comptées avec pénalité de profondeur : +(1 + depth).
const COGNITIVE_BREAK_TYPES = new Set([
    'if_statement',
    'elif_clause',
    'for_statement',
    'while_statement',
    'except_clause',
    'boolean_operator',
    'conditional_expression',
]);

// Ruptures de flux sans pénalité de profondeur : +1 flat.
const COGNITIVE_FLAT_TYPES = new Set([
    'else_clause',
    'finally_clause',
]);

// ── COLLECTE DES FONCTIONS ────────────────────────────────────────────────────
// Traverse tout l'arbre et retourne tous les nœuds function_definition,
// y compris les méthodes de classes, les fonctions imbriquées et les async def.

function collectFunctions(node: SyntaxNode): SyntaxNode[] {
    const result: SyntaxNode[] = [];
    if (node.type === 'function_definition') {
        result.push(node);
    }
    for (const child of node.namedChildren) {
        for (const fn of collectFunctions(child)) {
            result.push(fn);
        }
    }
    return result;
}

// ── COMPTAGE DES PARAMÈTRES ───────────────────────────────────────────────────
// Filtre self et cls. Supporte les type hints génériques (dict[str, int])
// car chaque paramètre est un nœud AST indépendant — pas de split sur virgule.

function getParamIdentifier(param: SyntaxNode): string | null {
    if (param.type === 'identifier') return param.text;
    // typed_parameter, default_parameter, typed_default_parameter,
    // list_splat_pattern, dictionary_splat_pattern — le premier enfant nommé
    // de type identifier est le nom du paramètre.
    for (const child of param.namedChildren) {
        if (child.type === 'identifier') return child.text;
    }
    return null;
}

function countParameters(parametersNode: SyntaxNode): number {
    let count = 0;
    for (const param of parametersNode.namedChildren) {
        // Séparateur de mot-clé (`*` seul) ou séparateur positionnel (`/`)
        if (param.type === 'keyword_separator' || param.type === 'positional_separator') continue;
        const name = getParamIdentifier(param);
        if (name === 'self' || name === 'cls') continue;
        count++;
    }
    return count;
}

// ── COMPLEXITÉ CYCLOMATIQUE ───────────────────────────────────────────────────
// Base = 1. +1 pour chaque nœud de décision.
// S'arrête aux fonctions imbriquées pour éviter le double comptage.

function walkCyclomatic(node: SyntaxNode, isRoot: boolean): number {
    if (!isRoot && node.type === 'function_definition') return 0;

    let count = CYCLOMATIC_TYPES.has(node.type) ? 1 : 0;
    for (const child of node.namedChildren) {
        count += walkCyclomatic(child, false);
    }
    return count;
}

// ── COMPLEXITÉ COGNITIVE ──────────────────────────────────────────────────────
// Modèle SonarSource : +(1 + depth) pour les ruptures de flux imbriquées,
// +1 flat pour else/finally.
// La profondeur est incrémentée à chaque nœud `block` (corps de if/for/while…),
// ce qui garantit qu'elif est évalué au même niveau que le if parent.

function walkCognitive(node: SyntaxNode, depth: number, isRoot: boolean): number {
    if (!isRoot && node.type === 'function_definition') return 0;

    let score = 0;

    if (COGNITIVE_BREAK_TYPES.has(node.type)) {
        score += 1 + depth;
    } else if (COGNITIVE_FLAT_TYPES.has(node.type)) {
        score += 1;
    }

    // On incrémente la profondeur uniquement en entrant dans un bloc de corps,
    // pas au niveau du nœud de contrôle lui-même. Ainsi elif_clause (enfant de
    // if_statement) est traité à la même profondeur que le if_statement.
    const nextDepth = node.type === 'block' ? depth + 1 : depth;

    for (const child of node.namedChildren) {
        score += walkCognitive(child, nextDepth, false);
    }
    return score;
}

// ── PROFONDEUR MAXIMALE ───────────────────────────────────────────────────────
// Profondeur réelle dans l'arbre AST, mesurée par le nombre de blocs imbriqués.

function walkMaxDepth(node: SyntaxNode, depth: number, isRoot: boolean): number {
    if (!isRoot && node.type === 'function_definition') return 0;

    let max = depth;
    const nextDepth = node.type === 'block' ? depth + 1 : depth;

    for (const child of node.namedChildren) {
        const childDepth = walkMaxDepth(child, nextDepth, false);
        if (childDepth > max) max = childDepth;
    }
    return max;
}

// ── ANALYSE PRINCIPALE ────────────────────────────────────────────────────────

export function analyzeWithTreeSitter(filePath: string): FileMetrics {
    const source = fs.readFileSync(filePath, 'utf-8');
    const tree   = _sharedParser.parse(source);
    const lines  = source.split('\n');

    const fnNodes = collectFunctions(tree.rootNode);

    const functions: FunctionMetrics[] = fnNodes.map(fn => {
        const nameNode = fn.childForFieldName('name');
        const name     = nameNode?.text ?? 'anonymous';

        const startLine = fn.startPosition.row + 1; // 1-indexed
        const lineCount = fn.endPosition.row - fn.startPosition.row + 1;

        const cyclomaticComplexity = 1 + walkCyclomatic(fn, true);

        const cognitiveComplexity = walkCognitive(fn, 0, true);

        const parametersNode  = fn.childForFieldName('parameters');
        const parameterCount  = parametersNode ? countParameters(parametersNode) : 0;

        const maxDepth = walkMaxDepth(fn, 0, true);

        return { name, startLine, lineCount, cyclomaticComplexity, cognitiveComplexity, parameterCount, maxDepth };
    });

    return {
        filePath,
        totalLines:     lines.length,
        totalFunctions: functions.length,
        functions,
        language:       'python',
    };
}
