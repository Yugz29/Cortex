/**
 * Génération des rapports d'export (Markdown + JSON).
 * Isolé de index.ts pour être testable indépendamment.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

export function metricExplain(name: string, raw: number, score: number): string {
    if (score < 30) return '';
    const level = score >= 60 ? 'critical' : 'elevated';
    const map: Record<string, string> = {
        complexity:   `Cyclomatic complexity of ${raw} (${level}) — structural load is being driven by branching complexity. This file is a strong candidate for review before further changes.`,
        cognitive:    `Cognitive complexity of ${raw} (${level}) — structural load is being driven by nesting or non-linear control flow. Review this file for readability and change cost.`,
        functionSize: `Largest function is ${raw} lines (${level}) — large routines are contributing to structural load and likely maintenance cost.`,
        churn:        `${raw} commits in the last 30 days (${level}) — recent change activity is a major part of this file's score. Repeated changes make it a candidate for review.`,
        depth:        `Nesting depth of ${raw} (${level}) — deep nesting is contributing to structural load and review friction.`,
        params:       `${raw} parameters on the largest function (${level}) — interface complexity is contributing to structural load.`,
        fanIn:        `Imported by ${raw} other files (${level}) — dependency centrality is high, so changes here may affect many other files.`,
    };
    return map[name] ?? '';
}

const LAYER_MAP: Record<string, { label: string; role: string }> = {
    'src/cortex/analyzer':         { label: 'analyzer',    role: 'AST parsing, complexity & churn metrics' },
    'src/cortex/risk-score':       { label: 'risk-score',  role: 'scoring pipeline, trend detection, reference baselines' },
    'src/cortex/watcher':          { label: 'watcher',     role: 'filesystem watch, debouncing' },
    'src/database':                { label: 'database',    role: 'SQLite persistence (scans, feedbacks, snapshots, migrations)' },
    'src/app/main':                { label: 'main',        role: 'Electron main process, IPC handlers, scan orchestration' },
    'src/app/preload':             { label: 'preload',     role: 'Electron contextBridge, IPC exposure to renderer' },
    'src/app/renderer/components': { label: 'components',  role: 'React UI components' },
    'src/app/renderer/hooks':      { label: 'hooks',       role: 'React custom hooks' },
    'src/app/renderer':            { label: 'renderer',    role: 'React renderer entry, types, i18n, utils' },
};

const ENTRY_POINT_PATTERNS = [
    /\/main\/index\.(ts|js)$/,
    /\/preload\/index\.(ts|js)$/,
    /\/renderer\/main\.(tsx|jsx|ts|js)$/,
    /electron\.vite\.config\.(ts|js)$/,
    /vite\.config\.(ts|js)$/,
    /vitest\.config\.(ts|js)$/,
    /tsconfig.*\.json$/,
];

// Modules utilitaires purs qui peuvent avoir fanIn=0 dans le code applicatif
// mais sont couverts par des tests unitaires (exclus du scan Cortex).
const UTILITY_MODULE_PATTERNS = [
    /\/cortex\/risk-score\//,
    /\/cortex\/analyzer\//,
];

function isEntryPoint(filePath: string): boolean {
    return ENTRY_POINT_PATTERNS.some(p => p.test(filePath));
}

function isDeadFile(s: any): boolean {
    if (isEntryPoint(s.filePath)) return false;
    if (UTILITY_MODULE_PATTERNS.some(p => p.test(s.filePath))) return false;
    return s.fanIn === 0 && s.fanOut === 0;
}

function getLayer(filePath: string, projectPath: string) {
    const rel = filePath.replace(projectPath + '/', '');
    for (const [prefix, info] of Object.entries(LAYER_MAP)) {
        if (rel.startsWith(prefix)) return info;
    }
    return null;
}

function topMetricKey(s: any): string {
    const candidates = [
        { key: 'cognitive_complexity', v: s.cognitiveComplexityScore ?? 0 },
        { key: 'complexity',           v: s.complexityScore ?? 0 },
        { key: 'function_size',        v: s.functionSizeScore ?? 0 },
        { key: 'churn',                v: s.churnScore ?? 0 },
        { key: 'depth',                v: s.depthScore ?? 0 },
        { key: 'fan_in',               v: s.fanIn > 0 ? Math.min(100, s.fanIn * 7) : 0 },
    ];
    return candidates.sort((a, b) => b.v - a.v)[0]?.key ?? '?';
}

function avgRisk(scans: any[]): number {
    return scans.length > 0 ? scans.reduce((acc, s) => acc + s.globalScore, 0) / scans.length : 0;
}

function fname(s: any): string {
    return s.filePath.split('/').pop() ?? s.filePath;
}

// ── Sections Markdown ─────────────────────────────────────────────────────────

function mdSummary(scans: any[], projName: string, date: string): string {
    const avg         = avgRisk(scans);
    const pressureLabel = avg >= 50 ? 'High pressure' : avg >= 20 ? 'Elevated' : 'Low pressure';
    const critical    = scans.filter(s => s.globalScore >= 50).length;
    const stressed    = scans.filter(s => s.globalScore >= 20 && s.globalScore < 50).length;
    const healthy     = scans.filter(s => s.globalScore < 20).length;
    const trendingUp  = scans.filter(s => s.trend === '↑').length;

    return [
        `# Cortex Report — ${projName}`,
        `_Generated by Cortex · ${date}_\n\n---\n`,
        `## Executive Summary\n`,
        `**Overall maintenance pressure: ${pressureLabel}** (score ${avg.toFixed(1)}/100)\n`,
        `| Metric | Value |\n|---|---|`,
        `| Total modules | ${scans.length} |`,
        `| High pressure (score ≥ 50) | ${critical} |`,
        `| Elevated (score 20–50) | ${stressed} |`,
        `| Low pressure (score < 20) | ${healthy} |`,
        `| Higher recent pressure | ${trendingUp} |\n`,
    ].join('\n');
}

function mdMetricsGuide(): string {
    return [
        `## How to Read This Report\n`,
        `Cortex uses these metrics as ranking signals for maintenance pressure. They help prioritize review, but they do not diagnose bugs or code quality on their own.\n`,
        `| Metric | What it measures | Why it matters |\n|---|---|---|`,
        `| Cyclomatic Complexity | Number of independent execution paths | Higher values increase structural load |`,
        `| Cognitive Complexity | How hard the code is to read | Higher values increase structural load and review cost |`,
        `| Function Size | Lines in the largest function | Larger routines often raise structural load |`,
        `| Churn | Commits in the last 30 days | High churn reflects repeated recent change activity |`,
        `| Nesting Depth | Max depth of nested blocks | Deep nesting adds structural load |`,
        `| Parameters | Max params in any function | Higher counts increase interface complexity |`,
        `| Fan-in | Files that import this one | High fan-in indicates dependency centrality |\n`,
    ].join('\n');
}

function mdCriticalFile(s: any): string {
    const trend  = s.trend === '↑' ? ' ↑ higher pressure' : s.trend === '↓' ? ' ↓ lower pressure' : '';
    const issues = [
        metricExplain('complexity',   s.rawComplexity,          s.complexityScore ?? 0),
        metricExplain('cognitive',    s.rawCognitiveComplexity, s.cognitiveComplexityScore ?? 0),
        metricExplain('functionSize', s.rawFunctionSize,        s.functionSizeScore ?? 0),
        metricExplain('churn',        s.rawChurn,               s.churnScore ?? 0),
        metricExplain('depth',        s.rawDepth,               s.depthScore ?? 0),
        metricExplain('params',       s.rawParams,              s.paramScore ?? 0),
        metricExplain('fanIn',        s.fanIn,                  s.fanIn >= 8 ? 70 : s.fanIn >= 5 ? 40 : 0),
    ].filter(Boolean);

    const lines = [
        `### ${fname(s)} — Maintenance Pressure ${s.globalScore.toFixed(1)}${trend}\n`,
        `\`${s.filePath}\`\n`,
    ];
    if (issues.length > 0) {
        lines.push(`**Signals contributing most:**\n`);
        issues.forEach(i => lines.push(`- ${i}`));
        lines.push('');
    }
    lines.push(`**Raw metrics:** cx ${s.rawComplexity} · cog ${s.rawCognitiveComplexity ?? '—'} · size ${s.rawFunctionSize}L · churn ${s.rawChurn} · depth ${s.rawDepth} · params ${s.rawParams} · fan-in ${s.fanIn}\n`);
    return lines.join('\n');
}

function mdCriticalSection(scans: any[]): string {
    const critical = scans.filter(s => s.globalScore >= 50).sort((a, b) => b.globalScore - a.globalScore);
    if (!critical.length) return '';
    return [
        `---\n\n## Critical Files (${critical.length})\n`,
        `These files score ≥ 50 and are the strongest candidates for near-term review.\n`,
        ...critical.map(mdCriticalFile),
    ].join('\n');
}

function mdStressedSection(scans: any[]): string {
    const stressed = scans.filter(s => s.globalScore >= 20 && s.globalScore < 50).sort((a, b) => b.globalScore - a.globalScore);
    if (!stressed.length) return '';

    const lines = [`---\n\n## Elevated Files (${stressed.length})\n`];
    const worsening = stressed.filter(s => s.trend === '↑');
    if (worsening.length) {
        lines.push(`**Higher recent pressure:**\n`);
        worsening.forEach(s => lines.push(`- **${fname(s)}** — score ${s.globalScore.toFixed(1)} ↑`));
        lines.push('');
    }
    const stable = stressed.filter(s => s.trend !== '↑');
    if (stable.length) {
        lines.push(`**Still in the elevated range:**\n`);
        stable.slice(0, 8).forEach(s => lines.push(`- ${fname(s)} — score ${s.globalScore.toFixed(1)} ${s.trend ?? '↔'}`));
        if (stable.length > 8) lines.push(`- _…and ${stable.length - 8} more_`);
        lines.push('');
    }
    return lines.join('\n');
}

function mdHotspotsSection(scans: any[]): string {
    const hotspots = scans.filter(s => s.hotspotScore > 50).sort((a, b) => b.hotspotScore - a.hotspotScore);
    if (!hotspots.length) return '';
    return [
        `---\n\n## Hotspots — Structural Load + Recent Change Activity\n`,
        `These files stand out because both structural load and recent change activity are high.\n`,
        ...hotspots.slice(0, 5).map(s => `- **${fname(s)}** — hotspot ${s.hotspotScore.toFixed(0)} · cx ${s.rawComplexity} · churn ${s.rawChurn}`),
        '',
    ].join('\n');
}

function mdHubsSection(scans: any[]): string {
    const hubs = scans.filter(s => s.fanIn >= 8).sort((a, b) => b.fanIn - a.fanIn);
    if (!hubs.length) return '';
    return [
        `---\n\n## Critical Hubs — High Dependency Centrality\n`,
        `These files stand out because many other files depend on them.\n`,
        ...hubs.slice(0, 5).map(s => `- **${fname(s)}** — imported by ${s.fanIn} files · maintenance pressure ${s.globalScore.toFixed(1)}`),
        '',
    ].join('\n');
}

function mdAiSection(scans: any[], projName: string): string {
    const avg         = avgRisk(scans);
    const pressureLabel = avg >= 50 ? 'High pressure' : avg >= 20 ? 'Elevated' : 'Low pressure';
    const critical    = scans.filter(s => s.globalScore >= 50).sort((a, b) => b.globalScore - a.globalScore);

    const lines = [
        `---\n\n## Context for AI Refactoring Assistant\n`,
        `> Copy and paste this section into Claude, GPT-4, or any AI assistant.\n`,
        `I have a ${projName} project analyzed by Cortex. Overall maintenance pressure: **${pressureLabel}** (score ${avg.toFixed(1)}/100). Cortex uses this score as a ranking signal, not a diagnosis.\n`,
    ];
    if (critical.length) {
        lines.push(`**Priority files for review:**\n`);
        critical.slice(0, 5).forEach((s, i) =>
            lines.push(`${i + 1}. \`${fname(s)}\` — maintenance pressure ${s.globalScore.toFixed(1)}, cx ${s.rawComplexity}, churn ${s.rawChurn}/30d, fan-in ${s.fanIn}`)
        );
        lines.push('');
    }
    lines.push(`Please review why these files stand out, identify which signals dominate, and suggest concrete review or refactoring options only where the signals support them.`);
    return lines.join('\n');
}

// ── Builders publics ──────────────────────────────────────────────────────────

function buildMarkdown(scans: any[], projectPath: string, projName: string, date: string, security?: any): string {
    return [
        mdSummary(scans, projName, date),
        mdMetricsGuide(),
        mdCriticalSection(scans),
        mdStressedSection(scans),
        mdHotspotsSection(scans),
        mdHubsSection(scans),
        mdSecuritySection(security),
        mdAiSection(scans, projName),
    ].join('\n');
}

function buildJson(scans: any[], projectPath: string, projName: string, date: string, security?: any): string {
    const avg         = avgRisk(scans);
    const critical    = scans.filter(s => s.globalScore >= 50);
    const stressed    = scans.filter(s => s.globalScore >= 20 && s.globalScore < 50);
    const activeScans = scans.filter(s => !isDeadFile(s) || s.globalScore >= 50);
    const deadFiles   = scans.filter(isDeadFile).map(s => s.filePath.replace(projectPath + '/', ''));

    const layerSummary: Record<string, { role: string; fileCount: number; avgRisk: number }> = {};
    for (const s of activeScans) {
        const layer = getLayer(s.filePath, projectPath);
        if (!layer) continue;
        if (!layerSummary[layer.label]) layerSummary[layer.label] = { role: layer.role, fileCount: 0, avgRisk: 0 };
        layerSummary[layer.label]!.fileCount++;
        layerSummary[layer.label]!.avgRisk += s.globalScore;
    }
    for (const k of Object.keys(layerSummary)) {
        const l = layerSummary[k]!;
        l.avgRisk = Math.round(l.avgRisk / l.fileCount * 10) / 10;
    }

    return JSON.stringify({
        meta: { project: projName, date, generatedBy: 'Cortex', version: '1.0', stack: ['TypeScript', 'Electron', 'React', 'SQLite', 'ts-morph'] },
        summary: {
            totalFiles:  scans.length,
            activeFiles: activeScans.length,
            deadFiles,
            critical:    critical.length,
            stressed:    stressed.length,
            healthy:     scans.filter(s => s.globalScore < 20).length,
            avgRisk:     parseFloat(avg.toFixed(1)),
            healthPct:   Math.round(Math.max(0, 100 - avg)),
            topPriorities: activeScans
                .filter(s => s.globalScore >= 50)
                .slice(0, 5)
                .map(s => ({
                    file:     s.filePath.replace(projectPath + '/', ''),
                    risk:     parseFloat(s.globalScore.toFixed(1)),
                    trend:    s.trend,
                    topIssue: topMetricKey(s),
                    lines:    s.rawFunctionSize,
                    fanIn:    s.fanIn,
                    layer:    getLayer(s.filePath, projectPath)?.label ?? 'unknown',
                })),
        },
        architecture: layerSummary,
        files: activeScans.map(s => ({
            file:     s.filePath.replace(projectPath + '/', ''),
            layer:    getLayer(s.filePath, projectPath)?.label ?? 'other',
            risk:     parseFloat(s.globalScore.toFixed(1)),
            status:   s.globalScore >= 50 ? 'critical' : s.globalScore >= 20 ? 'stressed' : 'healthy',
            trend:    s.trend,
            topIssue: topMetricKey(s),
            cx: s.rawComplexity, cog: s.rawCognitiveComplexity,
            lines: s.rawFunctionSize, depth: s.rawDepth,
            churn: s.rawChurn, fanIn: s.fanIn, fanOut: s.fanOut,
        })),
        security: security ? {
            scannedAt:     security.scannedAt,
            patternCount:  (security.findings ?? []).length,
            patterns:      (security.findings ?? []).map((f: any) => ({
                file:     f.filePath.split('/').slice(-3).join('/'),
                line:     f.line,
                rule:     f.rule,
                severity: f.severity,
                category: f.category,
                message:  f.message,
            })),
            audit: security.audit?.status === 'ok' ? {
                total:  security.audit.counts?.total ?? 0,
                counts: security.audit.counts,
                vulns:  (security.audit.vulns ?? []).map((v: any) => ({
                    name:     v.name,
                    severity: v.severity,
                    range:    v.range,
                    fix:      v.fixAvailable,
                    cves:     v.cves,
                })),
            } : { status: security.audit?.status ?? 'not_run' },
        } : null,
    }, null, 2);
}

function mdSecuritySection(security: any): string {
    if (!security) return '';

    const findings = security.findings ?? [];
    const audit    = security.audit;
    const scannedAt = security.scannedAt ? new Date(security.scannedAt).toLocaleString() : '';

    if (findings.length === 0 && (!audit || audit.counts?.total === 0)) return '';

    const lines = [`---\n\n## Security\n\n_Scanned ${scannedAt}_\n`, `Security findings are reported separately from Cortex's maintenance pressure score.\n`];

    // Patterns
    if (findings.length > 0) {
        const bySev = (sev: string) => findings.filter((f: any) => f.severity === sev);
        const counts = ['critical','high','medium','low','info']
            .map(s => { const n = bySev(s).length; return n > 0 ? `${n} ${s}` : ''; })
            .filter(Boolean).join(' · ');

        lines.push(`### Static Patterns — ${findings.length} finding${findings.length > 1 ? 's' : ''} (${counts})\n`);

        for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
            const group = bySev(sev);
            if (!group.length) continue;
            group.forEach((f: any) => {
                const rel = f.filePath.split('/').slice(-3).join('/');
                lines.push(`- **[${sev.toUpperCase()}]** \`${rel}:${f.line}\` — ${f.message}`);
                lines.push(`  \`${f.snippet}\``);
            });
        }
        lines.push('');
    } else {
        lines.push(`### Static Patterns\n\n✓ No patterns detected.\n`);
    }

    // Audit deps
    if (audit?.status === 'ok') {
        const total = audit.counts?.total ?? 0;
        if (total === 0) {
            lines.push(`### Dependency Audit\n\n✓ No known vulnerabilities in dependencies.\n`);
        } else {
            const c = audit.counts;
            lines.push(`### Dependency Audit — ${total} vulnerabilit${total > 1 ? 'ies' : 'y'}\n`);
            lines.push(`| Severity | Count |\n|---|---|`);
            for (const [k, v] of Object.entries(c)) {
                if (k === 'total' || !v) continue;
                lines.push(`| ${k} | ${v} |`);
            }
            lines.push('');
            (audit.vulns ?? []).forEach((v: any) => {
                const sev = v.severity === 'moderate' ? 'medium' : v.severity;
                lines.push(`- **[${sev.toUpperCase()}]** \`${v.name}\` — range \`${v.range}\`${v.fixAvailable ? ' _(fix available)_' : ''}`);
                if (v.cves?.length) lines.push(`  CVE: ${v.cves.join(', ')}`);
            });
            lines.push('');
        }
    }

    return lines.join('\n');
}

export function buildReport(scans: any[], projectPath: string, security?: any): { markdown: string; json: string } {
    const projName = projectPath.split('/').pop() ?? projectPath;
    const date     = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    return {
        markdown: buildMarkdown(scans, projectPath, projName, date, security),
        json:     buildJson(scans, projectPath, projName, date, security),
    };
}
