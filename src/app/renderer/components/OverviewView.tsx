import React from 'react';
import type { Scan, Edge, SecurityScanResult } from '../types';
import { scoreColor, scoreColorHex, projectHealthStatus } from '../utils';
import { useLocale } from '../hooks/useLocale';
import type { TranslationKey } from '../i18n';
import ProjectSwitcher from './shared/ProjectSwitcher';

type FilterKey = 'critical' | 'stressed' | 'healthy' | null;

interface Project { path: string; name: string; addedAt: string; }
interface ProjectHealth { path: string; avgScore: number | null; }

interface Props {
  scans:           Scan[];
  edges:           Edge[];
  projectPath:     string;
  projectHistory:  { date: string; score: number }[];
  currentScore:    number;
  securityResult:  SecurityScanResult | null;
  projects:        Project[];
  projectsHealth:  ProjectHealth[];
  onSelectScan:    (scan: Scan) => void;
  onFilterChange:  (filter: FilterKey) => void;
  onGoToSecurity:  () => void;
  onSwitchProject: (path: string) => void;
  onAddProject:    () => void;
}

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function topMetric(s: Scan, t: T): { label: string; value: string; explain: string } {
  const candidates = [
    { score: s.churnScore,                    label: t('metric.highChurn'),      value: `${s.rawChurn} commits/30d`,       explain: t('explain.highChurn') },
    { score: s.complexityScore,               label: t('metric.highComplexity'), value: `cx ${s.rawComplexity}`,           explain: t('explain.highComplexity') },
    { score: s.cognitiveComplexityScore ?? 0, label: t('metric.hardToRead'),     value: `cog ${s.rawCognitiveComplexity}`, explain: t('explain.hardToRead') },
    { score: s.functionSizeScore,             label: t('metric.largeFunctions'), value: `${s.rawFunctionSize} lines`,      explain: t('explain.largeFunctions') },
    { score: s.depthScore,                    label: t('metric.deepNesting'),     value: `depth ${s.rawDepth}`,             explain: t('explain.deepNesting') },
    { score: s.fanIn > 0 ? Math.min(100, s.fanIn * 7) : 0, label: t('metric.widelyImported'), value: `${s.fanIn} ${t('overview.dependents')}`, explain: t('explain.widelyImported') },
  ].sort((a, b) => b.score - a.score);
  return candidates[0]!;
}

function generateSummary(scans: Scan[], critical: Scan[], stressed: Scan[], avgScore: number, t: T): string {
  if (!scans.length) return t('summary.noModules');

  if (critical.length === 0 && stressed.length === 0) {
    const improving = scans.filter(s => s.trend === '↓').length;
    if (improving > scans.length * 0.3)
      return `${t('summary.allHealthy', { n: scans.length })} ${improving} files are actively improving.`;
    return t('summary.allHealthy', { n: scans.length });
  }

  const parts: string[] = [];

  if (critical.length > 0) {
    const top = critical[0]!;
    const m   = topMetric(top, t);
    const key = critical.length > 1 ? 'summary.criticalMulti' : 'summary.criticalSingle';
    parts.push(t(key, { n: critical.length, file: top.filePath.split('/').pop() ?? '', metric: m.label.toLowerCase() }));
  }

  if (stressed.length > 0) {
    const trending   = stressed.filter(s => s.trend === '↑');
    const improving  = stressed.filter(s => s.trend === '↓');
    const filesWord  = t(trending.length > 1 ? 'summary.files' : 'summary.file');
    if (trending.length > 0)
      parts.push(t('summary.stressedWorse', { n: trending.length, files: filesWord }));
    else if (improving.length > 0)
      parts.push(`${improving.length} stressed ${t(improving.length > 1 ? 'summary.files' : 'summary.file')} ${t('overview.improving').toLowerCase()}.`);
    else
      parts.push(t('summary.stressedStable', { n: stressed.length, files: filesWord }));
  }

  if (avgScore >= 40)      parts.push(t('summary.healthDegraded'));
  else if (avgScore >= 20) parts.push(t('summary.healthModerate'));

  return parts.join(' ');
}

function fmtRelTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Trend sparkline (pleine largeur, un peu plus haute que le mini) ────────────
function TrendSparkline({ history }: { history: { date: string; score: number }[] }) {
  if (history.length < 2) return null;
  const W = 560, H = 56, pad = { t: 6, r: 4, b: 14, l: 36 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const scores = history.map(h => h.score);
  const min    = Math.max(0,   Math.min(...scores) - 5);
  const max    = Math.min(100, Math.max(...scores) + 5);
  const range  = max - min || 1;
  const px = (i: number) => pad.l + (i / (scores.length - 1)) * iW;
  const py = (s: number) => pad.t + (1 - (s - min) / range) * iH;
  const col     = scoreColorHex(scores[scores.length - 1] ?? 0);
  const pts     = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
  const first   = history[0]!;
  const last    = history[history.length - 1]!;
  const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const yMid    = (min + max) / 2;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {/* Y gridlines */}
      {[min, yMid, max].map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={py(v)} x2={W - pad.r} y2={py(v)} stroke="var(--border)" strokeWidth="0.5" />
          <text x={pad.l - 5} y={py(v) + 3} fontSize="7" fill="var(--text-ghost)" textAnchor="end" fontFamily="'SF Mono','Menlo',monospace">
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <defs>
        <linearGradient id="og-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={col} stopOpacity="0.18" />
          <stop offset="100%" stopColor={col} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path
        d={`M ${px(0)},${py(scores[0]!)} ${scores.map((s, i) => `L ${px(i)},${py(s)}`).join(' ')} L ${px(scores.length - 1)},${H - pad.b} L ${px(0)},${H - pad.b} Z`}
        fill="url(#og-grad)"
      />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
      {/* End dot */}
      <circle cx={px(scores.length - 1)} cy={py(scores[scores.length - 1]!)} r="3" fill={col} opacity="0.95" />
      {/* Baseline */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" strokeWidth="0.5" />
      {/* X labels */}
      <text x={px(0)}               y={H - 2} fontSize="7" fill="var(--text-ghost)" textAnchor="start"  fontFamily="'SF Mono','Menlo',monospace">{fmtDate(first.date)}</text>
      <text x={px(scores.length-1)} y={H - 2} fontSize="7" fill="var(--text-ghost)" textAnchor="end"    fontFamily="'SF Mono','Menlo',monospace">{fmtDate(last.date)}</text>
    </svg>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function OverviewView({
  scans, projectHistory, currentScore, projectPath,
  projects, projectsHealth,
  securityResult, onSelectScan, onFilterChange, onGoToSecurity,
  onSwitchProject, onAddProject,
}: Props) {

  // ── Badges sécurité ──────────────────────────────────────────────────────────
  const securityBadges = (() => {
    if (!securityResult) return null;
    const patterns = securityResult.findings ?? [];
    const critPat  = patterns.filter(f => f.severity === 'critical').length;
    const highPat  = patterns.filter(f => f.severity === 'high').length;
    const medPat   = patterns.filter(f => f.severity === 'medium').length;
    const total    = patterns.length;
    const counts   = securityResult.audit.status === 'ok' ? securityResult.audit.counts : null;
    const critDep  = counts?.critical ?? 0;
    const highDep  = counts?.high     ?? 0;
    const modDep   = counts?.moderate ?? 0;
    const totalDep = counts?.total    ?? 0;
    const badgeFor = (n: number, label: string, critN: number, highN: number, modN: number) => {
      if (n === 0) return { label: `✓ ${label}`, color: '#34c759', bg: 'rgba(52,199,89,0.08)', border: 'rgba(52,199,89,0.25)' };
      if (critN > 0) return { label: `${critN} critical · ${label}`, color: '#ff453a', bg: 'rgba(255,69,58,0.10)', border: 'rgba(255,69,58,0.30)' };
      if (highN > 0) return { label: `${highN} high · ${label}`,     color: '#ff6b35', bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.30)' };
      if (modN  > 0) return { label: `${modN} moderate · ${label}`,  color: '#ff9f0a', bg: 'rgba(255,159,10,0.10)', border: 'rgba(255,159,10,0.30)' };
      return { label: `${n} low · ${label}`, color: '#a8c5da', bg: 'rgba(168,197,218,0.08)', border: 'rgba(168,197,218,0.25)' };
    };
    return {
      patterns: badgeFor(total,    'patterns', critPat, highPat, medPat),
      deps:     counts ? badgeFor(totalDep, 'deps', critDep, highDep, modDep) : null,
    };
  })();

  const { t } = useLocale();
  const sorted   = [...scans].sort((a, b) => b.globalScore - a.globalScore);
  const critical = sorted.filter(s => s.globalScore >= 50);
  const stressed = sorted.filter(s => s.globalScore >= 20 && s.globalScore < 50);
  const healthy  = sorted.filter(s => s.globalScore < 20);
  const prevScore = projectHistory.length >= 2 ? projectHistory[projectHistory.length - 2]!.score : null;
  const delta     = prevScore !== null ? currentScore - prevScore : null;

  const hs          = projectHealthStatus(currentScore > 0 ? currentScore : null);
  const healthColor = hs.colorHex;
  const healthLabel = hs.label;
  const summary     = generateSummary(scans, critical, stressed, currentScore, t);

  // Dernière analyse — le scannedAt le plus récent parmi tous les scans
  const lastScanAt = scans.reduce<string | null>((acc, s) => {
    if (!acc) return s.scannedAt;
    return s.scannedAt > acc ? s.scannedAt : acc;
  }, null);

  const topRisks = [...critical.slice(0, 4), ...stressed.filter(s => s.trend === '↑').slice(0, 2)].slice(0, 5);
  const hotspots = [...scans].filter(s => s.hotspotScore > 0).sort((a, b) => b.hotspotScore - a.hotspotScore).slice(0, 3);
  const hubs     = [...scans].filter(s => s.fanIn >= 5).sort((a, b) => b.fanIn - a.fanIn).slice(0, 3);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>

      {/* ── Header : santé + score ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 24 }}>

        {/* Gauche : pill + barre + summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <ProjectSwitcher
              projectPath={projectPath}
              projects={projects}
              projectsHealth={projectsHealth}
              healthColor={healthColor}
              currentScore={currentScore}
              onSwitchProject={onSwitchProject}
              onAddProject={onAddProject}
            />
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
              color: healthColor, background: `${healthColor}12`, border: `0.5px solid ${healthColor}28`,
            }}>
              {healthLabel.toUpperCase()}
            </span>
            {lastScanAt && (
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>
                {fmtRelTime(lastScanAt)}
              </span>
            )}
          </div>
          {scans.length > 0 && (
            <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1, marginBottom: 10, maxWidth: 420 }}>
              {critical.length > 0 && <div style={{ flex: critical.length, background: '#ff453a' }} />}
              {stressed.length > 0 && <div style={{ flex: stressed.length, background: '#ff9f0a', opacity: 0.85 }} />}
              {healthy.length  > 0 && <div style={{ flex: healthy.length,  background: '#34c759', opacity: 0.7 }} />}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 480, margin: 0 }}>
            {summary}
          </p>
        </div>

        {/* Droite : score + delta + badges sécurité */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 48, fontWeight: 200, color: healthColor, letterSpacing: '-3px', lineHeight: 1 }}>
              {currentScore.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-ghost)', marginBottom: 4 }}>/100</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
            {t('overview.riskScore')}
            {delta !== null && Math.abs(delta) > 0.1 && (
              <span style={{ color: delta > 0 ? '#ff453a' : '#34c759', marginLeft: 5 }}>
                {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
              </span>
            )}
          </div>
          {securityBadges && (
            <div style={{ marginTop: 10, display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {[securityBadges.patterns, securityBadges.deps].filter(Boolean).map((b, i) => (
                <button key={i} onClick={onGoToSecurity} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                  background: b!.bg, border: `0.5px solid ${b!.border}`,
                  color: b!.color, fontSize: 10, fontWeight: 500,
                  letterSpacing: '0.03em', fontFamily: 'inherit', transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M4.5 0.5L8.5 8.5H0.5L4.5 0.5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                    <line x1="4.5" y1="3.5" x2="4.5" y2="5.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    <circle cx="4.5" cy="7.2" r="0.5" fill="currentColor"/>
                  </svg>
                  {b!.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
        {([
          { label: t('card.critical'), value: critical.length, filter: 'critical' as FilterKey, color: critical.length > 0 ? 'var(--red)'    : 'var(--text-ghost)', border: critical.length > 0 ? 'rgba(255,69,58,0.25)'  : 'var(--border)', hoverBg: 'rgba(255,69,58,0.10)',  hoverBorder: 'rgba(255,69,58,0.50)'  },
          { label: t('card.stressed'), value: stressed.length, filter: 'stressed' as FilterKey, color: stressed.length > 0 ? 'var(--orange)' : 'var(--text-ghost)', border: stressed.length > 0 ? 'rgba(255,159,10,0.25)' : 'var(--border)', hoverBg: 'rgba(255,159,10,0.10)', hoverBorder: 'rgba(255,159,10,0.50)' },
          { label: t('card.healthy'),  value: healthy.length,  filter: 'healthy'  as FilterKey, color: healthy.length  > 0 ? 'var(--green)'  : 'var(--text-ghost)', border: healthy.length  > 0 ? 'rgba(52,199,89,0.25)'  : 'var(--border)', hoverBg: 'rgba(52,199,89,0.10)',  hoverBorder: 'rgba(52,199,89,0.50)'  },
          { label: t('card.modules'),  value: scans.length,    filter: null,                     color: 'var(--text-secondary)',                                       border: 'var(--border)',                                                   hoverBg: 'var(--bg-hover)',           hoverBorder: 'var(--border-hover)'   },
        ] as { label: string; value: number; filter: FilterKey; color: string; border: string; hoverBg: string; hoverBorder: string }[]).map(stat => {
          const clickable = stat.value > 0;
          return (
            <div key={stat.label}
              onClick={() => clickable && onFilterChange(stat.filter)}
              style={{ background: 'var(--bg-card)', border: `0.5px solid ${stat.border}`, borderRadius: 10, padding: '12px 14px', cursor: clickable ? 'pointer' : 'default', transition: 'background 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { if (!clickable) return; e.currentTarget.style.background = stat.hoverBg; e.currentTarget.style.borderColor = stat.hoverBorder; }}
              onMouseLeave={e => { if (!clickable) return; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = stat.border; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{stat.label}</span>
                {clickable && <span style={{ fontSize: 10, color: stat.color, opacity: 0.7 }}>{stat.filter !== null ? '→' : '×'}</span>}
              </div>
              <div style={{ fontSize: 30, fontWeight: 200, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* ── Trend sparkline ── */}
      {projectHistory.length >= 2 && (
        <div style={{ marginBottom: 24, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Trend
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>
              {projectHistory.length} scans
            </span>
          </div>
          <TrendSparkline history={projectHistory} />
        </div>
      )}

      {/* ── Top risks ── */}
      {topRisks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>{t('overview.topRisks')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topRisks.map(s => {
              const m      = topMetric(s, t);
              const col    = scoreColor(s.globalScore);
              const colHex = scoreColorHex(s.globalScore);
              const name   = s.filePath.split('/').pop() ?? '';
              const parts  = s.filePath.split('/');
              const dir    = parts.length >= 2 ? parts[parts.length - 2] : '';
              return (
                <div key={s.filePath} onClick={() => onSelectScan(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', border: `0.5px solid var(--border)`, borderLeft: `3px solid ${colHex}`, borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${colHex}12`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'SF Mono','Menlo',monospace" }}>{name}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>{dir}/</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 500, background: `${colHex}18`, color: col, border: `0.5px solid ${colHex}35` }}>{m.label}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'SF Mono','Menlo',monospace" }}>{m.value}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{m.explain}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 200, color: col, letterSpacing: '-1px', lineHeight: 1 }}>{s.globalScore.toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: s.trend === '↑' ? 'var(--red)' : s.trend === '↓' ? 'var(--green)' : 'var(--text-ghost)' }}>{s.trend}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hotspots + Hubs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Hotspots */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{t('overview.hotspots')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>{t('overview.hotspotDesc')}</div>
          {hotspots.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', fontStyle: 'italic', padding: '6px 0' }}>No hotspots detected.</div>
          ) : hotspots.map(s => {
            const name = s.filePath.split('/').pop() ?? '';
            const hs   = Math.min(s.hotspotScore, 150);
            const col  = hs >= 60 ? '#ff453a' : '#ff9f0a';
            return (
              <div key={s.filePath} onClick={() => onSelectScan(s)} style={{ marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace" }}>{name}</span>
                  <span style={{ fontSize: 11, color: col, fontFamily: "'SF Mono','Menlo',monospace" }}>{hs.toFixed(0)}</span>
                </div>
                <div style={{ height: 2, background: 'var(--score-bar-bg)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(hs / 150) * 100}%`, background: col, borderRadius: 1 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hubs */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{t('overview.hubs')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>{t('overview.hubDesc')}</div>
          {hubs.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', fontStyle: 'italic', padding: '6px 0' }}>No critical hubs detected.</div>
          ) : hubs.map(s => {
            const name = s.filePath.split('/').pop() ?? '';
            const col  = s.fanIn > 10 ? '#ff453a' : '#ff9f0a';
            return (
              <div key={s.filePath} onClick={() => onSelectScan(s)} style={{ marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace" }}>{name}</span>
                  <span style={{ fontSize: 11, color: col, fontFamily: "'SF Mono','Menlo',monospace" }}>{s.fanIn} {t('overview.dependents')}</span>
                </div>
                <div style={{ height: 2, background: 'var(--score-bar-bg)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (s.fanIn / 15) * 100)}%`, background: col, borderRadius: 1 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── État vide ── */}
      {scans.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{t('overview.awaiting')}</div>
        </div>
      )}
    </div>
  );
}
