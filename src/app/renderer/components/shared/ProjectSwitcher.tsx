import React, { useRef } from 'react';
import { projectHealthStatus } from '../../utils';
import { useLocale } from '../../hooks/useLocale';

interface Project { path: string; name: string; addedAt: string; }
interface ProjectHealth { path: string; avgScore: number | null; }

interface Props {
  projectPath:     string;
  projects:        Project[];
  projectsHealth:  ProjectHealth[];
  healthColor:     string;
  currentScore:    number;
  onSwitchProject: (path: string) => void;
  onAddProject:    () => void;
}

// ── ProjectRow ────────────────────────────────────────────────────────────────

interface RowProps {
  project:        Project;
  isActive:       boolean;
  avg:            number | null;
  totalProjects:  number;
  onSwitch:       () => void;
  onRemove:       () => void;
}

function ProjectRow({ project, isActive, avg, totalProjects, onSwitch, onRemove }: RowProps) {
  // On peut toujours supprimer — même le dernier projet (→ écran d'accueil)
  const canRemove = true;
  const { t }    = useLocale();
  const status   = projectHealthStatus(avg);
  const statusLabel = status.label === 'High pressure'
    ? t('status.critical')
    : status.label === 'Elevated'
      ? t('status.stressed')
      : status.label === 'Low pressure'
        ? t('status.healthy')
        : t('status.observing');
  const dotColor = status.colorHex;
  const hasData  = avg !== null;

  return (
    <div
      onClick={onSwitch}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
        cursor: isActive ? 'default' : 'pointer',
        background: isActive ? 'var(--bg-active)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
        const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement | null;
        if (btn) btn.style.opacity = '1';
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
        const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement | null;
        if (btn) btn.style.opacity = '0';
      }}
    >
      {/* Dot santé */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: dotColor,
        boxShadow: isActive ? `0 0 6px ${dotColor}88` : hasData ? `0 0 4px ${dotColor}55` : 'none',
        opacity: hasData || isActive ? 1 : 0.4,
      }} />

      {/* Nom + chemin */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {project.name}
        </div>
        <div style={{
          fontSize: 9, color: 'var(--text-faint)',
          fontFamily: "'SF Mono','Menlo',monospace",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {project.path}
        </div>
      </div>

      {/* Score */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 40 }}>
        {hasData ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 200, color: dotColor, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {(avg as number).toFixed(0)}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 1 }}>{statusLabel.toLowerCase()}</div>
          </>
        ) : (
          <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{t('switcher.noScan')}</div>
        )}
      </div>

      {/* Badge actif + bouton supprimer */}
      {isActive && !canRemove && (
        <span style={{ fontSize: 9, color: 'var(--blue)', flexShrink: 0, marginLeft: 4 }}>{t('switcher.active')}</span>
      )}
      {canRemove && (
        <button
          className="remove-btn"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title={isActive ? 'Retirer ce projet (bascule sur le suivant)' : 'Retirer ce projet'}
          style={{
            opacity: 0, transition: 'color 0.15s',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-ghost)', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-ghost)'; }}
        >×</button>
      )}
    </div>
  );
}

// ── ProjectSwitcher ───────────────────────────────────────────────────────────

export default function ProjectSwitcher({
  projectPath, projects: initialProjects, projectsHealth, healthColor, currentScore,
  onSwitchProject, onAddProject,
}: Props) {
  const { t }      = useLocale();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = React.useState(initialProjects);
  const [open,     setOpen]     = React.useState(false);
  const [dropPos,  setDropPos]  = React.useState({ top: 0, left: 0 });

  React.useEffect(() => setProjects(initialProjects), [initialProjects]);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const healthMap = new Map(projectsHealth.map(h => [h.path, h.avgScore]));

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(o => !o);
  }

  function handleRemove(path: string) {
    window.api.removeProject(path).then(updated => {
      setProjects(updated);
      setOpen(false);
    });
  }

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>

      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
          background: open ? 'var(--bg-hover)' : 'transparent',
          border: `0.5px solid ${open ? 'var(--border-hover)' : 'var(--border)'}`,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor, flexShrink: 0, boxShadow: `0 0 5px ${healthColor}88` }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {projectPath.split('/').pop() || '—'}
        </span>
        {projects.length > 1 && (
          <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>
            {projects.length}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-faint)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>›</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            minWidth: 320, zIndex: 9999,
            background: 'rgb(32, 32, 35)',
            border: '0.5px solid var(--border-hover)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {projects.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              {projects.map(p => (
                <ProjectRow
                  key={p.path}
                  project={p}
                  isActive={p.path === projectPath}
                  avg={p.path === projectPath ? currentScore : (healthMap.get(p.path) ?? null)}
                  totalProjects={projects.length}
                  onSwitch={() => { if (p.path !== projectPath) { onSwitchProject(p.path); setOpen(false); } }}
                  onRemove={() => handleRemove(p.path)}
                />
              ))}
            </div>
          )}

          {/* Ajouter un projet */}
          <div style={{ borderTop: projects.length > 0 ? '0.5px solid var(--border)' : 'none' }}>
            <div
              onClick={() => { onAddProject(); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: 'var(--bg-active)', border: '0.5px solid var(--blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'var(--blue)', lineHeight: 1,
              }}>+</div>
              <span style={{ fontSize: 12, color: 'var(--blue)' }}>{t('switcher.addProject')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
