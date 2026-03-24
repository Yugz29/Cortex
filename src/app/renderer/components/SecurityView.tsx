import { useState } from 'react';
import type { SecurityScanResult, SecurityFinding, AuditVuln, Severity, Category } from '../types';
import SectionLabel from './shared/SectionLabel';

// ── COULEURS & LABELS ─────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
    critical: 'var(--red)',
    high:     '#ff6b35',
    medium:   'var(--orange)',
    low:      '#a8c5da',
    info:     'var(--text-muted)',
};

const SEV_BG: Record<Severity, string> = {
    critical: 'rgba(255,69,58,0.10)',
    high:     'rgba(255,107,53,0.10)',
    medium:   'rgba(255,159,10,0.10)',
    low:      'rgba(168,197,218,0.08)',
    info:     'rgba(255,255,255,0.04)',
};

const CAT_ICON: Record<Category, string> = {
    secret:    'S',
    injection: 'I',
    crypto:    'C',
    xss:       'X',
    misc:      '!',
};

const CAT_COLORS: Record<Category, string> = {
    secret:    'var(--red)',
    injection: '#ff6b35',
    crypto:    'var(--orange)',
    xss:       'var(--blue)',
    misc:      'var(--text-muted)',
};

const CAT_LABEL: Record<Category, string> = {
    secret:    'Secret',
    injection: 'Injection',
    crypto:    'Crypto',
    xss:       'XSS',
    misc:      'Misc',
};

// ── COMPOSANTS ────────────────────────────────────────────────────────────────

function SevBadge({ severity }: { severity: Severity }) {
    return (
        <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
            padding: '2px 6px', borderRadius: 3,
            color: SEV_COLOR[severity],
            background: SEV_BG[severity],
            border: `0.5px solid ${SEV_COLOR[severity]}40`,
            textTransform: 'uppercase' as const, flexShrink: 0,
            fontFamily: "'SF Mono','Menlo',monospace",
        }}>
            {severity}
        </span>
    );
}

function FindingRow({ finding, projectPath, onViewInCode }: {
    finding:      SecurityFinding;
    projectPath:  string;
    onViewInCode: (filePath: string, line: number, rule: string, finding: SecurityFinding) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const rel = finding.filePath.replace(projectPath + '/', '');

    return (
        <div
            onClick={() => setExpanded(e => !e)}
            style={{
                padding: '10px 16px',
                borderBottom: '0.5px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.1s',
                borderLeft: `2px solid ${SEV_COLOR[finding.severity]}`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                    width: 16, height: 16, borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${CAT_COLORS[finding.category]}18`,
                    color: CAT_COLORS[finding.category],
                    border: `0.5px solid ${CAT_COLORS[finding.category]}40`,
                    fontFamily: "'SF Mono','Menlo',monospace",
                    letterSpacing: 0,
                }}>{CAT_ICON[finding.category]}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {finding.message}
                </span>
                <SevBadge severity={finding.severity} />
                <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0, marginLeft: 4 }}>
                    {expanded ? '▲' : '▼'}
                </span>
            </div>

            {/* Méta-infos + bouton View in code sur la même ligne */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 10, fontFamily: "'SF Mono','Menlo',monospace" }}>
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{rel}</span>
                <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>:{finding.line}</span>
                <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>· {CAT_LABEL[finding.category]}</span>
                <button
                    onClick={e => { e.stopPropagation(); onViewInCode(finding.filePath, finding.line, finding.rule, finding); }}
                    style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 3, flexShrink: 0,
                        background: 'transparent', color: 'var(--blue)',
                        border: '0.5px solid rgba(10,132,255,0.25)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(10,132,255,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                    View in code
                </button>
            </div>

            {expanded && (
                <div style={{
                    marginTop: 8, padding: '8px 10px',
                    background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 4,
                    fontFamily: "'SF Mono','Menlo',monospace",
                    fontSize: 11, color: 'var(--text-secondary)',
                    overflowX: 'auto', whiteSpace: 'pre',
                }}>
                    {finding.snippet}
                </div>
            )}
        </div>
    );
}

function VulnRow({ vuln }: { vuln: AuditVuln }) {
    const [expanded, setExpanded] = useState(false);
    const sev = (vuln.severity === ('moderate' as any) ? 'medium' : vuln.severity) as Severity;

    return (
        <div
            onClick={() => setExpanded(e => !e)}
            style={{
                padding: '10px 16px',
                borderBottom: '0.5px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.1s',
                borderLeft: `2px solid ${SEV_COLOR[sev]}`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'SF Mono','Menlo',monospace", flex: 1 }}>
                    {vuln.name}
                </span>
                <SevBadge severity={sev} />
                {vuln.fixAvailable && (
                    <span style={{
                        fontSize: 9, color: 'var(--green)',
                        background: 'rgba(52,199,89,0.10)',
                        border: '0.5px solid rgba(52,199,89,0.25)',
                        padding: '2px 6px', borderRadius: 3,
                        letterSpacing: '0.06em', flexShrink: 0,
                    }}>
                        FIX AVAILABLE
                    </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0, marginLeft: 4 }}>
                    {expanded ? '▲' : '▼'}
                </span>
            </div>
            {expanded && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontFamily: "'SF Mono','Menlo',monospace", color: 'var(--text-muted)' }}>
                    {vuln.subdir && <span>in: <span style={{ color: 'var(--text-secondary)' }}>{vuln.subdir}/</span></span>}
                    {vuln.range && <span>range: <span style={{ color: 'var(--text-secondary)' }}>{vuln.range}</span></span>}
                    {vuln.via.length > 0 && <span>via: <span style={{ color: 'var(--text-secondary)' }}>{vuln.via.join(', ')}</span></span>}
                    {vuln.cves.length > 0 && (
                        <span>CVE:{' '}
                            {vuln.cves.map((cve, i) => (
                                <span key={i}>
                                    {i > 0 && ', '}
                                    {cve.startsWith('http') ? (
                                        <span
                                            onClick={e => { e.stopPropagation(); window.api.openExternal(cve); }}
                                            style={{ color: SEV_COLOR[sev], cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                            onMouseEnter={e => (e.currentTarget as HTMLSpanElement).style.opacity = '0.75'}
                                            onMouseLeave={e => (e.currentTarget as HTMLSpanElement).style.opacity = '1'}
                                        >{cve.replace('https://github.com/advisories/', 'GHSA-')}</span>
                                    ) : (
                                        <span style={{ color: SEV_COLOR[sev] }}>{cve}</span>
                                    )}
                                </span>
                            ))}
                        </span>
                    )}
                    {vuln.fixAvailable && (
                        <span style={{ color: 'var(--green)', marginTop: 2 }}>Run: npm audit fix</span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── VUE PRINCIPALE ────────────────────────────────────────────────────────────

interface Props {
    projectPath:     string;
    result:          SecurityScanResult | null;
    onResultChange:  (r: SecurityScanResult | null) => void;
    onViewInCode:    (filePath: string, line: number, rule: string, finding: SecurityFinding) => void;
    externalLoading?: boolean;
}

export default function SecurityView({ projectPath, result, onResultChange, onViewInCode, externalLoading = false }: Props) {
    const [loading,   setLoading]   = useState(false);
    const isLoading = loading || externalLoading;
    const [catFilter, setCatFilter] = useState<Category | 'all'>('all');
    const [activeTab, setActiveTab] = useState<'patterns' | 'audit'>('patterns');

    async function runScan() {
        setLoading(true);
        try {
            const r = await window.api.runSecurityScan(projectPath);
            onResultChange(r);
        } finally {
            setLoading(false);
        }
    }

    const findings = result?.findings ?? [];
    const filtered = catFilter === 'all' ? findings : findings.filter(f => f.category === catFilter);

    const counts = {
        critical: findings.filter(f => f.severity === 'critical').length,
        high:     findings.filter(f => f.severity === 'high').length,
        medium:   findings.filter(f => f.severity === 'medium').length,
        low:      findings.filter(f => f.severity === 'low').length,
        info:     findings.filter(f => f.severity === 'info').length,
    };

    const audCounts = result?.audit.counts ?? { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };

    const tabStyle = (tab: 'patterns' | 'audit'): React.CSSProperties => ({
        fontSize: 11, fontWeight: 500, padding: '9px 14px', cursor: 'pointer',
        border: 'none', background: 'transparent', letterSpacing: '0.05em',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
        borderBottom: activeTab === tab ? '1.5px solid var(--blue)' : '1.5px solid transparent',
        transition: 'color 0.15s', fontFamily: 'inherit',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '18px 24px 0', flexShrink: 0, borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            Security
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                            Static pattern analysis · Dependency audit (requires network)
                        </div>
                    </div>
                    <button
                        onClick={runScan}
                        disabled={isLoading || !projectPath}
                        style={{
                        fontSize: 11, fontWeight: 500, padding: '6px 16px', borderRadius: 6,
                        background: isLoading ? 'rgba(255,255,255,0.04)' : 'rgba(10,132,255,0.15)',
                        color:      isLoading ? 'var(--text-muted)' : 'var(--blue)',
                        border:     `0.5px solid ${isLoading ? 'var(--border)' : 'rgba(10,132,255,0.3)'}`,
                        cursor: isLoading ? 'default' : 'pointer',
                            transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                    >
                        {isLoading ? 'Scanning…' : result ? 'Re-scan' : 'Run scan'}
                    </button>
                </div>

                {/* Résumé des findings */}
                {result && (
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: findings.length === 0 ? 6 : 0 }}>
                            {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map(sev => {
                                const n = counts[sev];
                                if (n === 0) return null;
                                return (
                                    <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                                        <span style={{ fontWeight: 700, fontFamily: "'SF Mono','Menlo',monospace", color: SEV_COLOR[sev] }}>{n}</span>
                                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{sev}</span>
                                    </div>
                                );
                            })}
                            {findings.length === 0 && (
                                <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ No patterns detected</span>
                            )}
                        </div>

                        {/* Vulns de dépendances — affiché dans le header */}
                        {result.audit.status === 'ok' && result.audit.counts.total > 0 && (
                            <div
                                onClick={() => setActiveTab('audit')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: 10, cursor: 'pointer', marginTop: 4,
                                    color: 'var(--text-muted)',
                                }}
                            >
                                <span style={{
                                    color: result.audit.counts.critical > 0 ? 'var(--red)'
                                         : result.audit.counts.high    > 0 ? '#ff6b35'
                                         : 'var(--orange)',
                                }}>△</span>
                                <span
                                    style={{
                                        textDecoration: 'underline', textUnderlineOffset: 2, textDecorationColor: 'var(--border)',
                                        color: result.audit.counts.critical > 0 ? 'var(--red)'
                                             : result.audit.counts.high    > 0 ? '#ff6b35'
                                             : 'var(--orange)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget as HTMLSpanElement).style.opacity = '0.75'}
                                    onMouseLeave={e => (e.currentTarget as HTMLSpanElement).style.opacity = '1'}
                                >
                                    {result.audit.counts.total} {result.audit.counts.total === 1 ? 'vulnerability' : 'vulnerabilities'} found in dependencies
                                </span>
                            </div>
                        )}
                        {result.audit.status === 'ok' && result.audit.counts.total === 0 && findings.length === 0 && (
                            <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4 }}>✓ No dependency vulnerabilities either.</div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex' }}>
                    <button style={tabStyle('patterns')} onClick={() => setActiveTab('patterns')}>
                        PATTERNS {result ? `· ${findings.length}` : ''}
                    </button>
                    <button style={tabStyle('audit')} onClick={() => setActiveTab('audit')}>
                        DEPENDENCIES {(result?.audit.counts.total ?? 0) > 0 ? `· ${result!.audit.counts.total}` : ''}
                    </button>
                </div>
            </div>

            {/* Corps */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

                {!result && !isLoading && (
                    <div style={{ padding: '56px 24px', textAlign: 'center' }}>
    
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>No scan run yet.</div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                            Pattern analysis is fully local and instant. Dependency audit queries the npm advisory database and requires network access.
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                        Scanning files…
                    </div>
                )}

                {/* Patterns */}
                {result && !isLoading && activeTab === 'patterns' && (
                    <>
                        {findings.length > 0 && (
                            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(['all', 'secret', 'injection', 'crypto', 'xss', 'misc'] as const).map(cat => {
                                    const count = cat === 'all' ? findings.length : findings.filter(f => f.category === cat).length;
                                    if (count === 0 && cat !== 'all') return null;
                                    const active = catFilter === cat;
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => setCatFilter(cat)}
                                            style={{
                                                fontSize: 10, padding: '3px 10px', borderRadius: 20,
                                                border: `0.5px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                                                background: active ? 'rgba(10,132,255,0.12)' : 'transparent',
                                                color: active ? 'var(--blue)' : 'var(--text-muted)',
                                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                                            }}
                                        >
                                            {cat === 'all' ? `All · ${count}` : `${CAT_LABEL[cat as Category]} · ${count}`}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {filtered.length === 0 ? (
                            <div style={{ padding: '32px 24px', textAlign: 'center', fontSize: 11, color: 'var(--green)' }}>
                                ✓ No patterns detected.
                            </div>
                        ) : (
                            filtered.map((f, i) => <FindingRow key={i} finding={f} projectPath={projectPath} onViewInCode={onViewInCode} />)
                        )}
                    </>
                )}

                {/* Audit */}
                {result && !isLoading && activeTab === 'audit' && (
                    <>
                        {result.audit.status === 'not_run' && (
                            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Dependency audit not available.</div>
                                <div style={{ fontSize: 10, color: 'var(--text-faint)', maxWidth: 340, margin: '0 auto', lineHeight: 1.7 }}>
                                    {result.audit.reason ?? 'No compatible Node.js project found.'}
                                </div>
                            </div>
                        )}
                        {result.audit.status === 'error' && (
                            <div style={{ padding: '32px 24px' }}>
                                <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>Audit failed.</div>
                                {result.audit.error && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'SF Mono','Menlo',monospace", lineHeight: 1.6 }}>
                                        {result.audit.error}
                                    </div>
                                )}
                            </div>
                        )}
                        {result.audit.status === 'ok' && (
                            <>
                                {result.audit.counts.total === 0 ? (
                                    <div style={{ padding: '32px 24px', textAlign: 'center', fontSize: 11, color: 'var(--green)' }}>
                                        ✓ No known vulnerabilities in dependencies.
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                            {(['critical', 'high', 'moderate', 'low', 'info'] as const).map(sev => {
                                                const n = (audCounts as any)[sev] ?? 0;
                                                const displaySev = (sev === 'moderate' ? 'medium' : sev) as Severity;
                                                return (
                                                    <div key={sev} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                        <span style={{ fontSize: 20, fontWeight: 200, color: n > 0 ? SEV_COLOR[displaySev] : 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", lineHeight: 1 }}>{n}</span>
                                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize', letterSpacing: '0.06em' }}>{sev}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {result.audit.vulns.map((v, i) => <VulnRow key={i} vuln={v} />)}
                                        <div style={{ padding: '10px 16px', fontSize: 10, color: 'var(--text-faint)', borderTop: '0.5px solid var(--border)' }}>
                                            Source: npm advisory database · {new Date(result.scannedAt).toLocaleString()}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
