import fs from 'node:fs';
import path from 'node:path';
import { getFiles } from '../../app/main/scanner.js';

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Category = 'secret' | 'injection' | 'crypto' | 'xss' | 'misc';

export interface SecurityFinding {
    filePath: string;
    line:     number;
    rule:     string;
    severity: Severity;
    category: Category;
    message:  string;
    snippet:  string;
}

export interface AuditVuln {
    name:         string;
    severity:     Severity;
    via:          string[];
    range:        string;
    fixAvailable: boolean;
    cves:         string[];
}

export interface SecurityScanResult {
    findings:  SecurityFinding[];
    audit: {
        status:  'ok' | 'error' | 'not_run';
        vulns:   AuditVuln[];
        counts:  { critical: number; high: number; moderate: number; low: number; info: number; total: number };
        error?:  string;
    };
    scannedAt: string;
}

// ── RÈGLES ────────────────────────────────────────────────────────────────────

interface Rule {
    id:         string;
    pattern:    RegExp;
    severity:   Severity;
    category:   Category;
    message:    string;
    languages?: string[];
    skip?:      (line: string, match: RegExpExecArray) => boolean;
    skipFile?:  (filePath: string) => boolean;
}

const RULES: Rule[] = [
    // ── Secrets ──────────────────────────────────────────────────────────────
    {
        id: 'hardcoded-secret',
        pattern: /(?:password|passwd|pwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["']([^"']{6,})["']/i,
        severity: 'critical', category: 'secret',
        message: 'Potential hardcoded secret — move to environment variable.',
        skip: (line, match) => {
            const l = line.toLowerCase();
            if (l.includes('example') || l.includes('placeholder') || l.includes('your_')
                || l.includes('xxx') || l.includes('todo') || l.includes('changeme')
                || l.trim().startsWith('//') || l.trim().startsWith('*') || l.trim().startsWith('#')) return true;
            // Ignorer les valeurs CSS
            const value = match[1] ?? '';
            if (value.startsWith('var(') || value.startsWith('rgba') || value.startsWith('rgb')
                || value.startsWith('#') || !/[a-zA-Z0-9]{4}/.test(value)) return true;
            // Ignorer les labels UI (mot capitalisé court)
            if (/^[A-Z][a-z]+$/.test(value) && value.length < 20) return true;
            return false;
        },
        skipFile: (filePath: string) => {
            // Ignorer les fichiers de tests — les mots de passe de fixtures ne sont pas des secrets
            const name = filePath.split('/').pop() ?? '';
            return name.startsWith('test_') || name.startsWith('test.') || name.includes('.test.') || name.includes('.spec.');
        },
    },
    {
        id: 'aws-access-key',
        pattern: /AKIA[0-9A-Z]{16}/,
        severity: 'critical', category: 'secret',
        message: 'AWS access key ID detected in source code.',
    },
    {
        id: 'github-token',
        pattern: /ghp_[a-zA-Z0-9]{36}/,
        severity: 'critical', category: 'secret',
        message: 'GitHub personal access token detected in source code.',
    },
    {
        id: 'private-key-block',
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
        severity: 'critical', category: 'secret',
        message: 'Private key block found in source code.',
    },
    {
        id: 'connection-string',
        pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^@\s"']+:[^@\s"']+@/i,
        severity: 'high', category: 'secret',
        message: 'Database connection string with embedded credentials.',
    },
    {
        id: 'console-log-sensitive',
        pattern: /console\.(?:log|debug|info)\s*\([^)]*(?:password|token|secret|apikey|credential)[^)]*\)/i,
        severity: 'medium', category: 'secret',
        message: 'Potentially sensitive data logged to console.',
        languages: ['typescript', 'javascript'],
        skip: (line) => line.trim().startsWith('//'),
    },

    // ── Injection ─────────────────────────────────────────────────────────────
    {
        id: 'eval-usage',
        pattern: /\beval\s*\(/,
        severity: 'high', category: 'injection',
        message: 'eval() executes arbitrary code — code injection risk.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
    {
        id: 'new-function',
        pattern: /new\s+Function\s*\(/,
        severity: 'high', category: 'injection',
        message: 'new Function() is equivalent to eval — code injection risk.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
    {
        id: 'exec-variable',
        pattern: /(?<![.\w])exec\s*\(\s*(?![`"'])/,
        severity: 'high', category: 'injection',
        message: 'exec() called with a variable — potential command injection.',
        languages: ['typescript', 'javascript'],
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
    {
        id: 'python-exec-eval',
        pattern: /\b(?:exec|eval)\s*\(\s*(?!["'])/,
        severity: 'high', category: 'injection',
        message: 'exec/eval with a variable — arbitrary code execution risk.',
        languages: ['python'],
        skip: (line) => line.trim().startsWith('#'),
    },
    {
        id: 'sql-concatenation',
        pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.{0,60}["'`]\s*\+/i,
        severity: 'high', category: 'injection',
        message: 'SQL query built by string concatenation — SQL injection risk. Use parameterized queries.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#'),
    },

    // ── XSS ──────────────────────────────────────────────────────────────────
    {
        id: 'dangerous-inner-html',
        pattern: /dangerouslySetInnerHTML/,
        severity: 'high', category: 'xss',
        message: 'dangerouslySetInnerHTML bypasses React XSS protection — sanitize content before use.',
        languages: ['typescript', 'javascript'],
    },
    {
        id: 'inner-html-assignment',
        pattern: /\.innerHTML\s*=/,
        severity: 'low', category: 'xss',
        message: 'Direct innerHTML assignment — verify that all user-supplied content is escaped.',
        languages: ['typescript', 'javascript'],
        skip: (line) => {
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) return true;
            // Ignorer si la ligne utilise une fonction d'échappement connue
            return /\bescape\s*\(|\bescapeHtml\s*\(|\bsanitize\s*\(|DOMPurify/.test(line);
        },
    },
    {
        id: 'document-write',
        pattern: /document\.write\s*\(/,
        severity: 'medium', category: 'xss',
        message: 'document.write() can introduce XSS vulnerabilities.',
        languages: ['typescript', 'javascript'],
        skip: (line) => line.trim().startsWith('//'),
    },

    // ── Crypto ────────────────────────────────────────────────────────────────
    {
        id: 'math-random-security',
        pattern: /Math\.random\s*\(\)/,
        severity: 'medium', category: 'crypto',
        message: 'Math.random() is not cryptographically secure — use crypto.randomBytes() for tokens or IDs.',
        languages: ['typescript', 'javascript'],
        skip: (line) => {
            const l = line.toLowerCase();
            return l.includes('color') || l.includes('position') || l.includes('animation')
                || l.includes('delay') || l.includes('jitter') || l.includes('test')
                || l.includes('mock') || l.trim().startsWith('//') || l.trim().startsWith('*');
        },
    },
    {
        id: 'weak-hash-md5',
        pattern: /\bmd5\s*\(/i,
        severity: 'medium', category: 'crypto',
        message: 'MD5 is cryptographically broken — use SHA-256 or stronger.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#'),
    },
    {
        id: 'weak-hash-sha1',
        pattern: /\bsha1\s*\(/i,
        severity: 'low', category: 'crypto',
        message: 'SHA-1 is deprecated — prefer SHA-256 or stronger.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#'),
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    {
        id: 'http-cleartext',
        pattern: /["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/,
        severity: 'low', category: 'misc',
        message: 'Cleartext HTTP URL — prefer HTTPS to prevent interception.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#'),
    },
    {
        id: 'disable-ssl-verify',
        pattern: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
        severity: 'high', category: 'misc',
        message: 'SSL/TLS certificate verification disabled — vulnerable to MITM attacks.',
        skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#'),
    },
    {
        id: 'debugger-statement',
        pattern: /^\s*debugger\s*;?\s*$/,
        severity: 'info', category: 'misc',
        message: 'debugger statement left in code.',
        languages: ['typescript', 'javascript'],
    },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function detectLang(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) return 'typescript';
    if (ext === '.py') return 'python';
    return 'unknown';
}

export const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ── SCAN FICHIER ──────────────────────────────────────────────────────────────

export function scanFileForPatterns(filePath: string, source: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lang  = detectLang(filePath);
    const lines = source.split('\n');

    for (const rule of RULES) {
        if (rule.languages && !rule.languages.includes(lang)) continue;

        const flags = 'g' + (rule.pattern.flags.includes('i') ? 'i' : '');
        const pat   = new RegExp(rule.pattern.source, flags);

        if (rule.skipFile?.(filePath)) continue;

        lines.forEach((line, idx) => {
            pat.lastIndex = 0;
            const match = pat.exec(line);
            if (!match) return;
            if (rule.skip?.(line, match)) return;

            findings.push({
                filePath,
                line:     idx + 1,
                rule:     rule.id,
                severity: rule.severity,
                category: rule.category,
                message:  rule.message,
                snippet:  line.trim().slice(0, 120),
            });
        });
    }

    return findings;
}

// ── SCAN PROJET ───────────────────────────────────────────────────────────────

export function scanProjectForPatterns(projectPath: string, ignoreList: string[] = []): SecurityFinding[] {
    const ALWAYS_SKIP = ['node_modules', '.git', 'out', 'dist', 'build', 'assets', '.vite', '__pycache__', 'venv', '.venv'];
    const ignore = [...new Set([...ALWAYS_SKIP, ...ignoreList])];
    const allFiles = getFiles(projectPath, ignore);
    // Exclure le scanner lui-même pour éviter les faux positifs sur ses propres patterns
    const files = allFiles.filter(f => !f.endsWith('patternScanner.ts') && !f.endsWith('patternScanner.js'));
    const all: SecurityFinding[] = [];

    for (const file of files) {
        try {
            const source = fs.readFileSync(file, 'utf-8');
            all.push(...scanFileForPatterns(file, source));
        } catch { /* illisible — skip */ }
    }

    all.sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || a.filePath.localeCompare(b.filePath));
    return all;
}
