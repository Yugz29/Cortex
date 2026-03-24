import { useState, useEffect } from 'react';

interface Project { path: string; name: string; addedAt: string; }
interface Props { onClose: () => void; activeProject: string; }

export default function ProjectsPanel({ onClose, activeProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding,   setAdding]   = useState(false);

  useEffect(() => {
    window.api.getProjects().then(p => { setProjects(p); setLoading(false); });
  }, []);

  async function handleAdd() {
    setAdding(true);
    const result = await window.api.addProject();
    if (result) setProjects(result);
    setAdding(false);
    onClose();
  }

  async function handleSwitch(projectPath: string) {
    if (projectPath === activeProject) { onClose(); return; }
    await window.api.switchProject(projectPath);
    onClose();
  }

  async function handleRemove(projectPath: string) {
    setRemoving(projectPath);
    const result = await window.api.removeProject(projectPath);
    setProjects(result);
    setRemoving(null);
  }

  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const d  = Math.floor(ms / 86400000);
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor(ms / 60000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'just now';
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgb(22, 22, 24)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', padding: '0 20px',
        borderBottom: '0.5px solid var(--border)', flexShrink: 0,
        WebkitAppRegion: 'drag' as any,
      }}>
        <div style={{ width: 72 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Projects</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 0, lineHeight: 1, WebkitAppRegion: 'no-drag' as any, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 12px' }}>
        {loading ? (
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading…</div>
        ) : projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>No projects yet.</div>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)' }}>Add a folder to get started.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {projects.map(p => {
              const isActive = p.path === activeProject;
              return (
                <div key={p.path} onClick={() => handleSwitch(p.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    background: isActive ? 'var(--bg-active)' : 'var(--bg-card)',
                    border: `0.5px solid ${isActive ? 'rgba(10,132,255,0.3)' : 'var(--border)'}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-active)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: isActive ? 'rgba(10,132,255,0.15)' : 'var(--bg-hover)',
                    border: '0.5px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    color: isActive ? '#0a84ff' : 'var(--text-muted)',
                  }}>
                    {isActive ? '◉' : '○'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.path}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {isActive ? (
                      <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 20, color: '#0a84ff', background: 'rgba(10,132,255,0.12)', border: '0.5px solid rgba(10,132,255,0.25)' }}>ACTIVE</span>
                    ) : (
                      <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{timeAgo(p.addedAt)}</span>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(p.path); }}
                    disabled={removing === p.path}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-ghost)'}
                    title="Remove project"
                  >
                    {removing === p.path ? '…' : '×'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 8,
            fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
            cursor: adding ? 'default' : 'pointer',
            background: adding ? 'rgba(10,132,255,0.08)' : 'rgba(10,132,255,0.12)',
            color: 'var(--blue)', border: '0.5px solid rgba(10,132,255,0.3)',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!adding) e.currentTarget.style.background = 'rgba(10,132,255,0.2)'; }}
          onMouseLeave={e => { if (!adding) e.currentTarget.style.background = 'rgba(10,132,255,0.12)'; }}
        >
          {adding ? 'Opening…' : '+ Add project'}
        </button>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)', textAlign: 'center', marginTop: 8 }}>
          Click a project to switch · Cortex rescans automatically
        </div>
      </div>
    </div>
  );
}
