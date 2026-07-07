import * as fs from 'node:fs';
import type { FileMetrics, FunctionMetrics } from './parser.js';

const SWIFT_MODIFIER = 'public|private|fileprivate|internal|open|static|class|final|override|mutating|nonmutating|nonisolated|convenience|required';
const SIGNATURE_RE = new RegExp(
    `(^|\\n)([ \\t]*(?:(?:${SWIFT_MODIFIER})\\s+)*(?:(?:func)\\s+([A-Za-z_]\\w*)|init)\\s*(?:<[^>{}\\n]*>)?\\s*\\()`,
    'g',
);
const COMPUTED_PROPERTY_RE = new RegExp(
    `(^|\\n)((?:[ \\t]*@[^\\n]+\\n)*[ \\t]*(?:(?:@\\w+(?:\\([^\\n]*\\))?\\s+)|(?:(?:${SWIFT_MODIFIER})\\s+))*var\\s+([A-Za-z_]\\w*)\\s*:)`,
    'g',
);
const DECISION_RE = /\b(if|guard|for|while|switch|case|catch)\b|&&|\|\||\?(?!\?)/g;

function sanitizeSwiftSource(source: string): string {
    let result = '';
    let mode: 'code' | 'line-comment' | 'block-comment' | 'string' = 'code';
    let escaped = false;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i]!;
        const next = source[i + 1];

        if (mode === 'line-comment') {
            if (ch === '\n') {
                mode = 'code';
                result += ch;
            } else {
                result += ' ';
            }
            continue;
        }

        if (mode === 'block-comment') {
            if (ch === '*' && next === '/') {
                result += '  ';
                i++;
                mode = 'code';
            } else {
                result += ch === '\n' ? '\n' : ' ';
            }
            continue;
        }

        if (mode === 'string') {
            result += ch === '\n' ? '\n' : ' ';
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                mode = 'code';
            }
            continue;
        }

        if (ch === '/' && next === '/') {
            result += '  ';
            i++;
            mode = 'line-comment';
            continue;
        }

        if (ch === '/' && next === '*') {
            result += '  ';
            i++;
            mode = 'block-comment';
            continue;
        }

        if (ch === '"') {
            result += ' ';
            mode = 'string';
            escaped = false;
            continue;
        }

        result += ch;
    }

    return result;
}

function lineStarts(source: string): number[] {
    const starts = [0];
    for (let i = 0; i < source.length; i++) {
        if (source[i] === '\n') starts.push(i + 1);
    }
    return starts;
}

function lineForIndex(starts: number[], index: number): number {
    let low = 0;
    let high = starts.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (starts[mid]! <= index) low = mid + 1;
        else high = mid - 1;
    }
    return high + 1;
}

function findMatching(source: string, openIndex: number, openChar: string, closeChar: string): number {
    let depth = 0;
    for (let i = openIndex; i < source.length; i++) {
        const ch = source[i];
        if (ch === openChar) depth++;
        if (ch === closeChar) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function splitTopLevelCommaList(source: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let round = 0;
    let square = 0;
    let angle = 0;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(') round++;
        else if (ch === ')') round = Math.max(0, round - 1);
        else if (ch === '[') square++;
        else if (ch === ']') square = Math.max(0, square - 1);
        else if (ch === '<') angle++;
        else if (ch === '>') angle = Math.max(0, angle - 1);
        else if (ch === ',' && round === 0 && square === 0 && angle === 0) {
            parts.push(source.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(source.slice(start));
    return parts;
}

function countParameters(parameterSource: string): number {
    return splitTopLevelCommaList(parameterSource)
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .length;
}

function selectorLabel(parameter: string): string {
    const trimmed = parameter.trim();
    if (!trimmed) return '';

    const firstToken = trimmed.match(/^([A-Za-z_]\w*|_)(?=\s|:)/)?.[1];
    if (!firstToken) return '';
    return firstToken + ':';
}

function swiftFunctionName(baseName: string, parameterSource: string): string {
    const labels = splitTopLevelCommaList(parameterSource)
        .map(selectorLabel)
        .filter(label => label.length > 0);

    if (labels.length <= 1) return baseName;
    return `${baseName}(${labels.join('')})`;
}

function countMatches(source: string, re: RegExp): number {
    re.lastIndex = 0;
    let count = 0;
    while (re.exec(source) !== null) count++;
    return count;
}

function computeBodyMetrics(body: string): Pick<FunctionMetrics, 'cyclomaticComplexity' | 'cognitiveComplexity' | 'maxDepth'> {
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;
    let depth = 0;
    let maxDepth = 0;

    for (const line of body.split('\n')) {
        const leadingClose = line.match(/^\s*}+/)?.[0]?.length ?? 0;
        depth = Math.max(0, depth - leadingClose);

        const decisions = countMatches(line, DECISION_RE);
        cyclomaticComplexity += decisions;
        if (decisions > 0) cognitiveComplexity += decisions * (1 + depth);

        for (const ch of line) {
            if (ch === '{') {
                depth++;
                maxDepth = Math.max(maxDepth, depth);
            } else if (ch === '}') {
                depth = Math.max(0, depth - 1);
            }
        }
    }

    return { cyclomaticComplexity, cognitiveComplexity, maxDepth };
}

export function analyzeSwiftFile(filePath: string): FileMetrics {
    const source = fs.readFileSync(filePath, 'utf-8');
    const sanitized = sanitizeSwiftSource(source);
    const starts = lineStarts(sanitized);
    const functions: FunctionMetrics[] = [];

    function addAnalyzableUnit(name: string, signatureStart: number, parameterStart: number, parameterEnd: number, bodyStart: number, bodyEnd: number): void {
        const startLine = lineForIndex(starts, signatureStart);
        const endLine = lineForIndex(starts, bodyEnd);
        const body = sanitized.slice(bodyStart + 1, bodyEnd);
        const metrics = computeBodyMetrics(body);

        functions.push({
            name,
            startLine,
            lineCount: endLine - startLine + 1,
            parameterCount: parameterStart >= 0 && parameterEnd >= 0
                ? countParameters(sanitized.slice(parameterStart + 1, parameterEnd))
                : 0,
            ...metrics,
        });
    }

    SIGNATURE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SIGNATURE_RE.exec(sanitized)) !== null) {
        const signatureStart = match.index + match[1]!.length;
        const baseName = match[3] ?? 'init';
        const parameterStart = sanitized.indexOf('(', signatureStart);
        if (parameterStart === -1) continue;

        const parameterEnd = findMatching(sanitized, parameterStart, '(', ')');
        if (parameterEnd === -1) continue;

        const bodyStart = sanitized.indexOf('{', parameterEnd);
        if (bodyStart === -1) continue;

        const bodyEnd = findMatching(sanitized, bodyStart, '{', '}');
        if (bodyEnd === -1) continue;

        const name = match[3]
            ? swiftFunctionName(baseName, sanitized.slice(parameterStart + 1, parameterEnd))
            : baseName;

        addAnalyzableUnit(name, signatureStart, parameterStart, parameterEnd, bodyStart, bodyEnd);

        SIGNATURE_RE.lastIndex = bodyEnd + 1;
    }

    COMPUTED_PROPERTY_RE.lastIndex = 0;
    while ((match = COMPUTED_PROPERTY_RE.exec(sanitized)) !== null) {
        const signatureStart = match.index + match[1]!.length;
        const name = match[3]!;
        const bodyStart = sanitized.indexOf('{', COMPUTED_PROPERTY_RE.lastIndex);
        if (bodyStart === -1) continue;
        if (sanitized.slice(COMPUTED_PROPERTY_RE.lastIndex, bodyStart).includes('\n')) continue;

        const bodyEnd = findMatching(sanitized, bodyStart, '{', '}');
        if (bodyEnd === -1) continue;

        addAnalyzableUnit(name, signatureStart, -1, -1, bodyStart, bodyEnd);

        COMPUTED_PROPERTY_RE.lastIndex = bodyEnd + 1;
    }

    functions.sort((a, b) => a.startLine - b.startLine);

    return {
        filePath,
        totalLines:     source.split('\n').length,
        totalFunctions: functions.length,
        functions,
        language:       'swift',
    };
}
