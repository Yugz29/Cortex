import { useState } from 'react';
import { projectHealthStatus } from '../utils';
import { useLocale } from '../hooks/useLocale';

interface Project { path: string; name: string; addedAt: string; }
interface ProjectHealth { path: string; avgScore: number | null; fileCount?: number; }

interface Props {
  projects:       Project[];
  projectsHealth: ProjectHealth[];
  onAdd:  () => void;
  onOpen: (path: string) => void;
}

// ── Logo animé ────────────────────────────────────────────────────────────────
function CortexLogo() {
  return (
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      <style>{`
        @keyframes cx-scan-home {
          0%   { transform: scale(0.3); opacity: 0.65; }
          80%  { opacity: 0.15; }
          100% { transform: scale(3.4); opacity: 0; }
        }
      `}</style>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', inset: 0, margin: 'auto',
          width: 22, height: 22, borderRadius: '50%',
          border: '1.5px solid #0a84ff',
          animation: 'cx-scan-home 4.2s ease-out infinite',
          animationDelay: `${i * 1.4}s`,
          animationFillMode: 'both',
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0, margin: 'auto',
        width: 10, height: 10, borderRadius: '50%',
        background: '#0a84ff', boxShadow: '0 0 10px rgba(10,132,255,0.7)',
      }} />
    </div>
  );
}

// ── Carte projet ──────────────────────────────────────────────────────────────
function ProjectCard({ project, health, fileCount, onOpen, onRemove }: {
  project:   Project;
  health:    number | null;
  fileCount: number;
  onOpen:    () => void;
  onRemove:  () => void;
}) {
  const { t }   = useLocale();
  const [hov, setHov] = useState(false);
  const status  = projectHealthStatus(health);
  const statusLabel = status.label === 'High pressure'
    ? t('status.critical')
    : status.label === 'Elevated'
      ? t('status.stressed')
      : status.label === 'Low pressure'
        ? t('status.healthy')
        : t('status.observing');
  const color   = status.colorHex;
  const score   = health !== null ? Math.round(health) : null;
  const hasData = health !== null;

  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const d  = Math.floor(ms / 86400000);
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor(ms / 60000);
    if (d > 0) return t('welcome.daysAgo',    { n: d });
    if (h > 0) return t('welcome.hoursAgo',   { n: h });
    if (m > 0) return t('welcome.minutesAgo', { n: m });
    return t('welcome.justNow');
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        borderRadius: 12,
        background: hov ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        border: `0.5px solid ${hov ? color + '55' : 'rgba(255,255,255,0.09)'}`,
        boxShadow: hov ? `0 4px 20px rgba(0,0,0,0.25), 0 0 0 0.5px ${color}22` : 'none',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Bande couleur haut */}
      <div style={{
        height: 2.5,
        background: hasData
          ? `linear-gradient(90deg, transparent 0%, ${color} 40%, ${color}66 100%)`
          : 'rgba(255,255,255,0.06)',
        opacity: hov ? 1 : 0.5,
        transition: 'opacity 0.18s',
      }} />

      <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Nom + × */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {project.name}
          </span>
          {hov && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{
                flexShrink: 0, width: 17, height: 17, borderRadius: '50%',
                background: 'rgba(255,69,58,0.2)', border: '0.5px solid rgba(255,69,58,0.5)',
                color: '#ff453a', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ff453a'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,69,58,0.2)'; e.currentTarget.style.color = '#ff453a'; }}
            >×</button>
          )}
        </div>

        {/* Score + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {hasData ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 26, fontWeight: 200, color, letterSpacing: '-1.5px', lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 1 }}>/100</span>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic' }}>{t('welcome.noScan')}</span>
          )}
          {hasData && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color, background: `${color}15`, border: `0.5px solid ${color}40`,
              borderRadius: 20, padding: '2px 7px',
            }}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Fichiers + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
            {fileCount > 0 ? `${fileCount} files` : '—'}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>
            {timeAgo(project.addedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── WelcomeView ───────────────────────────────────────────────────────────────
export default function WelcomeView({ projects, projectsHealth, onAdd, onOpen }: Props) {
  const { t }     = useLocale();
  const healthMap = new Map(projectsHealth.map(h => [h.path, h]));
  const hasProjects = projects.length > 0;
  const cols = projects.length <= 2 ? 2 : projects.length <= 6 ? 3 : 4;

  async function handleRemove(path: string) {
    await window.api.removeProject(path);
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 48px', gap: 36, position: 'relative',
    }}>

      {/* Logo + titre */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <CortexLogo />
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {hasProjects ? t('welcome.yourProjects') : t('welcome.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {hasProjects ? t('welcome.selectProject') : t('welcome.subtitle')}
          </div>
        </div>
      </div>

      {/* Grille projets */}
      {hasProjects && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 210px)`,
          gap: 10,
          maxHeight: '50vh',
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          {projects.map(p => {
            const h = healthMap.get(p.path);
            return (
              <ProjectCard
                key={p.path}
                project={p}
                health={h?.avgScore ?? null}
                fileCount={h?.fileCount ?? 0}
                onOpen={() => onOpen(p.path)}
                onRemove={() => handleRemove(p.path)}
              />
            );
          })}
        </div>
      )}

      {/* Bouton ajouter */}
      <button
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 20px', borderRadius: 10,
          background: 'rgba(10,132,255,0.10)',
          border: '0.5px solid rgba(10,132,255,0.28)',
          color: 'var(--blue)', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', letterSpacing: '-0.01em',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,132,255,0.18)'; e.currentTarget.style.borderColor = 'rgba(10,132,255,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,132,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(10,132,255,0.28)'; }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {hasProjects ? t('welcome.addAnother') : t('welcome.addFirst')}
      </button>

    </div>
  );
}
