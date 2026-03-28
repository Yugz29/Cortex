import { useState, useEffect, useRef, useCallback } from 'react';
import type { Scan, Edge, FunctionDetail } from '../types';
import { projectHealthStatus } from '../utils';
import { useLocale } from '../hooks/useLocale';
import { useLocalPref } from '../hooks/useLocalPref';
import ResizeHandle from './shared/ResizeHandle';
import Sidebar from './shared/Sidebar';
import ProjectTrendGraph from './shared/ProjectTrendGraph';
import ProjectSwitcher from './shared/ProjectSwitcher';
import GraphView from './GraphView';
import Detail from './Detail';
import CodeView from './CodeView';
import OverviewView from './OverviewView';
import HistoryView from './HistoryView';
import SettingsView from './SettingsView';
import SecurityView from './SecurityView';
import type { SecurityFinding, SecurityScanResult } from '../types';

interface Project { path: string; name: string; addedAt: string; }
interface ProjectHealth { path: string; avgScore: number | null; }

interface Props {
  scans:           Scan[];
  edges:           Edge[];
  projectPath:     string;
  projectHistory:  { date: string; score: number }[];
  events:          { message: string; level: string; type: string }[];
  selected:        Scan | null;
  projects:        Project[];
  projectsHealth:  ProjectHealth[];
  onSelectScan:    (scan: Scan | null) => void;
  onSwitchProject: (path: string) => void;
  onAddProject:    () => void;
  onOpenSettings:  () => void;
  settingsOpen:    boolean;
  sidebarOpen:     boolean;
  onExport:        () => void;
  exporting:       boolean;
}

export default function CortexView({
  scans, edges, projectPath, projectHistory, events, selected, projects, projectsHealth,
  onSelectScan, onSwitchProject, onAddProject, onOpenSettings, settingsOpen, sidebarOpen, onExport, exporting,
}: Props) {
  const { t } = useLocale();

  // ── Vue centrale ────────────────────────────────────────────────────────────
  const [centerView,     setCenterView]     = useState<'overview' | 'graph' | 'history' | 'settings' | 'code' | 'security'>('overview');
  const [focusedFn,       setFocusedFn]       = useState<FunctionDetail | null>(null);
  const [focusedFilePath, setFocusedFilePath] = useState<string>('');
  const [previousView,    setPreviousView]    = useState<'overview' | 'graph' | 'history' | 'security'>('overview');

  // ── Security ────────────────────────────────────────────────
  const [securityResult,   setSecurityResult]   = useState<SecurityScanResult | null>(null);
  const [selectedFinding,  setSelectedFinding]  = useState<SecurityFinding | null>(null);
  const [securityScanning, setSecurityScanning] = useState(false);

  // Filtre actif (piloté depuis Sidebar, utilisé par OverviewView)
  const [activeFilter,   setActiveFilter]   = useState<'critical' | 'stressed' | 'healthy' | 'hotspot' | null>(null);
  const [excludedFiles,  setExcludedFiles]  = useState<string[]>([]);

  useEffect(() => { window.api.getExcludedFiles().then(setExcludedFiles); }, [projectPath]);

  const handleFocusFunction = (fn: FunctionDetail, filePath: string) => {
    setPreviousView('overview');
    setFocusedFn(fn);
    setFocusedFilePath(filePath);
    setCenterView('code');
  };

  const handleSecurityViewInCode = (filePath: string, line: number, rule: string, finding: SecurityFinding) => {
    setPreviousView('security');
    setSelectedFinding(finding);
    setFocusedFn({
      name:                  rule,
      start_line:            Math.max(1, line - 3),
      line_count:            12,
      cyclomatic_complexity: 0,
      cognitive_complexity:  0,
      parameter_count:       0,
      max_depth:             0,
    });
    setFocusedFilePath(filePath);
    setCenterView('code');
  };

  const handleCodeViewClose = () => {
    if (previousView === 'security') setSelectedFinding(null);
    setCenterView(previousView);
  };

  // Charger le dernier résultat persisté au changement de projet
  useEffect(() => {
    setSecurityResult(null);
    setSelectedFinding(null);
    if (projectPath) {
      window.api.getLastSecurityResult(projectPath).then(r => {
        if (r) setSecurityResult(r);
      }).catch(() => {});
    }
  }, [projectPath]);

  // Auto-scan au premier accès Security (si activé dans les settings et pas de résultat)
  useEffect(() => {
    if (centerView !== 'security' || securityResult || securityScanning || !projectPath) return;
    window.api.getSettings().then(s => {
      if (s.autoSecurityScan !== false) {
        setSecurityScanning(true);
        window.api.runSecurityScan(projectPath)
          .then(r => setSecurityResult(r))
          .finally(() => setSecurityScanning(false));
      }
    });
  }, [centerView, projectPath]);

  // Sync settings ouvertes depuis la topbar
  useEffect(() => {
    if (settingsOpen) setCenterView('settings');
    else if (centerView === 'settings') setCenterView('overview');
  }, [settingsOpen]);

  // ── Layout — largeurs des panneaux ──────────────────────────────────────────
  const [leftWidth,      setLeftWidth]      = useLocalPref('pref.sidebarWidth', 260);
  const [rightWidth,     setRightWidth]     = useLocalPref('pref.rightWidth', 308);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const leftWidthRef  = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  useEffect(() => { leftWidthRef.current  = leftWidth;  }, [leftWidth]);
  useEffect(() => { rightWidthRef.current = rightWidth; }, [rightWidth]);

  const startResize = useCallback((side: 'left' | 'right', e: React.MouseEvent, currentWidth: number) => {
    e.preventDefault();
    const setFn          = side === 'left' ? setLeftWidth : setRightWidth;
    const sign           = side === 'left' ? 1 : -1;
    const [min, max]     = side === 'left' ? [200, 420] : [240, 500];
    const startX         = e.clientX;
    const onMove = (ev: MouseEvent) => setFn(Math.min(max, Math.max(min, currentWidth + sign * (ev.clientX - startX))));
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Métriques projet ─────────────────────────────────────────────────────────
  const stable      = scans.filter(s => s.globalScore < 20).length;
  const stressed    = scans.filter(s => s.globalScore >= 20 && s.globalScore < 50).length;
  const critical    = scans.filter(s => s.globalScore >= 50).length;
  const currentScore = scans.length > 0
    ? scans.reduce((a, s) => a + s.globalScore, 0) / scans.length
    : projectHistory.length > 0 ? projectHistory[projectHistory.length - 1]!.score : 0;
  const prevScore  = projectHistory.length >= 2 ? projectHistory[projectHistory.length - 2]!.score : null;
  const delta      = prevScore !== null ? currentScore - prevScore : null;
  const healthColor = projectHealthStatus(currentScore > 0 ? currentScore : null).colorHex;

  const tabStyle = (v: 'overview' | 'graph' | 'history' | 'settings' | 'security'): React.CSSProperties => ({
    fontSize: 11, fontWeight: 500, padding: '10px 14px', cursor: 'pointer',
    border: 'none', background: 'transparent', letterSpacing: '0.05em',
    color: centerView === v ? 'var(--text-primary)' : 'var(--text-muted)',
    borderBottom: centerView === v ? '1.5px solid var(--blue)' : '1.5px solid transparent',
    transition: 'color 0.15s', fontFamily: 'inherit',
  });

  const showRight = selected !== null || selectedFinding !== null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ── */}
      <Sidebar
        scans={scans}
        projectPath={projectPath}
        selected={selected}
        events={events}
        width={leftWidth}
        isOpen={sidebarOpen}
        externalFilter={activeFilter}
        excludedFiles={excludedFiles}
        onSelect={onSelectScan}
        onFilterChange={setActiveFilter}
        onExcludedChange={setExcludedFiles}
      />

      <ResizeHandle
        onMouseDown={e => startResize('left', e, leftWidthRef.current)}
        collapseToward="left"
      />

      {/* ── CENTER ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: 'var(--bg-center)' }}>

        {/* Header Settings */}
        {centerView === 'settings' && (
          <div style={{ padding: '18px 24px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid var(--border)' }}>
            <svg width="15" height="13" viewBox="0 0 14 12" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="1" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4" cy="2" r="1.6" fill="var(--bg-center)" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="9" cy="6" r="1.6" fill="var(--bg-center)" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="5" cy="10" r="1.6" fill="var(--bg-center)" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.title')}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{t('settings.subtitle')}</div>
            </div>
          </div>
        )}

        {/* Project header — masqué sur Overview et Settings */}
        <div style={{
          padding: (centerView === 'overview' || centerView === 'settings') ? '0 24px' : '18px 24px 14px',
          flexShrink: 0,
          maxHeight: (centerView === 'overview' || centerView === 'settings') ? 0 : 200,
          opacity:   (centerView === 'overview' || centerView === 'settings') ? 0 : 1,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease',
          pointerEvents: (centerView === 'overview' || centerView === 'settings') ? 'none' : 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <ProjectSwitcher
                  projectPath={projectPath}
                  projects={projects}
                  projectsHealth={projectsHealth}
                  healthColor={healthColor}
                  currentScore={currentScore}
                  onSwitchProject={onSwitchProject}
                  onAddProject={onAddProject}
                />
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>{scans.length} modules</span>
              </div>
              {scans.length > 0 && (
                <div style={{ display: 'flex', height: 2, borderRadius: 2, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
                  {stable   > 0 && <div style={{ flex: stable,   background: '#34c759', opacity: 0.7 }} />}
                  {stressed > 0 && <div style={{ flex: stressed, background: '#ff9f0a', opacity: 0.8 }} />}
                  {critical > 0 && <div style={{ flex: critical, background: '#ff453a' }} />}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.9 }}>
                {stable   > 0 && <><span style={{ color: 'rgba(52,199,89,0.7)' }}>{stable} healthy</span><span style={{ color: 'var(--border-hover)' }}> · </span></>}
                {stressed > 0 && <><span style={{ color: 'rgba(255,159,10,0.7)' }}>{stressed} stressed</span><span style={{ color: 'var(--border-hover)' }}> · </span></>}
                {critical > 0 && <span style={{ color: 'rgba(255,69,58,0.8)' }}>{critical} critical</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 38, fontWeight: 200, color: healthColor, letterSpacing: '-2px', lineHeight: 1 }}>
                    {currentScore.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-ghost)', marginBottom: 3 }}>/100</span>
                </div>
                {delta !== null && Math.abs(delta) > 0.1 && (
                  <div style={{ fontSize: 10, color: delta > 0 ? '#ff453a' : '#34c759', marginTop: 2, textAlign: 'right' }}>
                    {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
                  </div>
                )}
              </div>
              {projectHistory.length >= 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <ProjectTrendGraph history={projectHistory} />
                  <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>{projectHistory.length}d</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {centerView !== 'settings' && (
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '0.5px solid var(--border)', padding: '0 24px' }}>
            {(['overview', 'graph', 'history', 'security'] as const).map(v => (
              <button key={v} style={tabStyle(v)} onClick={() => setCenterView(v)}>
                {v === 'security' ? 'SECURITY' : t(`tab.${v}` as any).toUpperCase()}
              </button>
            ))}
            <div style={{ flex: 1 }} />
          </div>
        )}

        {/* Vues */}
        {centerView === 'code' && focusedFn && (
          <CodeView
            filePath={focusedFilePath}
            fn={focusedFn}
            onClose={handleCodeViewClose}
          />
        )}
        {centerView === 'overview' && (
          <OverviewView
            scans={scans} edges={edges} projectPath={projectPath}
            projectHistory={projectHistory} currentScore={currentScore}
            projects={projects} projectsHealth={projectsHealth}
            securityResult={securityResult}
            onSelectScan={s => onSelectScan(s)}
            onSwitchProject={onSwitchProject}
            onAddProject={onAddProject}
            onFilterChange={filter => setActiveFilter(filter)}
            onGoToSecurity={() => setCenterView('security')}
            onGoToActivity={() => setCenterView('history')}
            onExport={onExport}
            exporting={exporting}
          />
        )}
        {centerView === 'graph'   && <GraphView   scans={scans} edges={edges} onSelect={onSelectScan} selectedPath={selected?.filePath ?? null} />}
        {centerView === 'history' && <HistoryView projectHistory={projectHistory} projectPath={projectPath} scans={scans} onSelectScan={s => { onSelectScan(scans.find(sc => sc.filePath === s) ?? null); }} />}
        {centerView === 'settings'  && <SettingsView
          excludedFiles={excludedFiles}
          onIncludeFile={fp => window.api.includeFile(fp).then(setExcludedFiles)}
        />}
        {centerView === 'security'  && (
          <SecurityView
            projectPath={projectPath}
            result={securityResult}
            onResultChange={setSecurityResult}
            onViewInCode={handleSecurityViewInCode}
            externalLoading={securityScanning}
          />
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      {showRight && (
        <ResizeHandle
          onMouseDown={e => { if (rightCollapsed) { setRightCollapsed(false); return; } startResize('right', e, rightWidthRef.current); }}
          onToggle={() => setRightCollapsed(c => !c)}
          collapsed={rightCollapsed}
          collapseToward="right"
        />
      )}
      {showRight && (
        <div style={{
          width: rightCollapsed ? 0 : rightWidth,
          minWidth: rightCollapsed ? 0 : rightWidth,
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderLeft: '0.5px solid var(--border)',
          transition: rightCollapsed ? 'width 0.2s, min-width 0.2s' : 'none',
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
        }}>
          {selected && !selectedFinding && <Detail scan={selected} onClose={() => onSelectScan(null)} edges={edges} onFocusFunction={handleFocusFunction} />}
          {selectedFinding && <SecurityFindingPanel finding={selectedFinding} onClose={() => { setSelectedFinding(null); handleCodeViewClose(); }} />}
        </div>
      )}
    </div>
  );
}

// ── SecurityFindingPanel ──────────────────────────────────────────────────────

const SEV_COLOR_PANEL: Record<string, string> = {
  critical: 'var(--red)',
  high:     '#ff6b35',
  medium:   'var(--orange)',
  low:      '#a8c5da',
  info:     'var(--text-muted)',
};

function SecurityFindingPanel({ finding, onClose }: { finding: SecurityFinding; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 14px', flexShrink: 0, borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>
              Security Finding
            </div>
            <div style={{
              fontSize: 12, color: SEV_COLOR_PANEL[finding.severity] ?? 'var(--text-primary)',
              fontWeight: 600, lineHeight: 1.4,
            }}>
              {finding.message}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: '0 2px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >×</button>
        </div>

        {/* Severity badge */}
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 3,
          color: SEV_COLOR_PANEL[finding.severity],
          background: `${SEV_COLOR_PANEL[finding.severity]}18`,
          border: `0.5px solid ${SEV_COLOR_PANEL[finding.severity]}40`,
          fontFamily: "'SF Mono','Menlo',monospace",
        }}>
          {finding.severity}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>

        {/* Localisation */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Location</div>
          <div style={{ fontSize: 10, fontFamily: "'SF Mono','Menlo',monospace", color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 2, wordBreak: 'break-all' }}>{finding.filePath.split('/').slice(-3).join('/')}</div>
            <div style={{ color: 'var(--text-muted)' }}>line {finding.line}</div>
          </div>
        </div>

        {/* Rule */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Rule</div>
          <div style={{ fontSize: 10, fontFamily: "'SF Mono','Menlo',monospace", color: 'var(--text-secondary)' }}>{finding.rule}</div>
        </div>

        {/* Snippet */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Snippet</div>
          <div style={{
            padding: '10px 12px',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 6,
            fontFamily: "'SF Mono','Menlo',monospace",
            fontSize: 11, color: 'var(--text-secondary)',
            overflowX: 'auto', whiteSpace: 'pre',
            borderLeft: `2px solid ${SEV_COLOR_PANEL[finding.severity]}`,
          }}>
            {finding.snippet}
          </div>
        </div>

        {/* Category */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Category</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{finding.category}</div>
        </div>
      </div>
    </div>
  );
}
