import { useState, useEffect } from 'react';
import type { Scan, Edge } from './types';
import { avgRiskScore, projectHealthStatus } from './utils';
import { useLocale } from './hooks/useLocale';
import ProjectsPanel from './components/ProjectsPanel';
import CortexView from './components/CortexView';
import WelcomeView from './components/WelcomeView';

// ── Health pill ───────────────────────────────────────────────────────────────
function HealthPill({ scans }: { scans: Scan[] }) {
  if (!scans.length) return null;
  const avg    = avgRiskScore(scans);
  const status = projectHealthStatus(avg);
  const hex    = status.colorHex;
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '2px 8px',
      borderRadius: 20, letterSpacing: '0.04em',
      color: hex, background: `${hex}14`, border: `0.5px solid ${hex}30`,
    }}>
      {status.label.toUpperCase()}
    </span>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { t } = useLocale();
  const [view,           setView]           = useState<'cortex' | 'projects'>('cortex');
  const [scans,          setScans]          = useState<Scan[]>([]);
  const [edges,          setEdges]          = useState<Edge[]>([]);
  const [events,         setEvents]         = useState<{ message: string; level: string; type: string; ts: number }[]>([]);
  const [projectPath,    setProjectPath]    = useState('');
  const [projectHistory, setProjectHistory] = useState<{ date: string; score: number; healthPct: number }[]>([]);
  const [selected,       setSelected]       = useState<Scan | null>(null);
  const [projects,       setProjects]       = useState<{ path: string; name: string; addedAt: string }[]>([]);
  const [projectsHealth, setProjectsHealth] = useState<{ path: string; avgScore: number | null; fileCount?: number }[]>([]);
  const [scanStatus,     setScanStatus]     = useState('');
  const [exporting,      setExporting]      = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [isFullscreen,   setIsFullscreen]   = useState(false);

  useEffect(() => {
    window.api.getProjectPath().then(setProjectPath);
    window.api.getProjects().then(setProjects);
    window.api.getProjectsHealth().then(setProjectsHealth);
    load();
    window.api.onScanComplete(() => { load(); refreshHealth(); setSwitching(false); });
    window.api.onEvent((e: any) => {
      if (e.type === 'scan-start') { setScanStatus('scanning…'); return; }
      if (e.type === 'scan-done')  { setScanStatus(''); return; }
      if (e.type === 'project-switch') {
        const newPath = e.message?.replace('switched · ', '') ?? '';
        setProjectPath(newPath);
        // Toujours rafraîchir la liste + la santé après switch ou suppression
        window.api.getProjects().then(setProjects);
        window.api.getProjectsHealth().then(setProjectsHealth);
        if (!newPath) {
          setScans([]); setEdges([]); setSelected(null); setProjectHistory([]);
        }
        setEvents(prev => [
          ...prev.filter(ev => ev.type !== 'project-switch' && ev.type !== 'watcher-restarted'),
          { message: e.message, level: e.level ?? 'info', type: e.type, ts: e.ts ?? Date.now() },
        ]);
        return;
      }
      if (e.type === 'watcher-restarted') {
        setEvents(prev => [
          ...prev.filter(ev => ev.type !== 'watcher-restarted'),
          { message: e.message, level: 'info', type: e.type, ts: e.ts ?? Date.now() },
        ]);
        return;
      }
      const msg = e.type === 'changed' ? `${e.file} · modified`
                : e.type === 'added'   ? `${e.file} · added`
                : e.type === 'deleted' ? `${e.file} · deleted`
                : e.message ?? '';
      if (msg) setEvents(prev => [...prev.slice(-99), { message: msg, level: e.level ?? 'info', type: e.type, ts: e.ts ?? Date.now(), filePath: e.filePath ?? null }]);
    });
    // Détection plein écran via events natifs Electron
    const unsubFullscreen = window.api.onFullscreenChange((fs: boolean) => setIsFullscreen(fs));

    window.api.onFocusFile((fp: string) => {
      window.api.getScans().then(latest => {
        const scan = latest.find(s => s.filePath === fp);
        if (scan) setSelected(scan);
      });
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fresh = scans.find(s => s.filePath === selected.filePath);
    if (fresh && fresh.globalScore !== selected.globalScore) setSelected(fresh);
  }, [scans]);

  async function load() {
    try {
      const [s, e, p] = await Promise.all([
        window.api.getScans(),
        window.api.getEdges(),
        window.api.getProjectPath(),
      ]);
      setScans(s); setEdges(e);
      if (p) setProjectPath(p);
      const h = await (window.api.getProjectHistory
        ? window.api.getProjectHistory()
        : window.api.getProjectScoreHistory().then(rows =>
            rows.map(r => ({ ...r, healthPct: Math.max(0, 100 - r.score) }))
          )
      );
      setProjectHistory(h);
    } catch (err) {
      console.error('[Cortex] load() failed:', err);
    }
  }

  async function refreshHealth() {
    setProjectsHealth(await window.api.getProjectsHealth());
  }

  async function handleSwitchProject(path: string) {
    setSwitching(true);
    await window.api.switchProject(path);
    const p = await window.api.getProjects();
    setProjects(p);
    setProjectPath(path);
    setSelected(null);
  }

  async function handleAddProject() {
    const result = await window.api.addProject();
    if (result) {
      setProjects(result);
      window.api.getProjectPath().then(setProjectPath);
      setSelected(null);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try { await window.api.exportReport(); }
    finally { setExporting(false); }
  }

  const [switching,  setSwitching]  = useState(false);
  const projName    = projectPath.split('/').pop() || '—';
  const showWelcome = projects.length === 0 || !projectPath;

  return (
    <div style={{ background: 'transparent', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── WELCOME — no project configured ── */}
      {showWelcome && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-center)' }}>
          <div style={{ height: 44, flexShrink: 0, WebkitAppRegion: 'drag' as any }} />
          <WelcomeView
            projects={projects}
            projectsHealth={projectsHealth}
            onAdd={async () => { await handleAddProject(); }}
            onOpen={async (path) => {
              if (path !== projectPath) await handleSwitchProject(path);
            }}
          />
        </div>
      )}

      {/* Projects overlay */}
      {!showWelcome && view === 'projects' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
          <ProjectsPanel
            onClose={() => { setView('cortex'); window.api.getProjects().then(setProjects); }}
            activeProject={projectPath}
          />
        </div>
      )}

      {/* ── TOPBAR ── */}
      {!showWelcome && (
        <div className="glass" style={{
          height: 44, background: 'var(--bg-surface)',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: isFullscreen ? '0 16px 0 0' : '0 16px', gap: 10, flexShrink: 0,
          WebkitAppRegion: 'drag' as any, userSelect: 'none',
        }}>
          {/* En fenêtré : spacer pour les traffic lights. En plein écran : le bouton prend leur place */}
          {!isFullscreen && <div style={{ width: 72, flexShrink: 0 }} />}

          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Masquer la sidebar' : 'Afficher la sidebar'}
            style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              marginLeft: isFullscreen ? 10 : 0,
              border: `0.5px solid ${!sidebarOpen ? 'rgba(10,132,255,0.4)' : 'var(--border)'}`,
              background: !sidebarOpen ? 'rgba(10,132,255,0.12)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              color: !sidebarOpen ? 'var(--blue)' : 'var(--text-muted)',
              WebkitAppRegion: 'no-drag' as any,
            }}
            onMouseEnter={e => { if (sidebarOpen) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
            onMouseLeave={e => { if (sidebarOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
          >
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <rect x="0.6" y="0.6" width="12.8" height="10.8" rx="1.8" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="0.6" y="0.6" width="4.2" height="10.8" rx="1.8" fill="currentColor" opacity="0.3"/>
              <line x1="4.8" y1="0.6" x2="4.8" y2="11.4" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>

          {scanStatus && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>{scanStatus}</span>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={handleExport}
            style={{
              fontSize: 11, fontWeight: 500, padding: '5px 13px', borderRadius: 6,
              background: exporting ? 'rgba(52,199,89,0.15)' : 'rgba(10,132,255,0.15)',
              color:      exporting ? 'var(--green)' : 'var(--blue)',
              border:     `0.5px solid ${exporting ? 'rgba(52,199,89,0.3)' : 'rgba(10,132,255,0.3)'}`,
              cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.2s',
              WebkitAppRegion: 'no-drag' as any,
            }}
          >
            {exporting ? t('topbar.exported') : t('topbar.export')}
          </button>

          <button
            onClick={() => setSettingsOpen(o => !o)}
            title="Paramètres"
            style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              border: `0.5px solid ${settingsOpen ? 'rgba(10,132,255,0.4)' : 'var(--border)'}`,
              background: settingsOpen ? 'rgba(10,132,255,0.12)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              color: settingsOpen ? 'var(--blue)' : 'var(--text-muted)',
              WebkitAppRegion: 'no-drag' as any,
            }}
            onMouseEnter={e => { if (!settingsOpen) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
            onMouseLeave={e => { if (!settingsOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
          >
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="1" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4" cy="2" r="1.6" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="9" cy="6" r="1.6" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="5" cy="10" r="1.6" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── BODY ── */}
      {!showWelcome && (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            flex: 1, height: '100%',
            filter: switching ? 'blur(6px)' : 'none',
            transition: 'filter 0.2s ease',
            pointerEvents: switching ? 'none' : 'auto',
          }}>
            <CortexView
              scans={scans}
              edges={edges}
              projectPath={projectPath}
              projectHistory={projectHistory}
              events={events}
              selected={selected}
              projects={projects}
              projectsHealth={projectsHealth}
              onSelectScan={setSelected}
              onSwitchProject={handleSwitchProject}
              onAddProject={handleAddProject}
              onOpenSettings={() => setSettingsOpen(o => !o)}
              settingsOpen={settingsOpen}
              sidebarOpen={sidebarOpen}
            />
          </div>

          {/* Overlay de chargement lors du switch de projet */}
          {switching && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 100,
              background: 'var(--bg-center)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 16,
              animation: 'cx-fade-in 0.15s ease',
            }}>
              <style>{`
                @keyframes cx-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes cx-scan-load {
                  0%   { transform: scale(0.3); opacity: 0.6; }
                  80%  { opacity: 0.12; }
                  100% { transform: scale(3); opacity: 0; }
                }
              `}</style>
              <div style={{ position: 'relative', width: 48, height: 48 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, margin: 'auto',
                    width: 14, height: 14, borderRadius: '50%',
                    border: '1.5px solid var(--blue)',
                    animation: 'cx-scan-load 2.4s ease-out infinite',
                    animationDelay: `${i * 0.8}s`,
                    animationFillMode: 'both',
                  }} />
                ))}
                <div style={{
                  position: 'absolute', inset: 0, margin: 'auto',
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--blue)',
                  boxShadow: '0 0 8px rgba(10,132,255,0.6)',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                {projName}…
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
